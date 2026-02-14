import type { SessionStatus } from '../types/database';

interface AdminControlBarProps {
  status: SessionStatus;
  participantCount: number;
  transitioning: boolean;
  onStartSession: () => void;
  onBeginVoting: () => void;
  onCopyLink: () => void;
  copied: boolean;
}

const statusBadgeColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  lobby: 'bg-blue-100 text-blue-800',
  active: 'bg-yellow-100 text-yellow-800',
  ended: 'bg-green-100 text-green-800',
};

export function AdminControlBar({
  status,
  participantCount,
  transitioning,
  onStartSession,
  onBeginVoting,
  onCopyLink,
  copied,
}: AdminControlBarProps) {
  const isDraft = status === 'draft';
  const isLobby = status === 'lobby';
  const isEnded = status === 'ended';

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
          {isLobby && (
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
      </div>
    </div>
  );
}
