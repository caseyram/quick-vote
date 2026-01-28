import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminControlBar } from './AdminControlBar';
import type { Question } from '../types/database';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    session_id: 's1',
    text: 'Test question?',
    type: 'agree_disagree',
    options: null,
    position: 0,
    anonymous: false,
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const defaultProps = {
  status: 'draft' as const,
  participantCount: 0,
  questions: [] as Question[],
  activeQuestion: null,
  countdownRemaining: 0,
  countdownRunning: false,
  transitioning: false,
  onStartSession: vi.fn(),
  onBeginVoting: vi.fn(),
  onEndSession: vi.fn(),
  onCopyLink: vi.fn(),
  copied: false,
  onActivateQuestion: vi.fn(),
  onCloseVoting: vi.fn(),
  onQuickQuestion: vi.fn(),
  quickQuestionLoading: false,
};

describe('AdminControlBar', () => {
  it('shows draft status badge and Start Session button', () => {
    render(<AdminControlBar {...defaultProps} />);
    expect(screen.getByText('draft')).toBeDefined();
    expect(screen.getByText('Start Session')).toBeDefined();
    expect(screen.getByText('Add questions, then start')).toBeDefined();
  });

  it('calls onStartSession when Start button clicked', () => {
    const onStartSession = vi.fn();
    render(<AdminControlBar {...defaultProps} onStartSession={onStartSession} />);
    fireEvent.click(screen.getByText('Start Session'));
    expect(onStartSession).toHaveBeenCalledOnce();
  });

  it('disables Start button when transitioning', () => {
    render(<AdminControlBar {...defaultProps} transitioning={true} />);
    expect(screen.getByText('Starting...')).toBeDefined();
    expect((screen.getByText('Starting...') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows lobby status with Copy Link and Begin Voting', () => {
    render(
      <AdminControlBar {...defaultProps} status="lobby" participantCount={5} />
    );
    expect(screen.getByText('lobby')).toBeDefined();
    expect(screen.getByText('Copy Link')).toBeDefined();
    expect(screen.getByText('Begin Voting')).toBeDefined();
  });

  it('shows Copied! after copy link', () => {
    render(
      <AdminControlBar {...defaultProps} status="lobby" copied={true} />
    );
    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('calls onBeginVoting when Begin Voting clicked', () => {
    const onBeginVoting = vi.fn();
    render(
      <AdminControlBar {...defaultProps} status="lobby" onBeginVoting={onBeginVoting} />
    );
    fireEvent.click(screen.getByText('Begin Voting'));
    expect(onBeginVoting).toHaveBeenCalledOnce();
  });

  it('shows active question with close voting button', () => {
    const q = makeQuestion({ id: 'q1', text: 'Are we done?', status: 'active' });
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[q]}
        activeQuestion={q}
      />
    );
    expect(screen.getByText('Close Voting')).toBeDefined();
    expect(screen.getByText('End Session')).toBeDefined();
  });

  it('calls onCloseVoting with question id', () => {
    const onCloseVoting = vi.fn();
    const q = makeQuestion({ id: 'q1', status: 'active' });
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[q]}
        activeQuestion={q}
        onCloseVoting={onCloseVoting}
      />
    );
    fireEvent.click(screen.getByText('Close Voting'));
    expect(onCloseVoting).toHaveBeenCalledWith('q1');
  });

  it('shows timer pills and activate button when no active question but pending exists', () => {
    const q = makeQuestion({ id: 'q1', status: 'pending' });
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[q]}
        activeQuestion={null}
      />
    );
    expect(screen.getByText('15s')).toBeDefined();
    expect(screen.getByText('30s')).toBeDefined();
    expect(screen.getByText('60s')).toBeDefined();
    expect(screen.getByText('None')).toBeDefined();
    expect(screen.getByText('Activate Q1')).toBeDefined();
  });

  it('calls onActivateQuestion with selected timer when Activate clicked', () => {
    const onActivateQuestion = vi.fn();
    const q = makeQuestion({ id: 'q1', status: 'pending' });
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[q]}
        activeQuestion={null}
        onActivateQuestion={onActivateQuestion}
      />
    );
    // Select 30s timer
    fireEvent.click(screen.getByText('30s'));
    fireEvent.click(screen.getByText('Activate Q1'));
    expect(onActivateQuestion).toHaveBeenCalledWith('q1', 30);
  });

  it('shows quick question input when no pending questions and no active question', () => {
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[makeQuestion({ status: 'closed' })]}
        activeQuestion={null}
      />
    );
    expect(screen.getByPlaceholderText('Type a question...')).toBeDefined();
    expect(screen.getByText('Go Live')).toBeDefined();
  });

  it('calls onQuickQuestion when Go Live clicked', () => {
    const onQuickQuestion = vi.fn();
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        questions={[]}
        activeQuestion={null}
        onQuickQuestion={onQuickQuestion}
      />
    );
    const input = screen.getByPlaceholderText('Type a question...');
    fireEvent.change(input, { target: { value: 'Quick Q?' } });
    fireEvent.click(screen.getByText('Go Live'));
    expect(onQuickQuestion).toHaveBeenCalledWith('Quick Q?', null);
  });

  it('shows Session Complete in ended state', () => {
    render(<AdminControlBar {...defaultProps} status="ended" />);
    expect(screen.getByText('Session Complete')).toBeDefined();
    expect(screen.getByText('ended')).toBeDefined();
  });

  it('shows participant count in lobby and active states', () => {
    const { container } = render(
      <AdminControlBar {...defaultProps} status="lobby" participantCount={8} />
    );
    expect(container.innerHTML).toContain('8');
  });

  it('calls onEndSession when End Session clicked', () => {
    const onEndSession = vi.fn();
    render(
      <AdminControlBar
        {...defaultProps}
        status="active"
        onEndSession={onEndSession}
      />
    );
    fireEvent.click(screen.getByText('End Session'));
    expect(onEndSession).toHaveBeenCalledOnce();
  });
});
