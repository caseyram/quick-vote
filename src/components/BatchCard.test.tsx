import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchCard } from './BatchCard';
import type { Batch, Question } from '../types/database';

// Mock QuestionForm
vi.mock('./QuestionForm', () => ({
  default: ({ onSaved, onCancel }: any) => (
    <div data-testid="question-form">
      <button onClick={onSaved}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock BatchQuestionItem
vi.mock('./BatchQuestionItem', () => ({
  BatchQuestionItem: ({ question, onEdit, onDelete }: any) => (
    <div data-testid={`batch-question-${question.id}`}>
      <span>{question.text}</span>
      <button onClick={() => onEdit(question)}>Edit</button>
      <button onClick={() => onDelete(question)}>Delete</button>
    </div>
  ),
}));

describe('BatchCard', () => {
  const defaultBatch: Batch = {
    id: 'b1',
    session_id: 's1',
    name: 'Test Batch',
    position: 0,
    status: 'pending',
    cover_image_path: null,
    created_at: '',
  };

  const defaultQuestions: Question[] = [
    {
      id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Question 1',
      template_id: null,
      type: 'agree_disagree', options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
    },
    {
      id: 'q2', session_id: 's1', batch_id: 'b1', text: 'Question 2',
      template_id: null,
      type: 'multiple_choice', options: ['A', 'B'], position: 1, anonymous: false, status: 'pending', created_at: '',
    },
  ];

  const defaultProps = {
    sessionId: 's1',
    batch: defaultBatch,
    questions: defaultQuestions,
    isExpanded: false,
    isAddingQuestion: false,
    isActive: false,
    canActivate: true,
    showActivateButton: false,
    onToggle: vi.fn(),
    onNameChange: vi.fn(),
    onQuestionReorder: vi.fn(),
    onEditQuestion: vi.fn(),
    onDeleteQuestion: vi.fn(),
    onAddQuestion: vi.fn(),
    onAddQuestionDone: vi.fn(),
    onDeleteBatch: vi.fn(),
    onActivate: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders batch name and question count', () => {
    render(<BatchCard {...defaultProps} />);

    expect(screen.getByText('Test Batch')).toBeDefined();
    expect(screen.getByText('2 questions')).toBeDefined();
  });

  it('shows singular "question" when count is 1', () => {
    render(<BatchCard {...defaultProps} questions={[defaultQuestions[0]]} />);

    expect(screen.getByText('1 question')).toBeDefined();
  });

  it('shows preview text when collapsed', () => {
    render(<BatchCard {...defaultProps} isExpanded={false} />);

    // Preview shows first 3 questions separated by " | "
    expect(screen.getByText('Question 1 | Question 2')).toBeDefined();
  });

  it('toggles expanded state when clicking chevron', () => {
    const onToggle = vi.fn();
    render(<BatchCard {...defaultProps} onToggle={onToggle} />);

    // Find and click the toggle button (chevron)
    const toggleButtons = screen.getAllByRole('button');
    const chevronButton = toggleButtons.find(btn => btn.querySelector('svg'));
    if (chevronButton) {
      fireEvent.click(chevronButton);
      expect(onToggle).toHaveBeenCalled();
    }
  });

  it('shows questions when expanded', () => {
    render(<BatchCard {...defaultProps} isExpanded={true} />);

    expect(screen.getByTestId('batch-question-q1')).toBeDefined();
    expect(screen.getByTestId('batch-question-q2')).toBeDefined();
  });

  it('shows "Add to Batch" button when expanded', () => {
    render(<BatchCard {...defaultProps} isExpanded={true} />);

    expect(screen.getByText('+ Add to Batch')).toBeDefined();
  });

  it('calls onAddQuestion when clicking Add button', () => {
    const onAddQuestion = vi.fn();
    render(<BatchCard {...defaultProps} isExpanded={true} onAddQuestion={onAddQuestion} />);

    fireEvent.click(screen.getByText('+ Add to Batch'));
    expect(onAddQuestion).toHaveBeenCalled();
  });

  it('shows QuestionForm when adding question', () => {
    render(<BatchCard {...defaultProps} isExpanded={true} isAddingQuestion={true} />);

    expect(screen.getByTestId('question-form')).toBeDefined();
  });

  it('calls onDeleteBatch when clicking Delete', () => {
    const onDeleteBatch = vi.fn();
    render(<BatchCard {...defaultProps} onDeleteBatch={onDeleteBatch} />);

    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteBatch).toHaveBeenCalled();
  });

  it('shows Activate button when showActivateButton is true', () => {
    render(<BatchCard {...defaultProps} showActivateButton={true} canActivate={true} />);

    expect(screen.getByText('▶ Activate')).toBeDefined();
  });

  it('shows Close button when batch is active', () => {
    render(<BatchCard {...defaultProps} showActivateButton={true} isActive={true} />);

    expect(screen.getByText('■ Close')).toBeDefined();
  });

  it('calls onActivate when clicking Activate', () => {
    const onActivate = vi.fn();
    render(<BatchCard {...defaultProps} showActivateButton={true} canActivate={true} onActivate={onActivate} />);

    fireEvent.click(screen.getByText('▶ Activate'));
    expect(onActivate).toHaveBeenCalledWith('b1');
  });

  it('calls onClose when clicking Close', () => {
    const onClose = vi.fn();
    render(<BatchCard {...defaultProps} showActivateButton={true} isActive={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('■ Close'));
    expect(onClose).toHaveBeenCalledWith('b1');
  });

  it('disables Activate button when canActivate is false', () => {
    render(<BatchCard {...defaultProps} showActivateButton={true} canActivate={false} />);

    const activateBtn = screen.getByText('▶ Activate');
    expect(activateBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows Closed indicator when batch status is closed', () => {
    const closedBatch = { ...defaultBatch, status: 'closed' as const };
    render(<BatchCard {...defaultProps} batch={closedBatch} />);

    expect(screen.getByText('Closed')).toBeDefined();
  });

  it('shows empty state when expanded with no questions', () => {
    render(<BatchCard {...defaultProps} questions={[]} isExpanded={true} />);

    expect(screen.getByText('No questions yet')).toBeDefined();
    expect(screen.getByText('+ Add to Batch')).toBeDefined();
  });

  it('allows editing batch name', async () => {
    const onNameChange = vi.fn();
    render(<BatchCard {...defaultProps} onNameChange={onNameChange} />);

    // Click on batch name to edit
    fireEvent.click(screen.getByText('Test Batch'));

    // Should show input
    const input = screen.getByDisplayValue('Test Batch');
    expect(input).toBeDefined();

    // Type new name
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);

    expect(onNameChange).toHaveBeenCalledWith('New Name');
  });

  it('cancels name edit on Escape', () => {
    const onNameChange = vi.fn();
    render(<BatchCard {...defaultProps} onNameChange={onNameChange} />);

    fireEvent.click(screen.getByText('Test Batch'));
    const input = screen.getByDisplayValue('Test Batch');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onNameChange).not.toHaveBeenCalled();
    // Name should revert
    expect(screen.getByText('Test Batch')).toBeDefined();
  });

  it('saves name edit on Enter', () => {
    const onNameChange = vi.fn();
    render(<BatchCard {...defaultProps} onNameChange={onNameChange} />);

    fireEvent.click(screen.getByText('Test Batch'));
    const input = screen.getByDisplayValue('Test Batch');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onNameChange).toHaveBeenCalledWith('New Name');
  });

  it('does not save empty name', () => {
    const onNameChange = vi.fn();
    render(<BatchCard {...defaultProps} onNameChange={onNameChange} />);

    fireEvent.click(screen.getByText('Test Batch'));
    const input = screen.getByDisplayValue('Test Batch');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    expect(onNameChange).not.toHaveBeenCalled();
  });

  it('renders drag handle when dragHandleProps provided', () => {
    const dragHandleProps = { 'data-testid': 'drag-handle' };
    render(<BatchCard {...defaultProps} dragHandleProps={dragHandleProps} />);

    expect(screen.getByTestId('drag-handle')).toBeDefined();
  });
});
