import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';
import type { SessionItem, Vote } from '../types/database';
import { useSessionStore } from '../stores/session-store';
import { useSequenceNavigation } from '../hooks/use-sequence-navigation';
import { SequenceManager } from './SequenceManager';
import { SlideDisplay } from './SlideDisplay';
import { ParticipantCount } from './ParticipantCount';
import { KeyboardShortcutHelp } from './KeyboardShortcutHelp';
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
  onExitPresentationMode: () => void;
}

export function PresentationControls({
  sessionId,
  sessionTitle,
  participantCount,
  connectionStatus,
  channelRef,
  sessionVotes,
  onActivateSequenceItem,
  onEndSession,
  onExitPresentationMode,
}: PresentationControlsProps) {
  const {
    sessionItems,
    activeSessionItemId,
    batches,
    questions,
    navigationDirection,
  } = useSessionStore();

  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // Use navigation hook for keyboard shortcuts
  const { currentIndex, canGoNext, canGoPrev, goNext, goPrev } = useSequenceNavigation({
    enabled: true,
    onActivateItem: onActivateSequenceItem,
  });

  const currentItem = currentIndex >= 0 ? sessionItems[currentIndex] : null;
  const nextItem = currentIndex >= 0 && currentIndex < sessionItems.length - 1
    ? sessionItems[currentIndex + 1]
    : null;

  function handleOpenPresentation() {
    const url = `${window.location.origin}/presentation/${sessionId}`;
    window.open(
      url,
      'QuickVotePresentation',
      'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
    );
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

  function handleShowShortcuts() {
    setShowShortcutHelp(true);
  }

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
      // Space, ArrowRight, ArrowLeft are already handled by useSequenceNavigation hook
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blackScreenActive, showShortcutHelp]);

  return (
    <div className="flex h-screen bg-white">
      {/* Left sidebar: Sequence list */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{sessionTitle}</h2>
            <button
              onClick={onExitPresentationMode}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              title="Exit presentation mode"
            >
              Exit
            </button>
          </div>
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
            onActivateItem={onActivateSequenceItem}
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

      {/* Center area: Current + Next preview */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex gap-6 mb-6 flex-1 min-h-0">
          {/* Current (live mirror) */}
          <div className="flex-1 flex flex-col min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Current (Live)</h2>
            <div className="flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden flex items-center justify-center">
              {currentItem ? (
                <ProjectionPreview item={currentItem} />
              ) : (
                <p className="text-gray-500 text-sm">No active item</p>
              )}
            </div>
          </div>

          {/* Next (preview) */}
          <div className="flex-1 flex flex-col min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Next</h2>
            <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              {nextItem ? (
                <ProjectionPreview item={nextItem} />
              ) : (
                <p className="text-gray-400 text-sm">End of sequence</p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 font-medium rounded-lg transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${sessionItems.length}` : 'No item selected'}
          </span>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right sidebar: QR + controls */}
      <div className="w-64 shrink-0 border-l border-gray-200 p-4 space-y-6">
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
            onClick={handleShowShortcuts}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Keyboard Shortcuts (?)
          </button>
        </div>
      </div>

      {/* Keyboard shortcut help overlay */}
      <KeyboardShortcutHelp
        visible={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />
    </div>
  );
}

// Mini projection preview component
function ProjectionPreview({ item }: { item: SessionItem }) {
  const { batches, questions } = useSessionStore();

  if (item.item_type === 'slide' && item.slide_image_path) {
    return (
      <div className="w-full h-full scale-50 origin-center">
        <SlideDisplay imagePath={item.slide_image_path} caption={item.slide_caption} />
      </div>
    );
  }

  if (item.item_type === 'batch' && item.batch_id) {
    const batch = batches.find((b) => b.id === item.batch_id);
    const questionCount = questions.filter((q) => q.batch_id === item.batch_id).length;

    return (
      <div className="text-center px-4">
        <p className="text-lg text-gray-400 mb-2">Batch Voting</p>
        <h3 className="text-2xl font-bold text-white leading-tight">
          {batch?.name ?? 'Untitled Batch'}
        </h3>
        <p className="text-lg text-gray-400 mt-2">
          {questionCount} Question{questionCount !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">Unknown item type</p>;
}
