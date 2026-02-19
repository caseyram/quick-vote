import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';
import type { SessionItem, Vote } from '../types/database';
import { useSessionStore } from '../stores/session-store';
import { useSequenceNavigation } from '../hooks/use-sequence-navigation';
import { SequenceManager } from './SequenceManager';
import { SlideDisplay } from './SlideDisplay';
import { ParticipantCount } from './ParticipantCount';
import { KeyboardShortcutHelp } from './KeyboardShortcutHelp';
import { CountdownTimer } from './CountdownTimer';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';
import type { QRMode } from './QROverlay';
import { TeamQRGrid } from './TeamQRGrid';
import { TeamFilterTabs } from './TeamFilterTabs';

interface PresentationControlsProps {
  sessionId: string;
  sessionTitle: string;
  participantCount: number;
  connectionStatus: ConnectionStatus;
  channelRef: React.RefObject<RealtimeChannel | null>;
  sessionVotes: Record<string, Vote[]>;
  onActivateSequenceItem: (item: SessionItem, direction: 'forward' | 'backward') => void;
  onEndSession: () => void;
  onQuickQuestion: (text: string, timerDuration: number | null) => void;
  quickQuestionLoading: boolean;
  countdownRemaining: number;
  countdownRunning: boolean;
  onCloseVoting: (questionId: string) => void;
}

const timerOptions = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: 'None', value: null },
] as const;

const slideVariants = {
  enter: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '100%' : direction === 'backward' ? '-100%' : 0,
    opacity: direction ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '-100%' : direction === 'backward' ? '100%' : 0,
    opacity: direction ? 0 : 1,
  }),
};

