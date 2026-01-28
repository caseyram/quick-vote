import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { PastSessions } from './PastSessions';

describe('PastSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when user not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { container } = render(<PastSessions />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders nothing when no past sessions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    const { container } = render(<PastSessions />);
    await waitFor(() => {
      // Should not render session list when empty
      expect(container.querySelector('[data-testid]')).toBeNull();
    });
  });

  it('renders past sessions list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '1', session_id: 'sid1', admin_token: 'at1', title: 'Past Session',
                  status: 'ended', created_at: '2024-06-01T00:00:00Z',
                  questions: [{ count: 3 }],
                },
              ],
            }),
          }),
        }),
      }),
    });

    render(<PastSessions />);
    await waitFor(() => {
      expect(screen.getByText('Past Session')).toBeDefined();
      expect(screen.getByText('ended')).toBeDefined();
    });
  });
});
