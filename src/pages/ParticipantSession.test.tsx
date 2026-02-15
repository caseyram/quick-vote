import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question, Session } from '../types/database';

// ---------------------------------------------------------------------------
// Mocks -- declared BEFORE the component import
// ---------------------------------------------------------------------------

// 1. react-router
vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ sessionId: 'session-123' })),
}));

// 2. motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// 3. supabase -- chainable mock
const mockGetUser = vi.fn();

function createQueryChain(resolvedData: any, resolvedError: any = null) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  return chain;
}

let sessionsChain: any;
let questionsChain: any;

function setupSupabaseMock(options: {
  user?: { id: string } | null;
  sessionData?: any;
  sessionError?: any;
  activeQuestion?: any;
  allQuestions?: any[];
}) {
  const {
    user = { id: 'user-1' },
    sessionData = null,
    sessionError = null,
    activeQuestion = null,
    allQuestions = [],
  } = options;

  mockGetUser.mockResolvedValue({ data: { user } });

  sessionsChain = createQueryChain(sessionData, sessionError);
  questionsChain = createQueryChain(activeQuestion);
  // For questions chain, we need order() to return allQuestions array,
  // and maybeSingle() to return activeQuestion.
  questionsChain.order = vi.fn().mockResolvedValue({ data: allQuestions, error: null });
  questionsChain.maybeSingle = vi.fn().mockResolvedValue({ data: activeQuestion, error: null });
  questionsChain.single = vi.fn().mockResolvedValue({ data: activeQuestion, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'sessions') return sessionsChain;
    if (table === 'questions') return questionsChain;
    return createQueryChain(null);
  });
}

const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// 4. session store
const mockSetSession = vi.fn();
const mockReset = vi.fn();
let mockSession: Session | null = null;

vi.mock('../stores/session-store', () => ({
  useSessionStore: vi.fn(() => ({
    session: mockSession,
    setSession: mockSetSession,
    reset: mockReset,
  })),
}));

// 5. useRealtimeChannel
let mockConnectionStatus = 'connected';
let mockParticipantCount = 5;
let capturedSetupFn: ((channel: any) => void) | null = null;

vi.mock('../hooks/use-realtime-channel', () => ({
  useRealtimeChannel: vi.fn((_channelName: string, setup: any, _enabled: boolean) => {
    capturedSetupFn = setup;
    return {
      connectionStatus: mockConnectionStatus,
      participantCount: mockParticipantCount,
    };
  }),
}));

// 6. useCountdown
const mockStartCountdown = vi.fn();
const mockStopCountdown = vi.fn();

vi.mock('../hooks/use-countdown', () => ({
  useCountdown: vi.fn(() => ({
    remaining: 0,
    isRunning: false,
    start: mockStartCountdown,
    stop: mockStopCountdown,
  })),
}));

// 7. Child components
vi.mock('../components/ConnectionPill', () => ({
  ConnectionPill: ({ status }: any) => <div data-testid="connection-pill">ConnectionPill {status}</div>,
}));

vi.mock('../components/CountdownTimer', () => ({
  CountdownTimer: ({ remainingSeconds }: any) => (
    <div data-testid="countdown-timer">CountdownTimer {remainingSeconds}</div>
  ),
}));

vi.mock('../components/ParticipantCount', () => ({
  ParticipantCount: ({ count }: any) => <div data-testid="participant-count">ParticipantCount {count}</div>,
}));

vi.mock('../components/VoteAgreeDisagree', () => ({
  default: (props: any) => (
    <div data-testid="vote-agree-disagree">VoteAgreeDisagree {props.question?.text}</div>
  ),
}));

