import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProgressDashboard } from './ProgressDashboard';

describe('ProgressDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders progress bar and participant counts', () => {
    render(
      <ProgressDashboard
        questionIds={['q1', 'q2', 'q3']}
        participantCount={10}
        voteCounts={{ q1: 5, q2: 3, q3: 2 }}
      />
    );

    // Total votes = 10, with 3 questions, completed = floor(10/3) = 3
    expect(screen.getByText('3/10 complete')).toBeDefined();
    expect(screen.getByText('Completed: 3')).toBeDefined();
    expect(screen.getByText('In progress: 7')).toBeDefined();
  });

  it('renders question labels Q1, Q2, Q3', () => {
    render(
      <ProgressDashboard
        questionIds={['q1', 'q2', 'q3']}
        participantCount={5}
        voteCounts={{ q1: 2, q2: 3, q3: 1 }}
      />
    );

    expect(screen.getByText('Q1')).toBeDefined();
    expect(screen.getByText('Q2')).toBeDefined();
    expect(screen.getByText('Q3')).toBeDefined();
  });

  it('shows vote counts per question', () => {
    render(
      <ProgressDashboard
        questionIds={['q1', 'q2']}
        participantCount={10}
        voteCounts={{ q1: 7, q2: 4 }}
      />
    );

    // Vote counts are shown under each mini bar
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('handles zero participants gracefully', () => {
    render(
      <ProgressDashboard
        questionIds={['q1']}
        participantCount={0}
        voteCounts={{ q1: 0 }}
      />
    );

    expect(screen.getByText('0/0 complete')).toBeDefined();
    expect(screen.getByText('Completed: 0')).toBeDefined();
    expect(screen.getByText('In progress: 0')).toBeDefined();
  });

  it('handles empty question list', () => {
    render(
      <ProgressDashboard
        questionIds={[]}
        participantCount={5}
        voteCounts={{}}
      />
    );

    // With no questions, completed = 0
    expect(screen.getByText('0/5 complete')).toBeDefined();
  });

  it('handles missing vote counts for questions', () => {
    render(
      <ProgressDashboard
        questionIds={['q1', 'q2']}
        participantCount={5}
        voteCounts={{ q1: 3 }} // q2 has no votes
      />
    );

    // q2 should show 0 votes
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('0')).toBeDefined();
  });

  it('triggers pulse animation when total votes increase', async () => {
    const { rerender } = render(
      <ProgressDashboard
        questionIds={['q1']}
        participantCount={10}
        voteCounts={{ q1: 5 }}
      />
    );

    // Increase votes
    rerender(
      <ProgressDashboard
        questionIds={['q1']}
        participantCount={10}
        voteCounts={{ q1: 6 }}
      />
    );

    // The pulse animation should be applied
    // After 600ms it should be removed
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Component should still render correctly after animation
    expect(screen.getByText('Completed: 6')).toBeDefined();
  });

  it('calculates 100% progress when all participants complete', () => {
    render(
      <ProgressDashboard
        questionIds={['q1', 'q2']}
        participantCount={5}
        voteCounts={{ q1: 5, q2: 5 }}
      />
    );

    // 10 total votes, 2 questions, completed = 5 = participantCount
    expect(screen.getByText('5/5 complete')).toBeDefined();
  });
});
