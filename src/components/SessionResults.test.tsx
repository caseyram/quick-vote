import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockFrom = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import SessionResults from './SessionResults';

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data }),
        eq: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

describe('SessionResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFrom.mockReturnValue(makeChain(null));
    render(<SessionResults sessionId="s1" />);
    expect(screen.getByText('Loading results...')).toBeDefined();
  });

  it('shows no questions message when empty', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    render(<SessionResults sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText('No questions found for this session.')).toBeDefined();
    });
  });

  it('renders questions with results', async () => {
    const questions = [
      { id: 'q1', session_id: 's1', text: 'Do you agree?', type: 'agree_disagree', options: null, position: 0, anonymous: false, status: 'closed', created_at: '2024-01-01' },
    ];
    const votes = [
      { id: 'v1', question_id: 'q1', session_id: 's1', participant_id: 'p1', value: 'Agree', reason: null, display_name: null, locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'v2', question_id: 'q1', session_id: 's1', participant_id: 'p2', value: 'Disagree', reason: null, display_name: null, locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'questions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: questions }),
            }),
          }),
        };
      }
      if (table === 'votes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: votes }),
          }),
        };
      }
      return makeChain(null);
    });

    render(<SessionResults sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText('Session Results')).toBeDefined();
      expect(screen.getByText('Do you agree?')).toBeDefined();
    });
  });

  it('renders with light theme', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const { container } = render(<SessionResults sessionId="s1" theme="light" />);
    await waitFor(() => {
      expect(container.innerHTML).toContain('text-gray-500');
    });
  });

  it('shows reasons section when votes have reasons', async () => {
    const questions = [
      { id: 'q1', session_id: 's1', text: 'Good?', type: 'agree_disagree', options: null, position: 0, anonymous: false, status: 'closed', created_at: '2024-01-01' },
    ];
    const votes = [
      { id: 'v1', question_id: 'q1', session_id: 's1', participant_id: 'p1', value: 'Agree', reason: 'Great stuff', display_name: null, locked_in: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'questions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: questions }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: votes }),
        }),
      };
    });

    render(<SessionResults sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/Show Reasons/)).toBeDefined();
    });

    // Expand reasons
    fireEvent.click(screen.getByText(/Show Reasons/));
    expect(screen.getByText('Great stuff')).toBeDefined();
  });

  it('shows No votes recorded when question has zero votes', async () => {
    const questions = [
      { id: 'q1', session_id: 's1', text: 'Empty Q', type: 'agree_disagree', options: null, position: 0, anonymous: false, status: 'closed', created_at: '2024-01-01' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'questions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: questions }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });

    render(<SessionResults sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText('No votes recorded')).toBeDefined();
    });
  });
});
