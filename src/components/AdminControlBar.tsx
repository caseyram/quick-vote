import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';
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
}: AdminControlBarProps) {
  const [timerDuration, setTimerDuration] = useState<number | null>(null);

  const isDraft = status === 'draft';
  const isLobby = status === 'lobby';
  const isActive = status === 'active';
  const isEnded = status === 'ended';

  // Find the next pending question for activation
  const pendingQuestions = questions.filter((q) => q.status === 'pending');
  const activeIndex = activeQuestion
    ? questions.findIndex((q) => q.id === activeQuestion.id)
    : -1;
  const nextPending = pendingQuestions[0] ?? null;

  // Navigation: find prev/next question relative to the active one
  const closedOrRevealed = questions.filter(
    (q) => q.status === 'closed' || q.status === 'revealed'
  );

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
          <div className="flex items-center gap-2 min-w-0">
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
            ) : nextPending ? (
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
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                >
                  Activate Q{questions.findIndex((q) => q.id === nextPending.id) + 1}
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-400">
                {closedOrRevealed.length === questions.length
                  ? 'All questions completed'
                  : 'Select a question to activate'}
              </span>
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
