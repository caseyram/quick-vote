import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Question } from '../types/database';

const mockQuestions: Question[] = [
  {
    id: 'q1', session_id: 's1', text: 'First question', type: 'agree_disagree',
    options: null, position: 0, anonymous: false, status: 'pending', created_at: new Date().toISOString(),
  },
  {
    id: 'q2', session_id: 's1', text: 'Second question', type: 'multiple_choice',
    options: ['A', 'B', 'C'], position: 1, anonymous: true, status: 'pending', created_at: new Date().toISOString(),
  },
];

const mockState = {
  questions: mockQuestions,
  removeQuestion: vi.fn(),
  reorderQuestions: vi.fn(),
};

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
    {
      getState: vi.fn(() => mockState),
    }
  ),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}));

import QuestionList from './QuestionList';

describe('QuestionList', () => {
  const onEditQuestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.questions = mockQuestions;
  });

  it('renders all questions', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    expect(screen.getByText('First question')).toBeDefined();
    expect(screen.getByText('Second question')).toBeDefined();
  });

  it('shows type badges', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    expect(screen.getByText('Agree/Disagree')).toBeDefined();
    expect(screen.getByText('Multiple Choice')).toBeDefined();
  });

  it('shows options for multiple choice questions', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
  });

  it('shows empty state when no questions', () => {
    mockState.questions = [];
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    expect(screen.getByText('No questions yet. Add your first question using the form below.')).toBeDefined();
  });

  it('calls onEditQuestion when Edit clicked', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    expect(onEditQuestion).toHaveBeenCalledWith(mockQuestions[0]);
  });

  it('shows move up/down buttons', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    const upButtons = screen.getAllByTitle('Move up');
    const downButtons = screen.getAllByTitle('Move down');
    expect(upButtons).toHaveLength(2);
    expect(downButtons).toHaveLength(2);
  });

  it('disables move up for first question', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    const upButtons = screen.getAllByTitle('Move up');
    expect((upButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables move down for last question', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    const downButtons = screen.getAllByTitle('Move down');
    expect((downButtons[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows question numbers', () => {
    render(<QuestionList onEditQuestion={onEditQuestion} />);
    expect(screen.getByText('1.')).toBeDefined();
    expect(screen.getByText('2.')).toBeDefined();
  });
});
