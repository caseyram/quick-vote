import type { Vote } from '../types/database';

interface VoteProgressBarProps {
  batchQuestionIds: string[];
  sessionVotes: Record<string, Vote[]>;
  participantCount: number;
  liveParticipantCount?: number;
}

/**
 * Count participants who have submitted votes for ALL questions in the batch.
 */
function countCompletedParticipants(
  batchQuestionIds: string[],
  sessionVotes: Record<string, Vote[]>
): number {
  if (batchQuestionIds.length === 0) return 0;

  // Build a map: participantId -> set of questionIds they've answered
  const participantQuestions = new Map<string, Set<string>>();
  for (const qId of batchQuestionIds) {
    const votes = sessionVotes[qId] ?? [];
    for (const vote of votes) {
      let qs = participantQuestions.get(vote.participant_id);
      if (!qs) {
        qs = new Set();
        participantQuestions.set(vote.participant_id, qs);
      }
      qs.add(qId);
    }
  }

  // A participant is "done" when they've answered every question
  const total = batchQuestionIds.length;
  let completed = 0;
  for (const qs of participantQuestions.values()) {
    if (qs.size >= total) completed++;
  }
  return completed;
}

export { countCompletedParticipants };

export function VoteProgressBar({
  batchQuestionIds,
  sessionVotes,
  participantCount,
  liveParticipantCount,
}: VoteProgressBarProps) {
  const completed = countCompletedParticipants(batchQuestionIds, sessionVotes);

  // Guard against division by zero
  const percent = participantCount === 0 ? 0 : Math.min(100, (completed / participantCount) * 100);

  const allComplete = participantCount > 0 && completed >= participantCount;

  // Bar color: green when complete, blue otherwise
  const barColor = allComplete ? 'bg-green-500' : 'bg-blue-500';

  const showDropoff = liveParticipantCount !== undefined && liveParticipantCount < participantCount;

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
        {completed}/{participantCount} done
        {showDropoff && (
          <span className="text-gray-400"> · {liveParticipantCount} connected</span>
        )}
      </span>
    </div>
  );
}
