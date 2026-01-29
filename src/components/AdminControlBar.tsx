import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { useSessionStore } from '../stores/session-store';
import type { Question, Batch } from '../types/database';
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
  // Batch props
  pendingBatchId?: string | null;
  onCloseBatch: () => void;
  batches?: Batch[];
  onActivateBatch?: (batchId: string, timerDuration: number | null) => void;
}

const statusBadgeColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  lobby: 'bg-blue-100 text-blue-800',
  active: 'bg-yellow-100 text-yellow-800',
  ended: 'bg-green-100 text-green-800',
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
  onCloseBatch,
  batches = [],
  onActivateBatch,
}: AdminControlBarProps) {
  const [timerDuration, setTimerDuration] = useState<number | null>(30); // Default to 30s
  const [barQuickText, setBarQuickText] = useState('');

  // Subscribe to activeBatchId for mode exclusion
  const activeBatchId = useSessionStore((state) => state.activeBatchId);
  const batchModeActive = activeBatchId !== null;

  const isDraft = status === 'draft';
  const isLobby = status === 'lobby';
  const isActive = status === 'active';
  const isEnded = status === 'ended';

  // Find the next pending unbatched question
  const pendingUnbatchedQuestions = questions.filter(
    (q) => q.status === 'pending' && q.batch_id === null
  );
  const activeIndex = activeQuestion
    ? questions.findIndex((q) => q.id === activeQuestion.id)
    : -1;

  // Filter existing batches that have questions and are still pending (can be activated)
  const activatableBatches = batches.filter((b) => {
    const batchQuestions = questions.filter((q) => q.batch_id === b.id);
    return b.status === 'pending' && batchQuestions.length > 0 && b.id !== pendingBatchId;
  });

  // Compute the "next item" to activate - sorted by position
  // This interleaves unbatched questions and batches
  type NextItem =
    | { type: 'question'; question: Question; position: number }
    | { type: 'batch'; batch: Batch; position: number; questionCount: number };

  const nextItems: NextItem[] = [];

  // Add unbatched pending questions
  for (const q of pendingUnbatchedQuestions) {
    nextItems.push({ type: 'question', question: q, position: q.position });
  }

  // Add activatable batches
  for (const b of activatableBatches) {
    const batchQuestions = questions.filter((q) => q.batch_id === b.id);
    nextItems.push({ type: 'batch', batch: b, position: b.position, questionCount: batchQuestions.length });
  }

  // Sort by position
  nextItems.sort((a, b) => a.position - b.position);

  const nextItem = nextItems[0] ?? null;
  const hasNextItem = nextItem !== null;

  function handleBarQuickSubmit() {
    if (!barQuickText.trim() || quickQuestionLoading) return;
    onQuickQuestion(barQuickText, timerDuration);
    setBarQuickText('');
  }

  function handleActivateNext() {
    if (!nextItem) return;
    if (nextItem.type === 'question') {
      onActivateQuestion(nextItem.question.id, timerDuration);
    } else if (nextItem.type === 'batch' && onActivateBatch) {
      onActivateBatch(nextItem.batch.id, timerDuration);
    }
  }

  // Get display label for next item
  function getNextItemLabel(): string {
    if (!nextItem) return 'Activate';
    if (nextItem.type === 'question') {
      const qIndex = questions.findIndex((q) => q.id === nextItem.question.id) + 1;
      return `Activate Q${qIndex}`;
    } else {
      return `Activate "${nextItem.batch.name}" (${nextItem.questionCount}Q)`;
    }
  }

  return (
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
              ) : (
                /* Simplified: Timer + Quick input + Activate Next (batch or question) */
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Timer selection pills - for quick questions and single question activation */}
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

                  {/* Quick question input */}
                  <input
                    type="text"
                    value={barQuickText}
                    onChange={(e) => setBarQuickText(e.target.value)}
                    placeholder="Type a question..."
                    className="flex-1 min-w-0 px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && barQuickText.trim()) {
                        e.preventDefault();
                        handleBarQuickSubmit();
                      }
                    }}
                  />

                  {/* Go Live button - creates and activates quick question */}
                  <button
                    onClick={handleBarQuickSubmit}
                    disabled={!barQuickText.trim() || quickQuestionLoading}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    {quickQuestionLoading ? 'Going...' : 'Go Live'}
                  </button>

                  {/* Activate Next button - activates next pending item (batch or question) */}
                  {hasNextItem && (
                    <button
                      onClick={handleActivateNext}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                    >
                      {getNextItemLabel()}
                    </button>
                  )}
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
  );
}
