import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Question } from '../types/database';

const mockQuestions: Question[] = [
  {
    id: 'q1', session_id: 's1', text: 'First', type: 'agree_disagree',
    options: null, position: 0, anonymous: false, status: 'pending', created_at: new Date().toISOString(),
  },
];

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (s: { questions: Question[] }) => unknown) => selector({ questions: mockQuestions })),
    {
      getState: vi.fn(() => ({ addQuestion: vi.fn() })),
    }
  ),
}));

const mockSavedTemplates = vi.fn().mockReturnValue([]);
const mockSaveTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();

vi.mock('../lib/question-templates', () => ({
  getSavedTemplates: (...args: unknown[]) => mockSavedTemplates(...args),
  saveTemplate: (...args: unknown[]) => mockSaveTemplate(...args),
  deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
  bulkInsertQuestions: vi.fn().mockResolvedValue([]),
}));

import { TemplatePanel } from './TemplatePanel';

describe('TemplatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavedTemplates.mockReturnValue([]);
  });

  it('renders Templates heading', () => {
    render(<TemplatePanel sessionId="s1" />);
    expect(screen.getByText('Templates')).toBeDefined();
  });

  it('shows template name input and save button', () => {
    render(<TemplatePanel sessionId="s1" />);
    expect(screen.getByPlaceholderText('Template name')).toBeDefined();
    expect(screen.getByText('Save as Template')).toBeDefined();
  });

  it('shows no templates message when empty', () => {
    render(<TemplatePanel sessionId="s1" />);
    expect(screen.getByText('No saved templates yet.')).toBeDefined();
  });

  it('disables save when name is empty', () => {
    render(<TemplatePanel sessionId="s1" />);
    const btn = screen.getByText('Save as Template') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls saveTemplate when save clicked', () => {
    mockSavedTemplates.mockReturnValueOnce([]).mockReturnValue([
      { name: 'My Template', questions: [], createdAt: new Date().toISOString() },
    ]);
    render(<TemplatePanel sessionId="s1" />);

    const input = screen.getByPlaceholderText('Template name');
    fireEvent.change(input, { target: { value: 'My Template' } });
    fireEvent.click(screen.getByText('Save as Template'));

    expect(mockSaveTemplate).toHaveBeenCalledWith('My Template', mockQuestions);
  });

  it('renders saved templates with Load and Delete buttons', () => {
    mockSavedTemplates.mockReturnValue([
      { name: 'Sprint Retro', questions: [{ text: 'Q1' }], createdAt: '2024-01-01T00:00:00.000Z' },
    ]);
    render(<TemplatePanel sessionId="s1" />);

    expect(screen.getByText('Sprint Retro')).toBeDefined();
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'P' && content.includes('1') && element.textContent?.includes('question') || false;
    })).toBeDefined();
    expect(screen.getByText('Load')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('calls deleteTemplate when Delete clicked', () => {
    mockSavedTemplates.mockReturnValueOnce([
      { name: 'Old', questions: [], createdAt: '2024-01-01T00:00:00.000Z' },
    ]).mockReturnValue([]);
    render(<TemplatePanel sessionId="s1" />);

    fireEvent.click(screen.getByText('Delete'));
    expect(mockDeleteTemplate).toHaveBeenCalledWith('Old');
  });

  it('shows plural questions count', () => {
    mockSavedTemplates.mockReturnValue([
      { name: 'Template', questions: [{ text: 'Q1' }, { text: 'Q2' }], createdAt: '2024-01-01T00:00:00.000Z' },
    ]);
    render(<TemplatePanel sessionId="s1" />);
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'P' && content.includes('2') && element.textContent?.includes('questions') || false;
    })).toBeDefined();
  });
});
