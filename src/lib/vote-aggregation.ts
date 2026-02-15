import type { Vote, Question } from '../types/database';

export interface VoteCount {
  value: string;
  count: number;
  percentage: number;
}

export function aggregateVotes(votes: Vote[], teamFilter?: string | null): VoteCount[] {
  // Filter votes by team if teamFilter is provided
  const filteredVotes = teamFilter ? votes.filter(v => v.team_id === teamFilter) : votes;
  const total = filteredVotes.length;

  const counts = filteredVotes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.value] = (acc[vote.value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([value, count]) => ({
    value,
    count,
    percentage: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

/**
 * Returns count of unique participants for the given votes, optionally filtered by team.
 */
export function getTeamParticipantCount(votes: Vote[], teamFilter?: string | null): number {
  const filteredVotes = teamFilter ? votes.filter(v => v.team_id === teamFilter) : votes;
  return new Set(filteredVotes.map(v => v.participant_id)).size;
}

/**
 * Builds bar data with consistent column ordering.
 * For agree_disagree: always [Agree, Sometimes, Disagree]
 * For multiple_choice: uses templateOptions if provided, else question.options order (as authored)
 */
export function buildConsistentBarData(
  question: Question,
  aggregated: VoteCount[],
  templateOptions?: string[]
): VoteCount[] {
  // Define expected order based on question type
  let expectedOrder: string[];

  if (question.type === 'agree_disagree') {
    expectedOrder = ['Agree', 'Sometimes', 'Disagree'];
  } else if (templateOptions && templateOptions.length > 0) {
    expectedOrder = templateOptions;
  } else if (question.options && Array.isArray(question.options)) {
    // Use authored order for multiple choice
    expectedOrder = question.options;
  } else {
    // Fallback: return as-is
    return aggregated;
  }

  const totalVotes = aggregated.reduce((sum, vc) => sum + vc.count, 0);

  // Sort aggregated results to match expected order
  // Include items even if they have 0 votes (for consistent columns)
  // Sum all case-insensitive matches to handle mixed-case data (e.g. 'Agree' + 'agree')
  return expectedOrder.map(value => {
    const matches = aggregated.filter(
      vc => vc.value.toLowerCase() === value.toLowerCase()
    );
    const count = matches.reduce((sum, m) => sum + m.count, 0);
    return {
      value,
      count,
      percentage: totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100),
    };
  });
}
