import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockReady = vi.fn();

vi.mock('./hooks/use-auth', () => ({
  useAuth: () => ({ ready: mockReady() }),
}));

vi.mock('./pages/Home', () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock('./pages/AdminSession', () => ({
  default: () => <div>Admin Session</div>,
}));

vi.mock('./pages/ParticipantSession', () => ({
  default: () => <div>Participant Session</div>,
}));

import App from './App';

describe('App', () => {
  it('shows loading when auth is not ready', () => {
    mockReady.mockReturnValue(false);
    render(<App />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders Home route when auth is ready', async () => {
    mockReady.mockReturnValue(true);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeDefined();
    });
  });
});
