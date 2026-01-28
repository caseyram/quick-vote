import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router
const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'mock-session-id',
}));

// Mock supabase
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-id' } },
  error: null,
});
const mockInsertSingle = vi.fn().mockResolvedValue({
  data: { admin_token: 'mock-admin-token' },
  error: null,
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockInsertSingle,
        }),
      }),
    })),
  },
}));

// Mock child components
vi.mock('../components/AdminPasswordGate', () => ({
  AdminPasswordGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/PastSessions', () => ({
  PastSessions: () => <div data-testid="past-sessions">Past Sessions</div>,
}));

import Home from './Home';

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockInsertSingle.mockResolvedValue({
      data: { admin_token: 'mock-admin-token' },
      error: null,
    });
  });

  it('renders QuickVote heading', () => {
    render(<Home />);
    expect(screen.getByText('QuickVote')).toBeDefined();
    expect(screen.getByText('Create a live voting session in seconds')).toBeDefined();
  });

  it('renders session title input', () => {
    render(<Home />);
    expect(screen.getByPlaceholderText('Session title (optional)')).toBeDefined();
  });

  it('renders Create Session button', () => {
    render(<Home />);
    expect(screen.getByText('Create Session')).toBeDefined();
  });

  it('renders PastSessions component', () => {
    render(<Home />);
    expect(screen.getByTestId('past-sessions')).toBeDefined();
  });

  it('navigates to admin page on successful create', async () => {
    render(<Home />);
    fireEvent.click(screen.getByText('Create Session'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/mock-admin-token');
    });
  });

  it('shows error when auth fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    render(<Home />);
    fireEvent.click(screen.getByText('Create Session'));

    await waitFor(() => {
      expect(screen.getByText('Authentication failed. Please refresh and try again.')).toBeDefined();
    });
  });

  it('shows error on insert failure', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    render(<Home />);
    fireEvent.click(screen.getByText('Create Session'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeDefined();
    });
  });

  it('uses title input value when creating session', () => {
    render(<Home />);
    const input = screen.getByPlaceholderText('Session title (optional)');
    fireEvent.change(input, { target: { value: 'My Session' } });
    fireEvent.click(screen.getByText('Create Session'));
    // Verify button text changes to Creating...
    expect(screen.getByText('Creating...')).toBeDefined();
  });
});
