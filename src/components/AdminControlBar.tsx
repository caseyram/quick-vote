import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { useSessionStore } from '../stores/session-store';
import type { Question } from '../types/database';
import type { SessionStatus } from '../types/database';

interface AdminControlBarProps {
  status: SessionStatus;
  participantCount: number;
  questions: Question[];
  activeQuestion: Question | null;
  countdownRemaining: number;
  countdownRunning: boolean;
  transitioning: boolean;
  onStartSession: () => void;
  onBeginVoting: () => void;
  onEndSession: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onActivateQuestion: (questionId: string, timerDuration: number | null) => void;
  onCloseVoting: (questionId: string) => void;
  onQuickQuestion: (text: string, timerDuration: number | null) => void;
  quickQuestionLoading: boolean;
  // Pending batch props
  pendingBatchId: string | null;
  pendingBatchQuestions: Question[];
  onAddToBatch: (text: string) => void;
  onActivatePendingBatch: () => void;
  onClearPendingBatch: () => void;
  onRemoveFromBatch: (questionId: string) => void;
  onCloseBatch: () => void;
}

const statusBadgeColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  lobby: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  ended: 'bg-red-100 text-red-800',
};

const timerOptions = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: 'None', value: null },
] as const;

export function AdminControlBar({
  status,
  participantCount,
  questions,
  activeQuestion,
  countdownRemaining,
  countdownRunning,
  transitioning,
  onStartSession,
  onBeginVoting,
  onEndSession,
  onCopyLink,
  copied,
  onActivateQuestion,
  onCloseVoting,
  onQuickQuestion,
  quickQuestionLoading,
  pendingBatchId,
  pendingBatchQuestions,
  onAddToBatch,
  onActivatePendingBatch,
  onClearPendingBatch,
  onRemoveFromBatch,
  onCloseBatch,
}: AdminControlBarProps) {
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [barQuickText, setBarQuickText] = useState('');
  const [batchListExpanded, setBatchListExpanded] = useState(false);

  // Subscribe to activeBatchId for mode exclusion
  const activeBatchId = useSessionStore((state) => state.activeBatchId);
  const batchModeActive = activeBatchId !== null;

  const isDraft = status === 'draft';
  const isLobby = status === 'lobby';
  const isActive = status === 'active';
  const isEnded = status === 'ended';

  // Find the next pending question for activation (excluding pending batch questions)
  const pendingQuestions = questions.filter(
    (q) => q.status === 'pending' && q.batch_id !== pendingBatchId
  );
  const activeIndex = activeQuestion
    ? questions.findIndex((q) => q.id === activeQuestion.id)
    : -1;
  const nextPending = pendingQuestions[0] ?? null;

  const hasPendingBatch = pendingBatchQuestions.length > 0;

  function handleBarQuickSubmit() {
    if (!barQuickText.trim() || quickQuestionLoading) return;
    onQuickQuestion(barQuickText, timerDuration);
    setBarQuickText('');
  }

  function handleAddToBatchSubmit() {
    if (!barQuickText.trim()) return;
    onAddToBatch(barQuickText);
    setBarQuickText('');
  }

  function handleGoLive() {
    if (hasPendingBatch) {
      // Activate the pending batch
      onActivatePendingBatch();
    } else if (barQuickText.trim()) {
      // Single question go live
      handleBarQuickSubmit();
    }
  }

  return (
    <>
      {/* Pending batch dropdown - appears above the control bar */}
      {batchListExpanded && hasPendingBatch && (
        <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-[60] max-h-64 overflow-y-auto">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Batch Questions ({pendingBatchQuestions.length})
            </span>
            <button
              onClick={onClearPendingBatch}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingBatchQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="px-4 py-2 flex items-center justify-between hover:bg-gray-50"
              >
                <span className="text-sm text-gray-700 truncate flex-1">
                  <span className="text-gray-400 font-mono mr-2">{idx + 1}.</span>
                  {q.text}
                </span>
                <button
                  onClick={() => onRemoveFromBatch(q.id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove from batch"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 shadow-sm z-40 flex items-center px-4 gap-3">
        {/* Left: Status badge + count */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusBadgeColors[status] ?? 'bg-gray-200 text-gray-700'
            }`}
          >
            {status}
          </span>
          {(isLobby || isActive) && (
            <span className="text-xs text-gray-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 align-middle" />
              {participantCount}
            </span>
          )}
        </div>

        {/* Center content - varies by state */}
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          {isDraft && (
            <span className="text-sm text-gray-500 truncate">
              Add questions, then start
            </span>
          )}

          {isLobby && (
            <button
              onClick={onCopyLink}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          )}

          {isActive && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeQuestion ? (
                <>
                  {/* Current question info */}
                  <span className="text-xs text-gray-400 shrink-0">
                    Q{activeIndex + 1}:
                  </span>
                  <span className="text-sm text-gray-700 truncate max-w-[200px]">
                    &ldquo;{activeQuestion.text}&rdquo;
                  </span>

                  {/* Countdown */}
                  <CountdownTimer
                    remainingSeconds={Math.ceil(countdownRemaining / 1000)}
                    isRunning={countdownRunning}
                    theme="light"
                  />

                  {/* Close voting button */}
                  <button
                    onClick={() => onCloseVoting(activeQuestion.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    Close Voting
                  </button>
                </>
              ) : batchModeActive ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Batch voting in progress
                  </span>
                  <button
                    onClick={onCloseBatch}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Close Batch
                  </button>
                </div>
              ) : nextPending && !hasPendingBatch ? (
                <>
                  {/* Timer selection pills */}
                  <div className="flex items-center gap-1 shrink-0">
                    {timerOptions.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setTimerDuration(opt.value)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          timerDuration === opt.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Activate next question */}
                  <button
                    onClick={() => onActivateQuestion(nextPending.id, timerDuration)}
                    className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors shrink-0 bg-green-600 hover:bg-green-500"
                  >
                    Activate Q{questions.findIndex((q) => q.id === nextPending.id) + 1}
                  </button>
                </>
              ) : (
                /* Quick question input with Add to Batch option */
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Pending batch indicator */}
                  {hasPendingBatch && (
                    <button
                      onClick={() => setBatchListExpanded(!batchListExpanded)}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {pendingBatchQuestions.length} in batch
                      <svg
                        className={`w-3 h-3 transition-transform ${batchListExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  )}

                  <input
                    type="text"
                    value={barQuickText}
                    onChange={(e) => setBarQuickText(e.target.value)}
                    placeholder="Type a question..."
                    className="flex-1 min-w-0 px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && barQuickText.trim()) {
                        e.preventDefault();
                        // If we have a batch, add to batch; otherwise go live
                        if (hasPendingBatch) {
                          handleAddToBatchSubmit();
                        } else {
                          handleBarQuickSubmit();
                        }
                      }
                    }}
                  />

                  {/* Add to Batch button */}
                  <button
                    onClick={handleAddToBatchSubmit}
                    disabled={!barQuickText.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                    title="Add question to batch"
                  >
                    + Batch
                  </button>

                  {/* Go Live button */}
                  <button
                    onClick={handleGoLive}
                    disabled={(!barQuickText.trim() && !hasPendingBatch) || quickQuestionLoading}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    {quickQuestionLoading
                      ? 'Going...'
                      : hasPendingBatch
                        ? 'Go Live'
                        : 'Go Live'}
                  </button>
                </div>
              )}
            </div>
          )}

          {isEnded && (
            <span className="text-sm text-gray-500 font-medium">Session Complete</span>
          )}
        </div>

        {/* Right: Primary action */}
        <div className="shrink-0">
          {isDraft && (
            <button
              onClick={onStartSession}
              disabled={transitioning}
              className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {transitioning ? 'Starting...' : 'Start Session'}
            </button>
          )}

          {isLobby && (
            <button
              onClick={onBeginVoting}
              disabled={transitioning}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {transitioning ? 'Starting...' : 'Begin Voting'}
            </button>
          )}

          {isActive && (
            <button
              onClick={onEndSession}
              disabled={transitioning}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-red-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {transitioning ? 'Ending...' : 'End Session'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
