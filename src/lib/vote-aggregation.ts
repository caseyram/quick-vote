import type { Vote, Question } from '../types/database';

export interface VoteCount {
  value: string;
  count: number;
  percentage: number;
}

export function aggregateVotes(votes: Vote[]): VoteCount[] {
  const total = votes.length;

  const counts = votes.reduce<Record<string, number>>((acc, vote) => {
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
 * Builds bar data with consistent column ordering.
 * For agree_disagree: always [Agree, Sometimes, Disagree]
 * For multiple_choice: uses question.options order (as authored)
 */
export function buildConsistentBarData(
  question: Question,
  aggregated: VoteCount[]
): VoteCount[] {
  // Define expected order based on question type
  let expectedOrder: string[];

  if (question.type === 'agree_disagree') {
    expectedOrder = ['Agree', 'Sometimes', 'Disagree'];
  } else if (question.options && Array.isArray(question.options)) {
    // Use authored order for multiple choice
    expectedOrder = question.options;
  } else {
    // Fallback: return as-is
    return aggregated;
  }

  // Sort aggregated results to match expected order
  // Include items even if they have 0 votes (for consistent columns)
  return expectedOrder.map(value => {
    const found = aggregated.find(
      vc => vc.value.toLowerCase() === value.toLowerCase()
    );
    return found || {
      value,
      count: 0,
      percentage: 0
    };
  });
}
