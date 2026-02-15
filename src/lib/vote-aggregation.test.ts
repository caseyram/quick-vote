import { describe, it, expect } from 'vitest';
import { aggregateVotes } from './vote-aggregation';
import type { Vote } from '../types/database';

function makeVote(value: string, overrides: Partial<Vote> = {}): Vote {
  return {
    id: crypto.randomUUID(),
    question_id: 'q1',
    session_id: 's1',
    participant_id: 'p1',
    value,
    reason: null,
    display_name: null,
    team_id: null,
    locked_in: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('aggregateVotes', () => {
  it('returns empty array for no votes', () => {
    expect(aggregateVotes([])).toEqual([]);
  });

  it('aggregates a single vote at 100%', () => {
    const result = aggregateVotes([makeVote('agree')]);
    expect(result).toEqual([{ value: 'agree', count: 1, percentage: 100 }]);
  });

  it('aggregates multiple votes with same value', () => {
    const votes = [makeVote('agree'), makeVote('agree'), makeVote('agree')];
    const result = aggregateVotes(votes);
    expect(result).toEqual([{ value: 'agree', count: 3, percentage: 100 }]);
  });

  it('aggregates votes with different values', () => {
    const votes = [makeVote('agree'), makeVote('disagree'), makeVote('agree')];
    const result = aggregateVotes(votes);
    expect(result).toHaveLength(2);

    const agree = result.find((r) => r.value === 'agree');
    const disagree = result.find((r) => r.value === 'disagree');

    expect(agree).toEqual({ value: 'agree', count: 2, percentage: 67 });
    expect(disagree).toEqual({ value: 'disagree', count: 1, percentage: 33 });
  });

  it('rounds percentages correctly', () => {
    const votes = [makeVote('a'), makeVote('b'), makeVote('c')];
    const result = aggregateVotes(votes);
    // Each should be 33% (33.33 rounded)
    for (const r of result) {
      expect(r.percentage).toBe(33);
    }
  });

  it('handles many different values', () => {
    const votes = [
      makeVote('opt1'),
      makeVote('opt2'),
      makeVote('opt3'),
      makeVote('opt4'),
    ];
    const result = aggregateVotes(votes);
    expect(result).toHaveLength(4);
    for (const r of result) {
      expect(r.count).toBe(1);
      expect(r.percentage).toBe(25);
    }
  });

  it('handles sometimes value for agree/disagree', () => {
    const votes = [
      makeVote('agree'),
      makeVote('disagree'),
      makeVote('sometimes'),
      makeVote('sometimes'),
    ];
    const result = aggregateVotes(votes);
    expect(result).toHaveLength(3);
    const sometimes = result.find((r) => r.value === 'sometimes');
    expect(sometimes).toEqual({ value: 'sometimes', count: 2, percentage: 50 });
  });
});
