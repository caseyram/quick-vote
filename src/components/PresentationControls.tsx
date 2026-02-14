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
  } = useSessionStore();

  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [highlightedReasonId, setHighlightedReasonId] = useState<string | null>(null);
  const [currentBatchQuestionIndex, setCurrentBatchQuestionIndex] = useState(0);
  const [timerDuration, setTimerDuration] = useState<number | null>(30);
  const [quickText, setQuickText] = useState('');
  const [showNextPreview, setShowNextPreview] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward' | null>(null);
  const [qrExpanded, setQrExpanded] = useState(false);
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
  }, [blackScreenActive, showShortcutHelp]);

  const isBatchActive = currentItem?.item_type === 'batch' && currentItem.batch_id;

  return (
    <div className="flex h-screen bg-white">
      {/* Left sidebar: Sequence list */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{sessionTitle}</h2>
          <button
            onClick={handleOpenPresentation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Open Presentation
          </button>
        </div>
        <div className="p-4">
          <SequenceManager
            sessionId={sessionId}
            onExpandBatch={() => {}}
            onCreateBatch={async () => undefined}
            onDeleteBatch={() => {}}
            onDeleteSlide={() => {}}
            isLive={true}
            activeSessionItemId={activeSessionItemId}
            onActivateItem={handleActivateItem}
          />
        </div>
        <div className="p-4 border-t border-gray-200">
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
        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {isBatchActive ? (
            <div className="h-full p-6">
              <BatchControlPanel
                batchId={currentItem.batch_id!}
                questions={questions}
                sessionVotes={sessionVotes}
                revealedQuestions={revealedQuestions}
                highlightedReasonId={highlightedReasonId}
                currentBatchQuestionIndex={currentBatchQuestionIndex}
                onSetCurrentBatchQuestionIndex={setCurrentBatchQuestionIndex}
                onRevealQuestion={handleRevealQuestion}
                onHighlightReason={handleHighlightReason}
                hasSeparateProjection={showNextPreview}
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
              {qrExpanded ? (
                <div
                  className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => setQrExpanded(false)}
                >
                  <QRCodeSVG value={participantUrl} size={400} level="M" marginSize={1} />
                  <p className="text-2xl text-gray-600 text-center mt-6 font-medium">Scan to join</p>
                  <p className="text-sm text-gray-400 mt-2">Click anywhere to close</p>
                </div>
              ) : (
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
  onSetCurrentBatchQuestionIndex,
  onRevealQuestion,
  onHighlightReason,
}: {
  batchId: string;
  questions: any[];
  sessionVotes: Record<string, Vote[]>;
  revealedQuestions: Set<string>;
  highlightedReasonId: string | null;
  currentBatchQuestionIndex: number;
  onSetCurrentBatchQuestionIndex: (index: number) => void;
  onRevealQuestion: (questionId: string) => void;
  onHighlightReason: (questionId: string, reasonId: string) => void;
  hasSeparateProjection: boolean;
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
  const aggregated = aggregateVotes(questionVotes);
  const barData = buildConsistentBarData(currentQuestion, aggregated);

  const chartData = barData.map((item, index) => {
    let color: string;
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        Agree: AGREE_DISAGREE_COLORS.agree,
        Sometimes: AGREE_DISAGREE_COLORS.sometimes,
        Disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      color = colorMap[item.value] || MULTI_CHOICE_COLORS[0];
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
        Agree: AGREE_DISAGREE_COLORS.agree,
        Sometimes: AGREE_DISAGREE_COLORS.sometimes,
        Disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      return colorMap[voteValue] || MULTI_CHOICE_COLORS[0];
    } else {
      const optionIndex = currentQuestion.options?.indexOf(voteValue) ?? -1;
      return MULTI_CHOICE_COLORS[optionIndex % MULTI_CHOICE_COLORS.length];
    }
  };

  const reasonsByOption: Record<string, Vote[]> = {};
  questionVotes.forEach((vote) => {
    if (vote.reason && vote.reason.trim()) {
      if (!reasonsByOption[vote.value]) {
        reasonsByOption[vote.value] = [];
      }
      reasonsByOption[vote.value].push(vote);
    }
  });

  const isRevealed = revealedQuestions.has(currentQuestion.id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {batchQuestions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => onSetCurrentBatchQuestionIndex(idx)}
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

      <div className="flex-1 overflow-y-auto border rounded-lg bg-white p-4 space-y-4 min-h-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{currentQuestion.text}</h3>
          <button
            onClick={() => onRevealQuestion(currentQuestion.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRevealed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRevealed
              ? (hasSeparateProjection ? 'Revealed to Audience' : 'Results Shown')
              : (hasSeparateProjection ? 'Reveal to Audience' : 'Show Results')}
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <BarChart
            data={chartData}
            totalVotes={questionVotes.length}
            size="default"
            theme="light"
          />
        </div>

        {Object.keys(reasonsByOption).length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Reasons</h4>
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
                  {votes.map((vote) => (
                    <button
                      key={vote.id}
                      onClick={() => onHighlightReason(currentQuestion.id, vote.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        highlightedReasonId === vote.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100'
                      }`}
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: getReasonColor(vote.value),
                      }}
                    >
                      <p className="text-sm text-gray-800">{vote.reason}</p>
                      {vote.display_name && (
                        <p className="text-xs text-gray-500 mt-1">— {vote.display_name}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
