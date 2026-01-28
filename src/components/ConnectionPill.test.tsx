import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionPill } from './ConnectionPill';

describe('ConnectionPill', () => {
  it('shows green dot for connected status', () => {
    const { container } = render(<ConnectionPill status="connected" />);
    expect(container.innerHTML).toContain('bg-green-400');
  });

  it('does not show label text for connected status', () => {
    render(<ConnectionPill status="connected" />);
    expect(screen.queryByText('Disconnected')).toBeNull();
    expect(screen.queryByText('Reconnecting')).toBeNull();
  });

  it('shows Disconnected label for disconnected status', () => {
    render(<ConnectionPill status="disconnected" />);
    expect(screen.getByText('Disconnected')).toBeDefined();
  });

  it('shows red dot for disconnected status', () => {
    const { container } = render(<ConnectionPill status="disconnected" />);
    expect(container.innerHTML).toContain('bg-red-400');
    expect(container.innerHTML).toContain('bg-red-900');
  });

  it('shows Reconnecting label for reconnecting status', () => {
    render(<ConnectionPill status="reconnecting" />);
    expect(screen.getByText('Reconnecting')).toBeDefined();
  });

  it('shows yellow dot for reconnecting status', () => {
    const { container } = render(<ConnectionPill status="reconnecting" />);
    expect(container.innerHTML).toContain('bg-yellow-400');
    expect(container.innerHTML).toContain('bg-yellow-900');
  });

  it('renders with fixed positioning', () => {
    const { container } = render(<ConnectionPill status="connected" />);
    expect(container.innerHTML).toContain('fixed');
  });
});
