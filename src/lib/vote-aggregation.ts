import type { Vote } from '../types/database';

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
