import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mock chain
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

function resetMockChain() {
  mockSingle.mockResolvedValue({ data: { id: 'new-q', session_id: 's1', text: 'Q?', type: 'agree_disagree', options: null, position: 0, anonymous: false, status: 'pending', created_at: new Date().toISOString() }, error: null });
  mockLimit.mockReturnValue(Promise.resolve({ data: [], error: null }));
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockEq.mockReturnValue({ order: mockOrder, select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq, order: mockOrder });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq });
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    })),
  },
}));

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({ questions: [] })),
    {
      getState: vi.fn(() => ({
        addQuestion: vi.fn(),
        updateQuestion: vi.fn(),
      })),
    }
  ),
}));

import QuestionForm from './QuestionForm';

describe('QuestionForm', () => {
  const onSaved = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockChain();
  });

  it('renders add mode by default', () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    expect(screen.getByRole('heading', { name: 'Add Question' })).toBeDefined();
    expect(screen.getByLabelText('Question Text')).toBeDefined();
  });

  it('renders edit mode when editingQuestion is provided', () => {
    const q = {
      id: 'q1', session_id: 's1', text: 'Edit me', type: 'agree_disagree' as const,
      options: null, position: 0, anonymous: false, status: 'pending' as const,
      created_at: new Date().toISOString(),
    };
    render(<QuestionForm sessionId="s1" editingQuestion={q} onSaved={onSaved} onCancel={onCancel} />);
    expect(screen.getByText('Edit Question')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('shows radio buttons for vote type', () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    expect(screen.getByText('Agree / Disagree')).toBeDefined();
    expect(screen.getByText('Multiple Choice')).toBeDefined();
  });

  it('shows options when multiple choice is selected', () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    const mcRadio = screen.getByDisplayValue('multiple_choice');
    fireEvent.click(mcRadio);
    expect(screen.getByText('Options')).toBeDefined();
    expect(screen.getByPlaceholderText('Option 1')).toBeDefined();
    expect(screen.getByPlaceholderText('Option 2')).toBeDefined();
  });

  it('can add and remove options', () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    fireEvent.click(screen.getByDisplayValue('multiple_choice'));

    // Add option
    fireEvent.click(screen.getByText('+ Add Option'));
    expect(screen.getByPlaceholderText('Option 3')).toBeDefined();

    // Remove option
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByPlaceholderText('Option 3')).toBeNull();
  });

  it('shows error when submitting empty question', async () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Question' }));
    await waitFor(() => {
      expect(screen.getByText('Question text is required.')).toBeDefined();
    });
  });

  it('shows error when MC has fewer than 2 options', async () => {
    render(<QuestionForm sessionId="s1" onSaved={onSaved} />);
    fireEvent.click(screen.getByDisplayValue('multiple_choice'));

    const textarea = screen.getByLabelText('Question Text');
    fireEvent.change(textarea, { target: { value: 'Pick one?' } });
    // Leave options empty
    fireEvent.click(screen.getByRole('button', { name: 'Add Question' }));
    await waitFor(() => {
      expect(screen.getByText('Multiple choice questions need at least 2 non-empty options.')).toBeDefined();
    });
  });

  it('calls onCancel when Cancel clicked in edit mode', () => {
    const q = {
      id: 'q1', session_id: 's1', text: 'Edit me', type: 'agree_disagree' as const,
      options: null, position: 0, anonymous: false, status: 'pending' as const,
      created_at: new Date().toISOString(),
    };
    render(<QuestionForm sessionId="s1" editingQuestion={q} onSaved={onSaved} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
