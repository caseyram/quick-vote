import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question } from '../types/database';

// Mock supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'v1', value: 'Option A' }, error: null });
const mockSelectChain = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectChain });

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
      upsert: mockUpsert,
    })),
  },
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    button: ({ children, onClick, className, style }: React.ComponentProps<'button'>) => (
      <button onClick={onClick} className={className as string} style={style as React.CSSProperties}>{children}</button>
    ),
  },
}));

// Mock haptic
vi.mock('../hooks/use-haptic', () => ({
  useHaptic: () => ({ tap: vi.fn() }),
}));

// Mock store
const mockSetCurrentVote = vi.fn();
const mockSetSubmitting = vi.fn();

vi.mock('../stores/session-store', () => ({
  useSessionStore: vi.fn(() => ({
    setCurrentVote: mockSetCurrentVote,
    submitting: false,
    setSubmitting: mockSetSubmitting,
  })),
}));

import VoteMultipleChoice from './VoteMultipleChoice';

const mcQuestion: Question = {
  id: 'q1', session_id: 's1', text: 'Pick one?', type: 'multiple_choice',
  options: ['Option A', 'Option B', 'Option C'], position: 0, anonymous: false,
  status: 'active', created_at: new Date().toISOString(), batch_id: null,
  template_id: null,
};

describe('VoteMultipleChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockSingle.mockResolvedValue({ data: { id: 'v1', value: 'Option A' }, error: null });
  });

  it('renders question text', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Pick one?')).toBeDefined();
  });

  it('renders all option buttons', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
    expect(screen.getByText('Option C')).toBeDefined();
  });

  it('renders submit button', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Submit Vote')).toBeDefined();
  });

  it('disables submit when nothing selected', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables submit after selecting option', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Option B'));
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls upsert on submit', async () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Option A'));
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  it('shows reason textarea when reasonsEnabled', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" reasonsEnabled={true} />
    );
    expect(screen.getByPlaceholderText('Why? (optional)')).toBeDefined();
  });

  it('does not show reason textarea by default', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.queryByPlaceholderText('Why? (optional)')).toBeNull();
  });

  it('handles compact mode for 5+ options', () => {
    const manyOptions: Question = {
      ...mcQuestion,
      options: ['A', 'B', 'C', 'D', 'E'],
    };
    const { container } = render(
      <VoteMultipleChoice question={manyOptions} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(container.innerHTML).toContain('overflow-y-auto');
  });

  it('loads existing vote on mount', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'v1', value: 'Option B', reason: null, question_id: 'q1', participant_id: 'p1' },
    });

    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );

    await waitFor(() => {
      expect(mockSetCurrentVote).toHaveBeenCalled();
    });
  });

  it('renders with empty options array', () => {
    const noOpts: Question = { ...mcQuestion, options: [] };
    render(
      <VoteMultipleChoice question={noOpts} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Submit Vote')).toBeDefined();
  });
});
