import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminControlBar } from './AdminControlBar';

const defaultProps = {
  status: 'draft' as const,
  participantCount: 0,
  transitioning: false,
  onGoLive: vi.fn(),
  onCopyLink: vi.fn(),
  copied: false,
};

describe('AdminControlBar', () => {
  it('shows draft status badge and Go Live button', () => {
    render(<AdminControlBar {...defaultProps} />);
    expect(screen.getByText('draft')).toBeDefined();
    expect(screen.getByText('Go Live')).toBeDefined();
    expect(screen.getByText('Configure session, then go live')).toBeDefined();
  });

  it('calls onGoLive when Go Live button clicked', () => {
    const onGoLive = vi.fn();
    render(<AdminControlBar {...defaultProps} onGoLive={onGoLive} />);
    fireEvent.click(screen.getByText('Go Live'));
    expect(onGoLive).toHaveBeenCalledOnce();
  });

  it('disables Go Live button when transitioning', () => {
    render(<AdminControlBar {...defaultProps} transitioning={true} />);
    expect(screen.getByText('Starting...')).toBeDefined();
    expect((screen.getByText('Starting...') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Session Complete in ended state', () => {
    render(<AdminControlBar {...defaultProps} status="ended" />);
    expect(screen.getByText('Session Complete')).toBeDefined();
    expect(screen.getByText('ended')).toBeDefined();
  });

  it('does not show Go Live button when ended', () => {
    render(<AdminControlBar {...defaultProps} status="ended" />);
    expect(screen.queryByText('Go Live')).toBeNull();
  });

  it('does not show Go Live button when active', () => {
    render(<AdminControlBar {...defaultProps} status="active" />);
    expect(screen.queryByText('Go Live')).toBeNull();
  });
});
