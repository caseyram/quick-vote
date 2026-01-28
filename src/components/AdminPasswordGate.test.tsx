import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPasswordGate } from './AdminPasswordGate';

describe('AdminPasswordGate', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders children when no password is required', () => {
    import.meta.env.VITE_ADMIN_PASSWORD = '';
    render(
      <AdminPasswordGate>
        <div>Protected Content</div>
      </AdminPasswordGate>
    );
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('shows password prompt when password is required', () => {
    import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
    render(
      <AdminPasswordGate>
        <div>Protected Content</div>
      </AdminPasswordGate>
    );
    expect(screen.getByText('Admin Access')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('unlocks on correct password', () => {
    import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
    render(
      <AdminPasswordGate>
        <div>Protected Content</div>
      </AdminPasswordGate>
    );

    const input = screen.getByPlaceholderText('Password');
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('Unlock'));

    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('shows error on incorrect password', () => {
    import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
    render(
      <AdminPasswordGate>
        <div>Protected Content</div>
      </AdminPasswordGate>
    );

    const input = screen.getByPlaceholderText('Password');
    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Unlock'));

    expect(screen.getByText('Incorrect password.')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders children when already authenticated', () => {
    import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
    sessionStorage.setItem('quickvote_admin_auth', 'true');
    render(
      <AdminPasswordGate>
        <div>Protected Content</div>
      </AdminPasswordGate>
    );
    expect(screen.getByText('Protected Content')).toBeDefined();
  });
});