vi.mock('../components/VoteMultipleChoice', () => ({
  default: (props: any) => (
    <div data-testid="vote-multiple-choice">VoteMultipleChoice {props.question?.text}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks
// ---------------------------------------------------------------------------
import ParticipantSession from './ParticipantSession';
import { useParams } from 'react-router';
import { useCountdown } from '../hooks/use-countdown';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'uuid-1',
  session_id: 'session-123',
  admin_token: '',
  title: 'Test Session',
  status: 'lobby',
  reasons_enabled: false,
  test_mode: false,
  timer_expires_at: null,
  created_by: '',
  created_at: '2025-01-01T00:00:00Z',
  default_template_id: null,
  teams: [],
  ...overrides,
});

const makeSessionRow = (overrides: Record<string, any> = {}) => ({
  id: 'uuid-1',
  session_id: 'session-123',
  title: 'Test Session',
  status: 'lobby',
  reasons_enabled: false,
  created_at: '2025-01-01T00:00:00Z',
  default_template_id: null,
  ...overrides,
});

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 'q1',
  session_id: 'session-123',
  text: 'Do you agree?',
  type: 'agree_disagree',
  options: null,
  position: 0,
  anonymous: true,
  status: 'active',
  created_at: '2025-01-01T00:00:00Z',
  batch_id: null,
  template_id: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('ParticipantSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockConnectionStatus = 'connected';
    mockParticipantCount = 5;
    capturedSetupFn = null;

    // Reset useParams to default
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ sessionId: 'session-123' });

    // Reset useCountdown to defaults (not running)
    (useCountdown as ReturnType<typeof vi.fn>).mockReturnValue({
      remaining: 0,
      isRunning: false,
      start: mockStartCountdown,
      stop: mockStopCountdown,
    });

    // Clear sessionStorage
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Loading state
  // -----------------------------------------------------------------------
  it('shows loading state initially before async load completes', () => {
    // Auth resolves but never settles before assertion
    mockGetUser.mockReturnValue(new Promise(() => {})); // never resolves
    mockFrom.mockReturnValue(createQueryChain(null));

    render(<ParticipantSession />);
    expect(screen.getByText('Loading session...')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Error when auth fails (user is null)
  // -----------------------------------------------------------------------
  it('shows error when authentication fails (user is null)', async () => {
    setupSupabaseMock({ user: null });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Authentication failed. Please refresh the page.')).toBeDefined();
    });
    expect(screen.getByText('Please check the link and try again.')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 3. Error when session not found
  // -----------------------------------------------------------------------
  it('shows error when session is not found', async () => {
    setupSupabaseMock({
      sessionData: null,
      sessionError: { message: 'Session not found' },
    });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeDefined();
    });
    expect(screen.getByText('Please check the link and try again.')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. Lobby view for lobby/draft session
  // -----------------------------------------------------------------------
  it('shows lobby view for a session with lobby status', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });
    expect(screen.getByText('Test Session')).toBeDefined();
    expect(screen.getByTestId('connection-pill')).toBeDefined();
    expect(screen.getByTestId('participant-count')).toBeDefined();
  });

  it('shows lobby view for a session with draft status', async () => {
    const sessionRow = makeSessionRow({ status: 'draft' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'draft' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Waiting view for active session with no active question
  // -----------------------------------------------------------------------
  it('shows waiting view for active session with no active question', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });
    expect(screen.getByText('Test Session')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 6. Voting view with VoteAgreeDisagree
  // -----------------------------------------------------------------------
  it('shows VoteAgreeDisagree for an agree_disagree question', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ type: 'agree_disagree', text: 'Is this right?' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });
    expect(screen.getByText(/VoteAgreeDisagree Is this right\?/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 7. Voting view with VoteMultipleChoice
  // -----------------------------------------------------------------------
  it('shows VoteMultipleChoice for a multiple_choice question', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({
      type: 'multiple_choice',
      text: 'Pick one',
      options: ['A', 'B', 'C'],
    });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-multiple-choice')).toBeDefined();
    });
    expect(screen.getByText(/VoteMultipleChoice Pick one/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 8. Results view for ended session with question list
  // -----------------------------------------------------------------------
  it('shows results view for ended session with question list', async () => {
    const sessionRow = makeSessionRow({ status: 'ended' });
    const questions = [
      makeQuestion({ id: 'q1', text: 'First question?', position: 0 }),
      makeQuestion({ id: 'q2', text: 'Second question?', position: 1, type: 'multiple_choice' }),
    ];
    setupSupabaseMock({
      sessionData: sessionRow,
      allQuestions: questions,
    });
    mockSession = makeSession({ status: 'ended' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText(/Session has ended/)).toBeDefined();
    });
    expect(screen.getByText('Test Session - Complete')).toBeDefined();
    expect(screen.getByText('First question?')).toBeDefined();
    expect(screen.getByText('Second question?')).toBeDefined();
    expect(screen.getByText('Question 1')).toBeDefined();
    expect(screen.getByText('Question 2')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 9. Name prompt for named (non-anonymous) questions
  // -----------------------------------------------------------------------
  it('shows name prompt for non-anonymous questions when no name is stored', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({
      anonymous: false,
      text: 'Named question?',
    });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('This question shows voter names')).toBeDefined();
    });
    expect(screen.getByPlaceholderText('Enter your name')).toBeDefined();
    expect(screen.getByText('Continue')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 10. Error message shows correct text
  // -----------------------------------------------------------------------
  it('shows the correct error message from session fetch error', async () => {
    setupSupabaseMock({
      sessionData: null,
      sessionError: { message: 'Row not found or something' },
    });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Row not found or something')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 11. Session title shows in lobby view
  // -----------------------------------------------------------------------
  it('displays the session title prominently in lobby view', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby', title: 'My Cool Session' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby', title: 'My Cool Session' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('My Cool Session')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 12. Results view shows "Session has ended. Thank you for participating!"
  // -----------------------------------------------------------------------
  it('shows thank you message in results view', async () => {
    const sessionRow = makeSessionRow({ status: 'ended' });
    setupSupabaseMock({
      sessionData: sessionRow,
      allQuestions: [],
    });
    mockSession = makeSession({ status: 'ended' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Session has ended. Thank you for participating!')).toBeDefined();
    });
    // Also check the bottom "Thank you for participating!" text
    const thankYous = screen.getAllByText(/Thank you for participating/);
    expect(thankYous.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 13. Name prompt submit stores name and hides prompt
  // -----------------------------------------------------------------------
  it('submits name from the name prompt and shows the voting UI', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: false, text: 'Named vote' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    // Wait for name prompt to appear
    await waitFor(() => {
      expect(screen.getByText('This question shows voter names')).toBeDefined();
    });

    // Type a name
    const input = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(input, { target: { value: 'Alice' } });

    // Submit
    fireEvent.submit(input.closest('form')!);

    // After submitting, the name prompt should close and voting UI should show
    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });

    // Verify sessionStorage was updated
    expect(sessionStorage.getItem('quickvote-display-name')).toBe('Alice');
  });

  // -----------------------------------------------------------------------
  // 14. Name prompt does not submit if name is empty/whitespace
  // -----------------------------------------------------------------------
  it('does not submit if the name input is empty', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: false, text: 'Named vote' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('This question shows voter names')).toBeDefined();
    });

    // Submit without typing anything
    const form = screen.getByPlaceholderText('Enter your name').closest('form')!;
    fireEvent.submit(form);

    // Name prompt should still be visible
    expect(screen.getByText('This question shows voter names')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 15. setSession is called with session data from load
  // -----------------------------------------------------------------------
  it('calls setSession with fetched session data', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalled();
    });

    const calledWith = mockSetSession.mock.calls[0][0];
    expect(calledWith.session_id).toBe('session-123');
    expect(calledWith.title).toBe('Test Session');
    expect(calledWith.admin_token).toBe('');
    expect(calledWith.created_by).toBe('');
  });

  // -----------------------------------------------------------------------
  // 16. reset is called on unmount
  // -----------------------------------------------------------------------
  it('calls reset on unmount', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby' });

    const { unmount } = render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });

    unmount();
    expect(mockReset).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 17. Default error message when no session error message
  // -----------------------------------------------------------------------
  it('shows "Session not found" as default when error has no message', async () => {
    setupSupabaseMock({
      sessionData: null,
      sessionError: null, // no error object either; sessionData is null
    });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 18. Reads display name from sessionStorage on mount
  // -----------------------------------------------------------------------
  it('reads display name from sessionStorage on mount', async () => {
    sessionStorage.setItem('quickvote-display-name', 'StoredUser');

    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: false, text: 'Named q' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    // Because the name is stored, the name prompt should NOT appear;
    // the voting UI should show directly.
    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });
    // Name prompt text should not be present
    expect(screen.queryByText('This question shows voter names')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 19. Fallback view shows "Loading..." text
  // -----------------------------------------------------------------------
  it('shows fallback loading when no sessionId is provided', () => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ sessionId: undefined });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFrom.mockReturnValue(createQueryChain(null));

    render(<ParticipantSession />);
    // Without a sessionId, the loadInitial effect does not run and view stays 'loading'
    expect(screen.getByText('Loading session...')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 20. Results view with participantCount > 0 shows ParticipantCount
  // -----------------------------------------------------------------------
  it('shows ParticipantCount in results view when count > 0', async () => {
    mockParticipantCount = 10;
    const sessionRow = makeSessionRow({ status: 'ended' });
    setupSupabaseMock({
      sessionData: sessionRow,
      allQuestions: [makeQuestion()],
    });
    mockSession = makeSession({ status: 'ended' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Test Session - Complete')).toBeDefined();
    });
    expect(screen.getByTestId('participant-count')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 21. Results view with participantCount === 0 hides ParticipantCount
  // -----------------------------------------------------------------------
  it('hides ParticipantCount in results view when count is 0', async () => {
    mockParticipantCount = 0;
    const sessionRow = makeSessionRow({ status: 'ended' });
    setupSupabaseMock({
      sessionData: sessionRow,
      allQuestions: [],
    });
    mockSession = makeSession({ status: 'ended' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Test Session - Complete')).toBeDefined();
    });
    // ParticipantCount should not be rendered when count is 0
    expect(screen.queryByTestId('participant-count')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 22. Question type is displayed in results view
  // -----------------------------------------------------------------------
  it('displays question type (formatted) in results view', async () => {
    const sessionRow = makeSessionRow({ status: 'ended' });
    const questions = [
      makeQuestion({ id: 'q1', text: 'Q1', type: 'agree_disagree' }),
      makeQuestion({ id: 'q2', text: 'Q2', type: 'multiple_choice' }),
    ];
    setupSupabaseMock({
      sessionData: sessionRow,
      allQuestions: questions,
    });
    mockSession = makeSession({ status: 'ended' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeDefined();
    });
    // agree_disagree becomes "agree/disagree", multiple_choice becomes "multiple/choice"
    expect(screen.getByText('agree/disagree')).toBeDefined();
    expect(screen.getByText('multiple/choice')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 23. Waiting view shows custom waiting message
  // -----------------------------------------------------------------------
  it('shows the session title in waiting view', async () => {
    const sessionRow = makeSessionRow({ status: 'active', title: 'Standup Vote' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active', title: 'Standup Vote' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Standup Vote')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 24. Continue button is disabled when name is empty
  // -----------------------------------------------------------------------
  it('disables Continue button when name input is empty', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: false });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeDefined();
    });

    const button = screen.getByText('Continue') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 25. Continue button is enabled when name is typed
  // -----------------------------------------------------------------------
  it('enables Continue button when name is typed', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: false });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeDefined();
    });

    const input = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(input, { target: { value: 'Bob' } });

    const button = screen.getByText('Continue') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 26. Name prompt does NOT show for anonymous questions
  // -----------------------------------------------------------------------
  it('does not show name prompt for anonymous questions', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ anonymous: true, text: 'Anonymous Q' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });
    expect(screen.queryByText('This question shows voter names')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 27. ConnectionPill is rendered in lobby view
  // -----------------------------------------------------------------------
  it('renders ConnectionPill in the lobby view', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-pill')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 28. Broadcast: session_ended transitions to results
  // -----------------------------------------------------------------------
  it('transitions to results view on session_ended broadcast', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
      allQuestions: [makeQuestion({ id: 'q1', text: 'Broadcast Q' })],
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });

    // Simulate the broadcast by calling the captured setup function's registered handler
    // We need to invoke the setupChannel callback to register handlers on a fake channel
    expect(capturedSetupFn).not.toBeNull();
    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    // Now call session_ended handler
    await handlers['session_ended']();

    await waitFor(() => {
      expect(screen.getByText(/Session has ended/)).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 29. Broadcast: session_active transitions to waiting
  // -----------------------------------------------------------------------
  it('transitions to waiting on session_active broadcast', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    mockSession = makeSession({ status: 'lobby' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    handlers['session_active']();

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 30. Broadcast: question_activated transitions to voting
  // -----------------------------------------------------------------------
  it('transitions to voting on question_activated broadcast', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ id: 'q-new', text: 'Broadcast question' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });

    // Now update the questions chain to return the new question for the broadcast fetch
    questionsChain.single = vi.fn().mockResolvedValue({ data: question, error: null });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    await handlers['question_activated']({ payload: { questionId: 'q-new', timerSeconds: null } });

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 31. Broadcast: question_activated with timer starts countdown
  // -----------------------------------------------------------------------
  it('starts countdown on question_activated with timerSeconds', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ id: 'q-timed', text: 'Timed question' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });

    questionsChain.single = vi.fn().mockResolvedValue({ data: question, error: null });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    await handlers['question_activated']({ payload: { questionId: 'q-timed', timerSeconds: 30 } });

    expect(mockStartCountdown).toHaveBeenCalledWith(30000);
  });

  // -----------------------------------------------------------------------
  // 32. Broadcast: voting_closed transitions to waiting with review message
  // -----------------------------------------------------------------------
  it('transitions to waiting with review message on voting_closed', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ text: 'Active question' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    handlers['voting_closed']({ payload: { questionId: 'q1' } });

    await waitFor(() => {
      expect(screen.getByText('The host is reviewing results...')).toBeDefined();
    });
    expect(mockStopCountdown).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 33. Broadcast: results_revealed shows results being shown message
  // -----------------------------------------------------------------------
  it('shows results-on-screen message on results_revealed broadcast', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ text: 'Q' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    handlers['results_revealed']({ payload: { questionId: 'q1' } });

    await waitFor(() => {
      expect(screen.getByText('Results are being shown on the main screen')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 34. Broadcast: session_lobby transitions to lobby
  // -----------------------------------------------------------------------
  it('transitions to lobby on session_lobby broadcast', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    handlers['session_lobby']();

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });
    expect(mockStopCountdown).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 35. CountdownTimer shown when timer is running
  // -----------------------------------------------------------------------
  it('shows CountdownTimer when timer is running in voting view', async () => {
    // Override useCountdown to report isRunning = true
    (useCountdown as ReturnType<typeof vi.fn>).mockReturnValue({
      remaining: 15000,
      isRunning: true,
      start: mockStartCountdown,
      stop: mockStopCountdown,
    });

    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ text: 'Timed Q' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: question,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByTestId('vote-agree-disagree')).toBeDefined();
    });
    expect(screen.getByTestId('countdown-timer')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 36. Session title defaults to 'Session' if not loaded yet
  // -----------------------------------------------------------------------
  it('falls back to "Session" if session store has no title yet', async () => {
    const sessionRow = makeSessionRow({ status: 'lobby' });
    setupSupabaseMock({ sessionData: sessionRow });
    // Keep mockSession null to simulate store not yet updated
    mockSession = null;

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for host to start...')).toBeDefined();
    });
    expect(screen.getByText('Session')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 37. question_activated with timerSeconds = 0 stops countdown
  // -----------------------------------------------------------------------
  it('stops countdown when question_activated has timerSeconds of 0', async () => {
    const sessionRow = makeSessionRow({ status: 'active' });
    const question = makeQuestion({ id: 'q-notimed' });
    setupSupabaseMock({
      sessionData: sessionRow,
      activeQuestion: null,
    });
    mockSession = makeSession({ status: 'active' });

    render(<ParticipantSession />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for next question...')).toBeDefined();
    });

    questionsChain.single = vi.fn().mockResolvedValue({ data: question, error: null });

    const handlers: Record<string, Function> = {};
    const fakeChannel = {
      on: vi.fn((_type: string, opts: any, handler: Function) => {
        handlers[opts.event] = handler;
        return fakeChannel;
      }),
    };
    capturedSetupFn!(fakeChannel);

    // Clear mocks to track only broadcast-triggered calls
    mockStopCountdown.mockClear();

    await handlers['question_activated']({ payload: { questionId: 'q-notimed', timerSeconds: 0 } });

    expect(mockStopCountdown).toHaveBeenCalled();
    expect(mockStartCountdown).not.toHaveBeenCalled();
  });
});
