import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question } from '../types/database';

// Mock supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'v1', value: 'agree' }, error: null });
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });

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
    button: ({ children, onClick, className, style, ...rest }: React.ComponentProps<'button'> & Record<string, unknown>) => (
      <button onClick={onClick} className={className as string} style={style as React.CSSProperties} ref={rest.ref as React.Ref<HTMLButtonElement>}>{children}</button>
    ),
  },
  useAnimate: () => [{ current: null }, vi.fn()],
}));

// Mock haptic
vi.mock('../hooks/use-haptic', () => ({
  useHaptic: () => ({ tap: vi.fn() }),
}));

// Mock store
const mockSetCurrentVote = vi.fn();
const mockSetSubmitting = vi.fn();
let mockSubmitting = false;

vi.mock('../stores/session-store', () => ({
  useSessionStore: vi.fn(() => ({
    setCurrentVote: mockSetCurrentVote,
    submitting: mockSubmitting,
    setSubmitting: mockSetSubmitting,
  })),
}));

import VoteAgreeDisagree from './VoteAgreeDisagree';

const baseQuestion: Question = {
  id: 'q1', session_id: 's1', text: 'Is this good?', type: 'agree_disagree',
  options: null, position: 0, anonymous: false, status: 'active', created_at: new Date().toISOString(), batch_id: null,
};

describe('VoteAgreeDisagree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitting = false;
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockSingle.mockResolvedValue({ data: { id: 'v1', value: 'agree' }, error: null });
  });

  it('renders question text', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Is this good?')).toBeDefined();
  });

  it('renders three vote buttons', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Agree')).toBeDefined();
    expect(screen.getByText('Sometimes in between')).toBeDefined();
    expect(screen.getByText('Disagree')).toBeDefined();
  });

  it('renders submit button', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Submit Vote')).toBeDefined();
  });

  it('disables submit when nothing selected', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables submit after selecting a vote', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Agree'));
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls upsert on submit', async () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Agree'));
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  it('shows reason textarea when reasonsEnabled', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" reasonsEnabled={true} />
    );
    expect(screen.getByPlaceholderText('Why? (optional)')).toBeDefined();
  });

  it('does not show reason textarea when reasonsEnabled is false', () => {
    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.queryByPlaceholderText('Why? (optional)')).toBeNull();
  });

  it('loads existing vote on mount', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'v1', value: 'disagree', reason: 'Because', question_id: 'q1', participant_id: 'p1' },
    });

    render(
      <VoteAgreeDisagree question={baseQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );

    await waitFor(() => {
      expect(mockSetCurrentVote).toHaveBeenCalled();
    });
  });
});
