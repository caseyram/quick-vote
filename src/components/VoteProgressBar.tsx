import type { Vote } from '../types/database';

interface VoteProgressBarProps {
  batchQuestionIds: string[];
  sessionVotes: Record<string, Vote[]>;
  participantCount: number;
  liveParticipantCount?: number;
}

/**
 * Count participants who have submitted the batch — meaning they have at least
 * one vote for any question in the batch. Partial submissions count because
 * once a participant hits Submit they cannot return to answer skipped questions.
 */
function countCompletedParticipants(
  batchQuestionIds: string[],
  sessionVotes: Record<string, Vote[]>
): number {
  if (batchQuestionIds.length === 0) return 0;

  const submitted = new Set<string>();
  for (const qId of batchQuestionIds) {
    for (const vote of sessionVotes[qId] ?? []) {
      submitted.add(vote.participant_id);
    }
  }
  return submitted.size;
}

/**
 * Count unique participant IDs across all session votes.
 * Used as a more accurate denominator than presence-based peak count,
 * which can be inflated by admin/presentation views.
 */
function countUniqueVoters(sessionVotes: Record<string, Vote[]>): number {
  const ids = new Set<string>();
  for (const votes of Object.values(sessionVotes)) {
    for (const vote of votes) {
      ids.add(vote.participant_id);
    }
  }
  return ids.size;
}

export { countCompletedParticipants, countUniqueVoters };

export function VoteProgressBar({
  batchQuestionIds,
  sessionVotes,
  participantCount,
  liveParticipantCount,
}: VoteProgressBarProps) {
  const completed = countCompletedParticipants(batchQuestionIds, sessionVotes);

  // Use unique voters from sessionVotes as denominator when available (more
  // accurate than presence-based peak which can include admin/presentation).
  // Fall back to presence count before any votes have been cast.
  const uniqueVoters = countUniqueVoters(sessionVotes);
  const denominator = uniqueVoters > 0 ? uniqueVoters : participantCount;

  // Guard against division by zero
  const percent = denominator === 0 ? 0 : Math.min(100, (completed / denominator) * 100);

  const allComplete = denominator > 0 && completed >= denominator;

  // Bar color: green when complete, blue otherwise
  const barColor = allComplete ? 'bg-green-500' : 'bg-blue-500';

  const showDropoff = liveParticipantCount !== undefined && liveParticipantCount < denominator;

  return (
    <div className="flex items-center gap-2 mt-1">
      {/* Progress bar */}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Participant completion count */}
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
        {completed}/{denominator} done
        {showDropoff && (
          <span className="text-gray-400"> · {liveParticipantCount} connected</span>
        )}
      </span>
    </div>
  );
}
