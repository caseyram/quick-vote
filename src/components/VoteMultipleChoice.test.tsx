import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question, ResponseTemplate } from '../types/database';

// Mock supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'v1', value: 'Option A' }, error: null });
const mockSelectChain = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectChain });

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
      upsert: mockUpsert,
    })),
  },
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    button: ({ children, onClick, className, style }: React.ComponentProps<'button'>) => (
      <button onClick={onClick} className={className as string} style={style as React.CSSProperties}>{children}</button>
    ),
  },
}));

// Mock haptic
vi.mock('../hooks/use-haptic', () => ({
  useHaptic: () => ({ tap: vi.fn() }),
}));

// Mock session store
const mockSetCurrentVote = vi.fn();
const mockSetSubmitting = vi.fn();

vi.mock('../stores/session-store', () => ({
  useSessionStore: vi.fn(() => ({
    setCurrentVote: mockSetCurrentVote,
    submitting: false,
    setSubmitting: mockSetSubmitting,
  })),
}));

// Mock template store
const mockTemplates: ResponseTemplate[] = [];

vi.mock('../stores/template-store', () => ({
  useTemplateStore: vi.fn((selector: (state: { templates: ResponseTemplate[] }) => any) =>
    selector({ templates: mockTemplates })
  ),
}));

import VoteMultipleChoice from './VoteMultipleChoice';

const mcQuestion: Question = {
  id: 'q1', session_id: 's1', text: 'Pick one?', type: 'multiple_choice',
  options: ['Option A', 'Option B', 'Option C'], position: 0, anonymous: false,
  status: 'active', created_at: new Date().toISOString(), batch_id: null,
  template_id: null,
};

describe('VoteMultipleChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockSingle.mockResolvedValue({ data: { id: 'v1', value: 'Option A' }, error: null });
  });

  it('renders question text', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Pick one?')).toBeDefined();
  });

  it('renders all option buttons', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
    expect(screen.getByText('Option C')).toBeDefined();
  });

  it('renders submit button', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Submit Vote')).toBeDefined();
  });

  it('disables submit when nothing selected', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables submit after selecting option', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Option B'));
    const button = screen.getByText('Submit Vote') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls upsert on submit', async () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    fireEvent.click(screen.getByText('Option A'));
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  it('shows reason textarea when reasonsEnabled', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" reasonsEnabled={true} />
    );
    expect(screen.getByPlaceholderText('Why? (optional)')).toBeDefined();
  });

  it('does not show reason textarea by default', () => {
    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.queryByPlaceholderText('Why? (optional)')).toBeNull();
  });

  it('handles compact mode for 5+ options', () => {
    const manyOptions: Question = {
      ...mcQuestion,
      options: ['A', 'B', 'C', 'D', 'E'],
    };
    const { container } = render(
      <VoteMultipleChoice question={manyOptions} sessionId="s1" participantId="p1" displayName="Test" />
    );
    // Compact mode uses smaller padding and font size
    const buttons = container.querySelectorAll('button');
    const optionButtons = Array.from(buttons).slice(0, 5); // First 5 are option buttons
    optionButtons.forEach(button => {
      expect(button.className).toContain('text-base'); // compact uses text-base
      expect(button.className).toContain('px-4 py-3'); // compact uses smaller padding
    });
  });

  it('loads existing vote on mount', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'v1', value: 'Option B', reason: null, question_id: 'q1', participant_id: 'p1' },
    });

    render(
      <VoteMultipleChoice question={mcQuestion} sessionId="s1" participantId="p1" displayName="Test" />
    );

    await waitFor(() => {
      expect(mockSetCurrentVote).toHaveBeenCalled();
    });
  });

  it('renders with empty options array', () => {
    const noOpts: Question = { ...mcQuestion, options: [] };
    render(
      <VoteMultipleChoice question={noOpts} sessionId="s1" participantId="p1" displayName="Test" />
    );
    expect(screen.getByText('Submit Vote')).toBeDefined();
  });

  describe('template-aware rendering', () => {
    const testTemplate: ResponseTemplate = {
      id: 'tmpl-1',
      name: 'Likert Scale',
      options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      // Reset mock templates before each test
      mockTemplates.length = 0;
    });

    it('renders template options order when template_id present', () => {
      // Set up template in mock store
      mockTemplates.push(testTemplate);

      const templateQuestion: Question = {
        ...mcQuestion,
        id: 'q-tmpl',
        template_id: 'tmpl-1',
        options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'],
      };

      render(
        <VoteMultipleChoice question={templateQuestion} sessionId="s1" participantId="p1" displayName="Test" />
      );

      // All 5 template options should be rendered
      expect(screen.getByText('Strongly Agree')).toBeDefined();
      expect(screen.getByText('Agree')).toBeDefined();
      expect(screen.getByText('Neutral')).toBeDefined();
      expect(screen.getByText('Disagree')).toBeDefined();
      expect(screen.getByText('Strongly Disagree')).toBeDefined();
    });

    it('falls back to question.options when template_id present but template not found', () => {
      // mockTemplates is empty (template deleted scenario)

      const questionWithMissingTemplate: Question = {
        ...mcQuestion,
        template_id: 'nonexistent',
        options: ['A', 'B'],
      };

      render(
        <VoteMultipleChoice question={questionWithMissingTemplate} sessionId="s1" participantId="p1" displayName="Test" />
      );

      // Should fall back to question.options
      expect(screen.getByText('A')).toBeDefined();
      expect(screen.getByText('B')).toBeDefined();
    });

    it('uses question.options order when template_id is null', () => {
      const nonTemplateQuestion: Question = {
        ...mcQuestion,
        template_id: null,
        options: ['Option A', 'Option B', 'Option C'],
      };

      render(
        <VoteMultipleChoice question={nonTemplateQuestion} sessionId="s1" participantId="p1" displayName="Test" />
      );

      // Should use question.options
      expect(screen.getByText('Option A')).toBeDefined();
      expect(screen.getByText('Option B')).toBeDefined();
      expect(screen.getByText('Option C')).toBeDefined();
    });

    it('triggers compact mode based on template option count', () => {
      // Template has 5 options (compact threshold is > 4)
      mockTemplates.push(testTemplate);

      const templateQuestion: Question = {
        ...mcQuestion,
        id: 'q-tmpl',
        template_id: 'tmpl-1',
        options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'],
      };

      const { container } = render(
        <VoteMultipleChoice question={templateQuestion} sessionId="s1" participantId="p1" displayName="Test" />
      );

      // Compact mode uses smaller padding: 'px-4 py-3'
      // Check that buttons have compact styling (text-base instead of text-lg)
      const buttons = container.querySelectorAll('button');
      // First 5 buttons are option buttons (last is Submit)
      const optionButtons = Array.from(buttons).slice(0, 5);
      optionButtons.forEach(button => {
        expect(button.className).toContain('text-base');
        expect(button.className).toContain('px-4');
        expect(button.className).toContain('py-3');
      });
    });
  });
});
