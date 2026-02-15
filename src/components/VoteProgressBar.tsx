import type { Vote } from '../types/database';

interface VoteProgressBarProps {
  batchQuestionIds: string[];
  sessionVotes: Record<string, Vote[]>;
  participantCount: number;
}

export function VoteProgressBar({
  batchQuestionIds,
  sessionVotes,
  participantCount,
}: VoteProgressBarProps) {
  // Calculate total votes across all batch questions
  const totalVotes = batchQuestionIds.reduce(
    (sum, qId) => sum + (sessionVotes[qId]?.length || 0),
    0
  );

  // Calculate expected votes
  const totalExpected = batchQuestionIds.length * participantCount;

  // Guard against division by zero
  const percent = totalExpected === 0 ? 0 : Math.min(100, (totalVotes / totalExpected) * 100);

  // Check if all questions have complete votes
  const allComplete =
    participantCount > 0 &&
    batchQuestionIds.every(
      (qId) => (sessionVotes[qId]?.length || 0) >= participantCount
    );

  // Bar color: green when complete, blue otherwise
  const barColor = allComplete ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2 mt-1">
      {/* Progress bar */}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Vote count */}
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
        {totalVotes}/{totalExpected}
      </span>
    </div>
  );
}