export function PresentationControls({
  sessionId,
  sessionTitle,
  participantCount,
  connectionStatus,
  channelRef,
  sessionVotes,
  onActivateSequenceItem,
  onEndSession,
  onQuickQuestion,
  quickQuestionLoading,
  countdownRemaining,
  countdownRunning,
  onCloseVoting,
}: PresentationControlsProps) {
  const {
    sessionItems,
    activeSessionItemId,
    questions,
    session,
  } = useSessionStore();

  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [highlightedReasonId, setHighlightedReasonId] = useState<string | null>(null);
  const [currentBatchQuestionIndex, setCurrentBatchQuestionIndex] = useState(0);
  const [reasonsPerPage, setReasonsPerPage] = useState<1 | 2 | 4>(1);
  const [timerDuration, setTimerDuration] = useState<number | null>(30);
  const [quickText, setQuickText] = useState('');
  const [showNextPreview, setShowNextPreview] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward' | null>(null);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  // Notes are always visible under active slide — no toggle needed
  const presentationWindowRef = useRef<Window | null>(null);

  // Auto-hide next preview when presentation window closes
  useEffect(() => {
    if (!presentationWindowRef.current) return;
    const interval = setInterval(() => {
      if (presentationWindowRef.current?.closed) {
        setShowNextPreview(false);
        presentationWindowRef.current = null;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPreview]);

  // Wrap onActivateSequenceItem to capture navigation direction
  const handleActivateItem = useCallback((item: SessionItem, direction: 'forward' | 'backward') => {
    setNavigationDirection(direction);
    onActivateSequenceItem(item, direction);
  }, [onActivateSequenceItem]);

  // Use navigation hook for keyboard shortcuts
  const { currentIndex, canGoNext, canGoPrev, goNext, goPrev } = useSequenceNavigation({
    enabled: true,
    onActivateItem: handleActivateItem,
  });

  const currentItem = currentIndex >= 0 ? sessionItems[currentIndex] : null;
  const nextItem = currentIndex >= 0 && currentIndex < sessionItems.length - 1
    ? sessionItems[currentIndex + 1]
    : null;

  const participantUrl = `${window.location.origin}/session/${sessionId}`;

  function handleOpenPresentation() {
    const url = `${window.location.origin}/presentation/${sessionId}`;
    const win = window.open(
      url,
      'QuickVotePresentation',
      'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
    );
    if (win) {
      presentationWindowRef.current = win;
      setShowNextPreview(true);
    }

    // Re-broadcast current active item after delay so the projection window
    // has time to connect its realtime channel and pick up the current state
    setTimeout(() => {
      const state = useSessionStore.getState();
      const activeId = state.activeSessionItemId;
      if (!activeId) return;

      const item = state.sessionItems.find((i) => i.id === activeId);
      if (!item) return;

      if (item.item_type === 'slide') {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'slide_activated',
          payload: { itemId: item.id, direction: null },
        });
      } else if (item.item_type === 'batch' && item.batch_id) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'batch_activated',
          payload: { batchId: item.batch_id },
        });
      }
    }, 3000);
  }

  function handleQrToggle(mode: QRMode) {
    setQrMode(mode);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'presentation_qr_toggle',
      payload: { mode },
    });
  }

  function handleBlackScreenToggle() {
    const newState = !blackScreenActive;
    setBlackScreenActive(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'black_screen_toggle',
      payload: { active: newState },
    });
  }

  function handleRevealQuestion(questionId: string) {
    const isRevealed = revealedQuestions.has(questionId);
    setRevealedQuestions((prev) => {
      const next = new Set(prev);
      if (isRevealed) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });

    channelRef.current?.send({
      type: 'broadcast',
      event: 'result_reveal',
      payload: { questionId, revealed: !isRevealed },
    });
  }

  function handleRevealBatch(questionIds: string[]) {
    const allRevealed = questionIds.every((id) => revealedQuestions.has(id));
    setRevealedQuestions((prev) => {
      const next = new Set(prev);
      questionIds.forEach((id) => (allRevealed ? next.delete(id) : next.add(id)));
      return next;
    });

    questionIds.forEach((questionId) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'result_reveal',
        payload: { questionId, revealed: !allRevealed },
      });
    });

    // Also sync the currently viewed question to the projection
    if (!allRevealed && questionIds.length > 0) {
      // Determine which question the admin is viewing based on batch question index
      const batchQuestions = questions
        .filter((q) => questionIds.includes(q.id))
        .sort((a, b) => a.position - b.position);
      const currentQ = batchQuestions[currentBatchQuestionIndex] || batchQuestions[0];
      if (currentQ) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'question_selected',
          payload: { questionId: currentQ.id },
        });
      }
    }
  }

  function handleSelectQuestion(questionId: string, index: number) {
    setCurrentBatchQuestionIndex(index);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'question_selected',
      payload: { questionId },
    });
  }

  function handleReasonsPerPage(count: 1 | 2 | 4) {
    setReasonsPerPage(count);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'reasons_per_page',
      payload: { count },
    });
  }

  function handleTeamChange(newTeam: string | null) {
    setSelectedTeam(newTeam);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'team_filter_changed',
      payload: { teamId: newTeam },
    });
  }

  function handleHighlightReason(questionId: string, reasonId: string) {
    const isSameReason = highlightedReasonId === reasonId;
    const newReasonId = isSameReason ? null : reasonId;
    setHighlightedReasonId(newReasonId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'reason_highlight',
      payload: { questionId, reasonId: newReasonId },
    });
  }

  // Reset reveal state when navigating away from a batch
  useEffect(() => {
    if (!currentItem || currentItem.item_type !== 'batch') {
      setRevealedQuestions(new Set());
      setHighlightedReasonId(null);
      setCurrentBatchQuestionIndex(0);
    }
  }, [activeSessionItemId, currentItem]);

  // Keyboard shortcuts in control view
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (event.key === 'b' || event.key === 'B') {
        handleBlackScreenToggle();
      } else if (event.key === '?') {
        setShowShortcutHelp((prev) => !prev);
      } else if (event.key === 'Escape' && showShortcutHelp) {
        setShowShortcutHelp(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blackScreenActive, showShortcutHelp, currentItem]);

  const isBatchActive = currentItem?.item_type === 'batch' && currentItem.batch_id;

  return (
    <div className="flex h-screen bg-white">
      {/* Left sidebar: Sequence list */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white space-y-3 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{sessionTitle}</h2>
          <button
            onClick={handleOpenPresentation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Open Presentation
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(participantUrl);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            {linkCopied ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                Copy Participant Link
              </>
            )}
          </button>
        </div>
        <div className="p-4 overflow-y-auto min-h-0 flex-1">
          <SequenceManager
            sessionId={sessionId}
            onExpandBatch={() => {}}
            onCreateBatch={async () => undefined}
            onDeleteBatch={() => {}}
            onDeleteSlide={() => {}}
            isLive={true}
            activeSessionItemId={activeSessionItemId}
            onActivateItem={handleActivateItem}
            sessionVotes={sessionVotes}
            participantCount={participantCount}
          />
        </div>
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button
            onClick={onEndSession}
            className="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Center area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Team filter tabs */}
        {session?.teams && session.teams.length > 0 && (
          <div className="shrink-0 px-6 pt-4">
            <TeamFilterTabs
              teams={session.teams}
              selectedTeam={selectedTeam}
              onTeamChange={handleTeamChange}
              theme="light"
            />
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {isBatchActive ? (
            <div className="h-full p-6 flex flex-col">
              <BatchControlPanel
                batchId={currentItem.batch_id!}
                questions={questions}
                sessionVotes={sessionVotes}
                revealedQuestions={revealedQuestions}
                highlightedReasonId={highlightedReasonId}
                currentBatchQuestionIndex={currentBatchQuestionIndex}
                onSelectQuestion={handleSelectQuestion}
                onRevealBatch={handleRevealBatch}
                onRevealQuestion={handleRevealQuestion}
                onHighlightReason={handleHighlightReason}
                hasSeparateProjection={showNextPreview}
                reasonsPerPage={reasonsPerPage}
                onReasonsPerPageChange={handleReasonsPerPage}
                selectedTeam={selectedTeam}
              />
            </div>
          ) : showNextPreview ? (
            <div className="flex gap-6 h-full p-6">
              <div className="flex-1 flex flex-col min-w-0">
                <h2 className="text-sm font-medium text-gray-500 mb-2">Current</h2>

                <div className="flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden flex items-center justify-center">
                  {currentItem ? (
                    <ProjectionPreview item={currentItem} />
                  ) : (
                    <p className="text-gray-500 text-sm">No active item</p>
                  )}
                </div>

                {/* Presenter Notes - always visible under active slide when notes exist */}
                {currentItem?.item_type === 'slide' && currentItem.slide_notes && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                    <div 
                      className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: currentItem.slide_notes }}
                    />
                  </div>
                )}
              </div>
              <div className="w-1/3 flex flex-col min-w-0">
                <h2 className="text-sm font-medium text-gray-500 mb-2">Next</h2>
                <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {nextItem ? (
                    <ProjectionPreview item={nextItem} />
                  ) : (
                    <p className="text-gray-400 text-sm">End of sequence</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Full view: projection-style with transitions */
            <div className="h-full bg-[#1a1a2e] relative overflow-hidden">
              <AnimatePresence initial={false} custom={navigationDirection}>
                <motion.div
                  key={activeSessionItemId ?? 'none'}
                  custom={navigationDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
                  className="w-full h-full absolute inset-0 flex items-center justify-center"
                >
                  {currentItem ? (
                    <ProjectionPreview item={currentItem} fullSize />
                  ) : (
                    <p className="text-gray-500 text-sm">No active item</p>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* QR overlay (bottom-right corner) */}
              {!qrExpanded && (
                <button
                  onClick={() => setQrExpanded(true)}
                  className="absolute bottom-4 right-4 z-10 bg-white p-3 rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  title="Show QR code"
                >
                  <QRCodeSVG value={participantUrl} size={80} level="M" marginSize={1} />
                  <p className="text-xs text-gray-600 text-center mt-1 font-medium">Scan to join</p>
                </button>
              )}

              {/* Connection + participant overlay (bottom-left) */}
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'reconnecting' ? 'bg-yellow-400 animate-pulse' :
                  connectionStatus === 'disconnected' ? 'bg-red-400' :
                  'bg-gray-400 animate-pulse'
                }`} />
                <span className="text-white/80 text-xs">
                  {participantCount} connected
                </span>
              </div>

            </div>
          )}

          {/* Expanded QR overlay — team grid when teams exist, single QR otherwise */}
          {qrExpanded && (
            session?.teams && session.teams.length > 0 ? (
              <TeamQRGrid
                sessionId={sessionId}
                teams={session.teams}
                onClose={() => setQrExpanded(false)}
                participantUrl={participantUrl}
                linkCopied={linkCopied}
                onCopyLink={() => {
                  navigator.clipboard.writeText(participantUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
              />
            ) : (
              <div
                className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center cursor-pointer"
                onClick={() => setQrExpanded(false)}
              >
                <QRCodeSVG value={participantUrl} size={400} level="M" marginSize={1} />
                <p className="text-2xl text-gray-600 text-center mt-6 font-medium">Scan to join</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(participantUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                >
                  {linkCopied ? (
                    <>
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      Copy Link
                    </>
                  )}
                </button>
                <p className="text-sm text-gray-400 mt-2">Click anywhere to close</p>
              </div>
            )
          )}
        </div>

        {/* Nav bar: always visible */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 font-medium rounded-lg transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 font-medium">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${sessionItems.length}` : 'No item selected'}
            </span>
            <button
              onClick={() => setShowNextPreview((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                showNextPreview
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={showNextPreview ? 'Full view' : 'Split view'}
            >
              {showNextPreview ? 'Full View' : 'Split View'}
            </button>
          </div>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right sidebar: only visible in split view */}
      {showNextPreview && (
        <div className="w-64 shrink-0 border-l border-gray-200 p-4 space-y-6 overflow-y-auto">
          {/* Timer Duration pills */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Timer Duration</h3>
            <div className="flex flex-wrap gap-2">
              {timerOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setTimerDuration(opt.value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    timerDuration === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Go Live Quick Question */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Go Live</h3>
            <input
              type="text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Type a question..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickText.trim()) {
                  e.preventDefault();
                  onQuickQuestion(quickText, timerDuration);
                  setQuickText('');
                }
              }}
            />
            <button
              onClick={() => {
                onQuickQuestion(quickText, timerDuration);
                setQuickText('');
              }}
              disabled={!quickText.trim() || quickQuestionLoading}
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {quickQuestionLoading ? 'Going Live...' : 'Go Live'}
            </button>
          </div>

          {/* Active Question Status */}
          {(() => {
            const activeQ = questions.find(q => q.status === 'active');
            if (!activeQ) return null;
            return (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                <h3 className="text-sm font-semibold text-yellow-800">Voting Active</h3>
                <p className="text-xs text-yellow-700 truncate">{activeQ.text}</p>
                {countdownRunning && (
                  <CountdownTimer
                    remainingSeconds={Math.ceil(countdownRemaining / 1000)}
                    isRunning={countdownRunning}
                    theme="light"
                  />
                )}
                <button
                  onClick={() => onCloseVoting(activeQ.id)}
                  className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Close Voting
                </button>
              </div>
            );
          })()}

          {/* QR Code controls */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">QR Code</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleQrToggle('hidden')}
                className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                  qrMode === 'hidden'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hidden
              </button>
              <button
                onClick={() => handleQrToggle('corner')}
                className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                  qrMode === 'corner'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Corner
              </button>
              <button
                onClick={() => handleQrToggle('fullscreen')}
                className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                  qrMode === 'fullscreen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Full Screen
              </button>
            </div>
          </div>

          {/* Presentation controls */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Presentation</h3>
            <button
              onClick={handleBlackScreenToggle}
              className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                blackScreenActive
                  ? 'bg-gray-800 text-white hover:bg-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {blackScreenActive ? 'Show Content' : 'Black Screen'}
            </button>
          </div>

          {/* Participant count */}
          <div className="pt-4 border-t border-gray-200">
            <ParticipantCount count={participantCount} size="default" />
          </div>

          {/* Keyboard shortcuts */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowShortcutHelp(true)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Keyboard Shortcuts (?)
            </button>
          </div>

          {/* Connection Status */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'disconnected' ? 'bg-red-500' :
                'bg-gray-400 animate-pulse'
              }`} />
              <span className={
                connectionStatus === 'connected' ? 'text-green-600' :
                connectionStatus === 'reconnecting' ? 'text-yellow-600' :
                connectionStatus === 'disconnected' ? 'text-red-600' :
                'text-gray-500'
              }>
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'reconnecting' ? 'Reconnecting...' :
                 connectionStatus === 'disconnected' ? 'Disconnected' :
                 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcut help overlay */}
      <KeyboardShortcutHelp
        visible={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />
    </div>
  );
}

// Batch control panel component
function BatchControlPanel({
  batchId,
  questions,
  sessionVotes,
  revealedQuestions,
  highlightedReasonId,
  currentBatchQuestionIndex,
  onSelectQuestion,
  onRevealBatch,
  onRevealQuestion: _onRevealQuestion,
  onHighlightReason,
  hasSeparateProjection,
  reasonsPerPage,
  onReasonsPerPageChange,
  selectedTeam,
}: {
  batchId: string;
  questions: any[];
  sessionVotes: Record<string, Vote[]>;
  revealedQuestions: Set<string>;
  highlightedReasonId: string | null;
  currentBatchQuestionIndex: number;
  onSelectQuestion: (questionId: string, index: number) => void;
  onRevealBatch: (questionIds: string[]) => void;
  onRevealQuestion: (questionId: string) => void;
  onHighlightReason: (questionId: string, reasonId: string) => void;
  hasSeparateProjection: boolean;
  reasonsPerPage: 1 | 2 | 4;
  onReasonsPerPageChange: (count: 1 | 2 | 4) => void;
  selectedTeam: string | null;
}) {
  const batchQuestions = questions
    .filter((q) => q.batch_id === batchId)
    .sort((a, b) => a.position - b.position);

  if (batchQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">No questions in this batch</p>
      </div>
    );
  }

  const currentQuestion = batchQuestions[currentBatchQuestionIndex] || batchQuestions[0];
  const questionVotes = sessionVotes[currentQuestion.id] || [];
  const aggregated = aggregateVotes(questionVotes, selectedTeam);
  const barData = buildConsistentBarData(currentQuestion, aggregated);

  const chartData = barData.map((item, index) => {
    let color: string;
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        agree: AGREE_DISAGREE_COLORS.agree,
        sometimes: AGREE_DISAGREE_COLORS.sometimes,
        disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      color = colorMap[item.value.toLowerCase()] || MULTI_CHOICE_COLORS[0];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }

    return {
      label: item.value,
      count: item.count,
      percentage: item.percentage,
      color,
    };
  });

  const getReasonColor = (voteValue: string): string => {
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        agree: AGREE_DISAGREE_COLORS.agree,
        sometimes: AGREE_DISAGREE_COLORS.sometimes,
        disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      return colorMap[voteValue.toLowerCase()] || MULTI_CHOICE_COLORS[0];
    } else {
      const optionIndex = currentQuestion.options?.indexOf(voteValue) ?? -1;
      return MULTI_CHOICE_COLORS[optionIndex % MULTI_CHOICE_COLORS.length];
    }
  };

  // Pre-initialize in question option order so reasons are grouped consistently
  // For agree/disagree, normalize vote values to canonical casing for consistent grouping
  const canonicalAgreeValues: Record<string, string> = {
    agree: 'Agree', sometimes: 'Sometimes', disagree: 'Disagree',
  };
  const reasonsByOption: Record<string, Vote[]> = {};
  const optionOrder = currentQuestion.type === 'agree_disagree'
    ? ['Agree', 'Sometimes', 'Disagree']
    : (currentQuestion.options ?? []);
  for (const opt of optionOrder) {
    reasonsByOption[opt] = [];
  }
  questionVotes.forEach((vote) => {
    if (vote.reason && vote.reason.trim()) {
      const groupKey = currentQuestion.type === 'agree_disagree'
        ? (canonicalAgreeValues[vote.value.toLowerCase()] || vote.value)
        : vote.value;
      if (!reasonsByOption[groupKey]) {
        reasonsByOption[groupKey] = [];
      }
      reasonsByOption[groupKey].push(vote);
    }
  });
  // Remove empty groups (options with no reasons)
  for (const key of Object.keys(reasonsByOption)) {
    if (reasonsByOption[key].length === 0) delete reasonsByOption[key];
  }

  const batchQuestionIds = batchQuestions.map((q) => q.id);
  const allRevealed = batchQuestionIds.every((id) => revealedQuestions.has(id));
  const totalBatchVotes = batchQuestionIds.reduce(
    (sum, id) => {
      const votes = sessionVotes[id] || [];
      const filteredVotes = selectedTeam ? votes.filter(v => v.team_id === selectedTeam) : votes;
      return sum + filteredVotes.length;
    },
    0,
  );

  // Flatten all reasons for playback and keyboard navigation
  const allReasons = Object.entries(reasonsByOption).flatMap(([, votes]) => votes);

  // Build group-aware pages: each page stays within one option group
  const reasonPages: typeof allReasons[] = [];
  for (const votes of Object.values(reasonsByOption)) {
    for (let i = 0; i < votes.length; i += reasonsPerPage) {
      reasonPages.push(votes.slice(i, i + reasonsPerPage));
    }
  }

  // Per-question state maps — preserves play state & viewed checkmarks when switching questions
  const [playStateMap, setPlayStateMap] = useState<Record<string, 'idle' | 'playing' | 'paused'>>({});
  const [viewedReasonIdsMap, setViewedReasonIdsMap] = useState<Record<string, Set<string>>>({});

  // Derive current question's state from maps
  const playState = playStateMap[currentQuestion.id] || 'idle';
  const viewedReasonIds = viewedReasonIdsMap[currentQuestion.id] || new Set<string>();

  // Wrappers that update only the current question's entry in the map
  function setPlayState(state: 'idle' | 'playing' | 'paused') {
    setPlayStateMap(prev => ({ ...prev, [currentQuestion.id]: state }));
  }
  function setViewedReasonIds(updater: Set<string> | ((prev: Set<string>) => Set<string>)) {
    setViewedReasonIdsMap(prev => {
      const current = prev[currentQuestion.id] || new Set<string>();
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [currentQuestion.id]: next };
    });
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Stable refs to avoid stale closures in effects/timeouts
  const onHighlightReasonRef = useRef(onHighlightReason);
  onHighlightReasonRef.current = onHighlightReason;
  const allReasonsRef = useRef(allReasons);
  allReasonsRef.current = allReasons;
  const reasonPagesRef = useRef(reasonPages);
  reasonPagesRef.current = reasonPages;
  const highlightedReasonIdRef = useRef(highlightedReasonId);
  highlightedReasonIdRef.current = highlightedReasonId;
  const playStateRef = useRef(playState);
  playStateRef.current = playState;

  // Shared: go to next/prev reason (used by auto-play, keyboard, and manual)
  // When usePages=true (auto-play with reasonsPerPage>1), jumps to start of next group-aware page
  function goToNextReason(usePages = false) {
    const reasons = allReasonsRef.current;
    if (reasons.length === 0) return;

    if (usePages) {
      const pages = reasonPagesRef.current;
      const curPageIdx = pages.findIndex((p) => p.some((v) => v.id === highlightedReasonIdRef.current));
      const nextPageIdx = curPageIdx + 1;
      if (nextPageIdx >= pages.length) {
        if (playStateRef.current === 'playing') setPlayState('paused');
        return;
      }
      onHighlightReasonRef.current(currentQuestion.id, pages[nextPageIdx][0].id);
    } else {
      const currentIdx = reasons.findIndex((v) => v.id === highlightedReasonIdRef.current);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= reasons.length) {
        if (playStateRef.current === 'playing') setPlayState('paused');
        return;
      }
      onHighlightReasonRef.current(currentQuestion.id, reasons[nextIdx].id);
    }
  }

  function goToPrevReason() {
    const reasons = allReasonsRef.current;
    if (reasons.length === 0) return;
    const currentIdx = reasons.findIndex((v) => v.id === highlightedReasonIdRef.current);
    const prevIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
    if (prevIdx === currentIdx && currentIdx !== -1) return;
    onHighlightReasonRef.current(currentQuestion.id, reasons[prevIdx < 0 ? 0 : prevIdx].id);
  }

  function handlePlayReasons() {
    if (playState === 'playing') {
      setPlayState('paused');
      return;
    }
    if (playState === 'paused') {
      setPlayState('playing');
      return;
    }
    // idle → start from beginning
    if (allReasons.length === 0) return;
    setViewedReasonIds(new Set());
    onHighlightReason(currentQuestion.id, allReasons[0].id);
    setPlayState('playing');
  }

  function handleResetPlay() {
    setPlayState('idle');
    onHighlightReason(currentQuestion.id, '');
  }

  // Pause auto-play when switching away from a question (preserves state for return)
  const prevQuestionIdRef = useRef(currentQuestion.id);
  useEffect(() => {
    if (prevQuestionIdRef.current !== currentQuestion.id) {
      const departingId = prevQuestionIdRef.current;
      setPlayStateMap(prev => {
        if (prev[departingId] === 'playing') {
          return { ...prev, [departingId]: 'paused' };
        }
        return prev;
      });
      prevQuestionIdRef.current = currentQuestion.id;
    }
  }, [currentQuestion.id]);

  // Mark all reasons on the active page as viewed whenever highlight changes
  useEffect(() => {
    if (highlightedReasonId) {
      setViewedReasonIds((prev) => {
        const idsToMark = activePageReasonIds.size > 0 ? activePageReasonIds : new Set([highlightedReasonId]);
        let changed = false;
        for (const id of idsToMark) {
          if (!prev.has(id)) { changed = true; break; }
        }
        if (!changed) return prev;
        const next = new Set(prev);
        for (const id of idsToMark) next.add(id);
        return next;
      });
    }
  }, [highlightedReasonId]);

  // Auto-scroll reasons panel to keep active items centered with context visible
  useEffect(() => {
    if (!highlightedReasonId || !scrollContainerRef.current) return;
    // Scroll the first active item to center so previous/next items are visible
    const ids = activePageReasonIds.size > 0 ? Array.from(activePageReasonIds) : [highlightedReasonId];
    const el = scrollContainerRef.current.querySelector(
      `[data-reason-id="${ids[0]}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedReasonId, reasonsPerPage]);

  // Keyboard: up/down arrows navigate reasons
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextReason();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevReason();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion.id]);

  // Auto-play: schedule next reason with variable timing
  useEffect(() => {
    if (playState !== 'playing') return;
    if (allReasons.length === 0) {
      setPlayState('idle');
      return;
    }

    // Find the current group-aware page to compute delay from its content
    const curPage = reasonPages.find((p) => p.some((v) => v.id === highlightedReasonId));
    const pageLen = curPage?.length ?? 1;
    const maxLen = Math.max(...(curPage ?? []).map((v) => v.reason?.length ?? 0), 0);
    // Base 3s, +0.5s per 40 chars, capped at 5s for single items
    // Multi-item pages scale sub-linearly: 2-item = 1.6x, 4-item = 2.5x
    const baseDelay = Math.min(3000 + Math.floor(maxLen / 40) * 500, 5000);
    const pageScale = pageLen === 1 ? 1 : pageLen === 2 ? 1.6 : 2.5;
    const delay = reasonsPerPage > 1 ? baseDelay * pageScale : baseDelay;

    const timeout = setTimeout(() => {
      goToNextReason(reasonsPerPage > 1);
    }, delay);

    return () => clearTimeout(timeout);
  }, [playState, highlightedReasonId, reasonsPerPage]);

  // Compute which group-aware page of reasons is active (for multi-select highlighting)
  const activePageData = highlightedReasonId
    ? reasonPages.find((p) => p.some((v) => v.id === highlightedReasonId))
    : null;
  const activePageReasonIds = new Set(
    activePageData ? activePageData.map((v) => v.id) : [],
  );

  // Find currently highlighted reason for display below chart
  const highlightedVote = highlightedReasonId
    ? questionVotes.find((v) => v.id === highlightedReasonId)
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto">
          {batchQuestions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => onSelectQuestion(q.id, idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                idx === currentBatchQuestionIndex
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">{totalBatchVotes} vote{totalBatchVotes !== 1 ? 's' : ''}</span>
          <button
            onClick={() => onRevealBatch(batchQuestionIds)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              allRevealed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {allRevealed
              ? (hasSeparateProjection ? 'Revealed to Audience' : 'Results Shown')
              : (hasSeparateProjection ? 'Reveal to Audience' : 'Show Results')}
          </button>
        </div>
      </div>

      <div className="border rounded-lg bg-white p-4 mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{currentQuestion.text}</h3>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chart + highlighted reason(s) column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          {/* Highlighted reason display — single */}
          {reasonsPerPage === 1 && highlightedVote && (
            <div className="shrink-0 flex justify-center">
              <div
                className="rounded-lg p-4 border-2 max-w-lg w-full text-center"
                style={{
                  borderLeftWidth: '5px',
                  borderLeftColor: getReasonColor(highlightedVote.value),
                  backgroundColor: getReasonColor(highlightedVote.value) + '08',
                }}
              >
                <p className="text-base text-gray-800 font-medium leading-relaxed">
                  &ldquo;{highlightedVote.reason}&rdquo;
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {highlightedVote.display_name && (
                    <span className="text-sm text-gray-500">— {highlightedVote.display_name}</span>
                  )}
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: getReasonColor(highlightedVote.value) + '20',
                      color: getReasonColor(highlightedVote.value),
                    }}
                  >
                    {highlightedVote.value}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Highlighted reasons display — multiple (2 or 4) */}
          {reasonsPerPage > 1 && activePageData && activePageData.length > 0 && (
            <div className={`shrink-0 ${reasonsPerPage === 4 ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'} max-w-lg mx-auto w-full`}>
              {activePageData.map((vote) => (
                <div
                  key={vote.id}
                  className="rounded-lg p-3 border-2 text-center"
                  style={{
                    borderLeftWidth: '5px',
                    borderLeftColor: getReasonColor(vote.value),
                    backgroundColor: getReasonColor(vote.value) + '08',
                  }}
                >
                  <p className={`${reasonsPerPage === 4 ? 'text-xs' : 'text-sm'} text-gray-800 font-medium leading-relaxed`}>
                    &ldquo;{vote.reason}&rdquo;
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {vote.display_name && (
                      <span className="text-xs text-gray-500">— {vote.display_name}</span>
                    )}
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: getReasonColor(vote.value) + '20',
                        color: getReasonColor(vote.value),
                      }}
                    >
                      {vote.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 bg-gray-50 rounded-lg p-4 flex items-center justify-center min-h-0">
            {!hasSeparateProjection && !allRevealed ? (
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-2">Waiting for responses...</p>
                <p className="text-gray-500 text-3xl font-bold">{questionVotes.length}</p>
                <p className="text-gray-400 text-sm mt-1">vote{questionVotes.length !== 1 ? 's' : ''} received</p>
              </div>
            ) : (
              <div className="w-full">
                <BarChart
                  data={chartData}
                  totalVotes={questionVotes.length}
                  size="default"
                  theme="light"
                />
              </div>
            )}
          </div>
        </div>

        {/* Reasons panel (scrollable, right side) — only when results are shown */}
        {(hasSeparateProjection || allRevealed) && Object.keys(reasonsByOption).length > 0 && (
          <div className="w-80 shrink-0 flex flex-col min-h-0 border rounded-lg bg-white">
            <div className="flex items-center justify-between p-3 pb-2 shrink-0 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700">Reasons</h4>
              {allReasons.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 rounded overflow-hidden text-xs">
                    {([1, 2, 4] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => onReasonsPerPageChange(n)}
                        className={`px-1.5 py-0.5 font-medium transition-colors ${
                          reasonsPerPage === n
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title={`Show ${n} reason${n > 1 ? 's' : ''} at a time`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {playState !== 'idle' && (
                    <button
                      onClick={handleResetPlay}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                      title="Reset"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36" /></svg>
                    </button>
                  )}
                  <button
                    onClick={handlePlayReasons}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      playState === 'playing'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                  >
                    {playState === 'playing' ? (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        Pause
                      </>
                    ) : playState === 'paused' ? (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Resume
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Play
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 pt-2 space-y-3">
              {Object.entries(reasonsByOption).map(([option, votes]) => (
                <div key={option}>
                  <div
                    className="text-xs font-semibold text-gray-600 mb-2 px-2 py-1 rounded inline-block"
                    style={{
                      backgroundColor: getReasonColor(option) + '20',
                      borderLeft: `3px solid ${getReasonColor(option)}`,
                    }}
                  >
                    {option}
                  </div>
                  <div className="space-y-2">
                    {votes.map((vote) => {
                      const isViewed = viewedReasonIds.has(vote.id);
                      const isActive = reasonsPerPage > 1
                        ? activePageReasonIds.has(vote.id)
                        : highlightedReasonId === vote.id;
                      return (
                        <button
                          key={vote.id}
                          data-reason-id={vote.id}
                          onClick={() => {
                            if (reasonsPerPage > 1) {
                              // Snap to first reason on the group-aware page containing the clicked reason
                              const page = reasonPages.find((p) => p.some((v) => v.id === vote.id));
                              if (page) onHighlightReason(currentQuestion.id, page[0].id);
                            } else {
                              onHighlightReason(currentQuestion.id, vote.id);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                            isActive
                              ? 'border-indigo-600 bg-indigo-50'
                              : isViewed
                                ? 'border-transparent bg-green-50/60'
                                : 'border-transparent bg-gray-50 hover:bg-gray-100'
                          }`}
                          style={{
                            borderLeftWidth: '4px',
                            borderLeftColor: getReasonColor(vote.value),
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${isViewed && !isActive ? 'text-gray-500' : 'text-gray-800'}`}>{vote.reason}</p>
                              {vote.display_name && (
                                <p className="text-xs text-gray-500 mt-1">— {vote.display_name}</p>
                              )}
                            </div>
                            {isViewed && !isActive && (
                              <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Projection preview component
function ProjectionPreview({ item, fullSize }: { item: SessionItem; fullSize?: boolean }) {
  const { batches, questions } = useSessionStore();

  if (item.item_type === 'slide' && item.slide_image_path) {
    return (
      <div className={`w-full h-full ${fullSize ? '' : 'scale-50'} origin-center`}>
        <SlideDisplay imagePath={item.slide_image_path} caption={item.slide_caption} />
      </div>
    );
  }

  if (item.item_type === 'batch' && item.batch_id) {
    const batch = batches.find((b) => b.id === item.batch_id);
    const questionCount = questions.filter((q) => q.batch_id === item.batch_id).length;

    return (
      <div className="text-center px-4">
        <p className={`${fullSize ? 'text-2xl' : 'text-lg'} text-gray-400 mb-2`}>Batch Voting</p>
        <h3 className={`${fullSize ? 'text-5xl' : 'text-2xl'} font-bold text-white leading-tight`}>
          {batch?.name ?? 'Untitled Batch'}
        </h3>
        <p className={`${fullSize ? 'text-2xl' : 'text-lg'} text-gray-400 mt-2`}>
          {questionCount} Question{questionCount !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">Unknown item type</p>;
}
