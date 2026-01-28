import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionBanner } from './ConnectionBanner';

describe('ConnectionBanner', () => {
  it('returns null for connected status', () => {
    const { container } = render(<ConnectionBanner status="connected" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for connecting status', () => {
    const { container } = render(<ConnectionBanner status="connecting" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders reconnecting message', () => {
    render(<ConnectionBanner status="reconnecting" />);
    expect(screen.getByText('Reconnecting...')).toBeDefined();
  });

  it('renders disconnected message', () => {
    render(<ConnectionBanner status="disconnected" />);
    expect(screen.getByText('Connection lost. Please refresh if this persists.')).toBeDefined();
  });

  it('applies yellow styling for reconnecting', () => {
    const { container } = render(<ConnectionBanner status="reconnecting" />);
    expect(container.innerHTML).toContain('bg-yellow-900');
  });

  it('applies red styling for disconnected', () => {
    const { container } = render(<ConnectionBanner status="disconnected" />);
    expect(container.innerHTML).toContain('bg-red-900');
  });
});
