import type { VoteType } from '../../types/database';
import { AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../BarChart';

export const MOCK_PARTICIPANT_COUNT = 12;
export const MOCK_TOTAL_VOTES = 25;

export interface BarChartData {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Generate deterministic mock vote data for preview purposes.
 * Returns fixed vote distributions with appropriate colors.
 */
export function generateMockVotes(
  questionType: VoteType,
  options: string[] | null
): BarChartData[] {
  if (questionType === 'agree_disagree') {
    return [
      {
        label: 'Agree',
        count: 15,
        percentage: 60,
        color: AGREE_DISAGREE_COLORS.agree,
      },
      {
        label: 'Sometimes',
        count: 4,
        percentage: 16,
        color: AGREE_DISAGREE_COLORS.sometimes,
      },
      {
        label: 'Disagree',
        count: 6,
        percentage: 24,
        color: AGREE_DISAGREE_COLORS.disagree,
      },
    ];
  }

  // multiple_choice
  if (!options || options.length === 0) {
    return [];
  }

  // Distribute 25 votes across options with decreasing percentages
  // First option gets ~35%, second ~25%, then decreasing
  const distributions = [35, 25, 18, 12, 7, 3];
  let remainingVotes = MOCK_TOTAL_VOTES;
  let remainingPercentage = 100;

  const result: BarChartData[] = options.map((option, index) => {
    const isLast = index === options.length - 1;

    // For the last option, use remaining votes/percentage
    if (isLast) {
      return {
        label: option,
        count: remainingVotes,
        percentage: remainingPercentage,
        color: MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length],
      };
    }

    // Use predetermined distribution percentage, or fallback to equal distribution
    const targetPercentage = distributions[index] ?? Math.floor(100 / options.length);
    const count = Math.round((targetPercentage / 100) * MOCK_TOTAL_VOTES);

    remainingVotes -= count;
    remainingPercentage -= targetPercentage;

    return {
      label: option,
      count,
      percentage: targetPercentage,
      color: MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length],
    };
  });

  return result;
}
