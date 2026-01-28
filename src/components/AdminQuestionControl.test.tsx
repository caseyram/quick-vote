import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question, Vote } from '../types/database';

const mockUpdateQuestion = vi.fn();
const mockQuestions: Question[] = [];

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({ updateQuestion: mockUpdateQuestion, questions: mockQuestions })),
    {
      getState: vi.fn(() => ({
        questions: mockQuestions,
        updateQuestion: mockUpdateQuestion,
      })),
    }
  ),
}));

const mockEq2 = vi.fn().mockResolvedValue({ error: null });
const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

import AdminQuestionControl from './AdminQuestionControl';

const baseQuestion: Question = {
  id: 'q1', session_id: 's1', text: 'Test Q?', type: 'agree_disagree',
  options: null, position: 0, anonymous: true, status: 'pending',
  created_at: new Date().toISOString(),
};

const baseVotes: Vote[] = [
  { id: 'v1', question_id: 'q1', session_id: 's1', participant_id: 'p1', value: 'Agree', reason: null, display_name: null, locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'v2', question_id: 'q1', session_id: 's1', participant_id: 'p2', value: 'Disagree', reason: null, display_name: null, locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const channelRef = { current: { send: vi.fn() } };

describe('AdminQuestionControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders anonymous badge for anonymous questions', () => {
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]}
      />
    );
    expect(screen.getByText('Anonymous')).toBeDefined();
  });

  it('renders named badge for non-anonymous questions', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, anonymous: false }} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]}
      />
    );
    expect(screen.getByText('Named')).toBeDefined();
  });

  it('shows Start button and timer pills for pending questions', () => {
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]}
      />
    );
    expect(screen.getByText('Start')).toBeDefined();
    expect(screen.getByText('15s')).toBeDefined();
    expect(screen.getByText('30s')).toBeDefined();
    expect(screen.getByText('60s')).toBeDefined();
    expect(screen.getByText('No timer')).toBeDefined();
  });

  it('hides Start button when hideControls is true', () => {
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]} hideControls
      />
    );
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('calls onActivate prop when provided', () => {
    const onActivate = vi.fn();
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]} onActivate={onActivate}
      />
    );
    fireEvent.click(screen.getByText('Start'));
    expect(onActivate).toHaveBeenCalledWith('q1', null);
  });

  it('shows vote count and close button for active questions', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'active' }} sessionId="s1" isActive={true} isClosed={false}
        channelRef={channelRef as never} votes={baseVotes}
      />
    );
    expect(screen.getByText('2 votes cast')).toBeDefined();
    expect(screen.getByText('Close Voting')).toBeDefined();
    expect(screen.getByText('Show breakdown')).toBeDefined();
  });

  it('toggles breakdown view', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'active' }} sessionId="s1" isActive={true} isClosed={false}
        channelRef={channelRef as never} votes={baseVotes}
      />
    );
    fireEvent.click(screen.getByText('Show breakdown'));
    expect(screen.getByText('Show count')).toBeDefined();
  });

  it('calls onCloseVoting prop when provided', () => {
    const onCloseVoting = vi.fn();
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'active' }} sessionId="s1" isActive={true} isClosed={false}
        channelRef={channelRef as never} votes={baseVotes} onCloseVoting={onCloseVoting}
      />
    );
    fireEvent.click(screen.getByText('Close Voting'));
    expect(onCloseVoting).toHaveBeenCalledWith('q1');
  });

  it('shows bar chart for closed questions', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'closed' }} sessionId="s1" isActive={false} isClosed={true}
        channelRef={channelRef as never} votes={baseVotes}
      />
    );
    // Bar chart renders vote data
    expect(screen.getByText('Agree')).toBeDefined();
    expect(screen.getByText('Disagree')).toBeDefined();
  });

  it('shows No votes recorded when closed with no votes', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'closed' }} sessionId="s1" isActive={false} isClosed={true}
        channelRef={channelRef as never} votes={[]}
      />
    );
    expect(screen.getByText('No votes recorded')).toBeDefined();
  });

  it('shows voter details for named closed questions', () => {
    const namedVotes: Vote[] = [
      { id: 'v1', question_id: 'q1', session_id: 's1', participant_id: 'p1', value: 'Agree', reason: null, display_name: 'Alice', locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, anonymous: false, status: 'closed' }} sessionId="s1" isActive={false} isClosed={true}
        channelRef={channelRef as never} votes={namedVotes}
      />
    );
    expect(screen.getByText('Voter details')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('uses supabase to activate question when no onActivate prop', async () => {
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]}
      />
    );
    fireEvent.click(screen.getByText('Start'));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('singular vote text when one vote', () => {
    render(
      <AdminQuestionControl
        question={{ ...baseQuestion, status: 'active' }} sessionId="s1" isActive={true} isClosed={false}
        channelRef={channelRef as never} votes={[baseVotes[0]]}
      />
    );
    expect(screen.getByText('1 vote cast')).toBeDefined();
  });

  it('selects timer duration', () => {
    const onActivate = vi.fn();
    render(
      <AdminQuestionControl
        question={baseQuestion} sessionId="s1" isActive={false} isClosed={false}
        channelRef={channelRef as never} votes={[]} onActivate={onActivate}
      />
    );
    fireEvent.click(screen.getByText('30s'));
    fireEvent.click(screen.getByText('Start'));
    expect(onActivate).toHaveBeenCalledWith('q1', 30);
  });
});
