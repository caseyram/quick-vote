import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownTimer } from './CountdownTimer';

describe('CountdownTimer', () => {
  it('returns null when not running', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={10} isRunning={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders remaining seconds when running', () => {
    render(<CountdownTimer remainingSeconds={10} isRunning={true} />);
    expect(screen.getByText('10s')).toBeDefined();
  });

  it('applies urgent styling at 5 seconds', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={5} isRunning={true} />
    );
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('applies urgent styling below 5 seconds', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={3} isRunning={true} />
    );
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('does not apply urgent styling above 5 seconds', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={6} isRunning={true} />
    );
    expect(container.innerHTML).not.toContain('animate-pulse');
  });

  it('renders with large size', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={10} isRunning={true} size="large" />
    );
    expect(container.innerHTML).toContain('text-2xl');
  });

  it('renders with light theme', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={10} isRunning={true} theme="light" />
    );
    expect(container.innerHTML).toContain('bg-gray-100');
  });

  it('renders with light theme urgent', () => {
    const { container } = render(
      <CountdownTimer remainingSeconds={3} isRunning={true} theme="light" />
    );
    expect(container.innerHTML).toContain('bg-red-100');
  });
});
