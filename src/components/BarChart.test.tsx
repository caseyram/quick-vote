import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';

describe('BarChart', () => {
  const sampleData = [
    { label: 'agree', count: 3, percentage: 60, color: '#3B82F6' },
    { label: 'disagree', count: 2, percentage: 40, color: '#F97316' },
  ];

  it('renders bar labels', () => {
    render(<BarChart data={sampleData} />);
    expect(screen.getByText('agree')).toBeDefined();
    expect(screen.getByText('disagree')).toBeDefined();
  });

  it('renders count and percentage', () => {
    render(<BarChart data={sampleData} />);
    expect(screen.getByText('3 (60%)')).toBeDefined();
    expect(screen.getByText('2 (40%)')).toBeDefined();
  });

  it('renders total votes when provided', () => {
    render(<BarChart data={sampleData} totalVotes={5} />);
    expect(screen.getByText('Total: 5 votes')).toBeDefined();
  });

  it('does not render total when not provided', () => {
    render(<BarChart data={sampleData} />);
    expect(screen.queryByText(/Total:/)).toBeNull();
  });

  it('renders with light theme', () => {
    const { container } = render(<BarChart data={sampleData} theme="light" />);
    expect(container.innerHTML).toContain('text-gray-800');
  });

  it('renders with large size', () => {
    const { container } = render(<BarChart data={sampleData} size="large" />);
    expect(container.innerHTML).toContain('gap: 0 2rem');
  });

  it('renders with fill size', () => {
    const { container } = render(<BarChart data={sampleData} size="fill" />);
    expect(container.innerHTML).toContain('h-full');
  });

  it('renders empty data without crashing', () => {
    const { container } = render(<BarChart data={[]} />);
    expect(container).toBeDefined();
  });
});

describe('color constants', () => {
  it('exports AGREE_DISAGREE_COLORS', () => {
    expect(AGREE_DISAGREE_COLORS.agree).toBe('#3B82F6');
    expect(AGREE_DISAGREE_COLORS.disagree).toBe('#F97316');
    expect(AGREE_DISAGREE_COLORS.sometimes).toBe('#8B5CF6');
  });

  it('exports MULTI_CHOICE_COLORS with 8 entries', () => {
    expect(MULTI_CHOICE_COLORS).toHaveLength(8);
  });
});
