import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantCount } from './ParticipantCount';

describe('ParticipantCount', () => {
  it('renders count with default size', () => {
    render(<ParticipantCount count={5} />);
    expect(screen.getByText('5 connected')).toBeDefined();
  });

  it('renders count with large size', () => {
    render(<ParticipantCount count={12} size="large" />);
    expect(screen.getByText('12 participants connected')).toBeDefined();
  });

  it('shows green dot when count > 0', () => {
    const { container } = render(<ParticipantCount count={1} />);
    expect(container.innerHTML).toContain('bg-green-500');
  });

  it('shows gray dot when count is 0', () => {
    const { container } = render(<ParticipantCount count={0} />);
    expect(container.innerHTML).toContain('bg-gray-500');
  });
});
