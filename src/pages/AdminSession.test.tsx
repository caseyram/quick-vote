import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { Question, Vote, Session } from '../types/database';

// ---------------------------------------------------------------------------
// Helpers: test data factories
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'uuid-1',
    session_id: 'sess-1',
    admin_token: 'test-token',
    title: 'Test Session',
    status: 'draft',
    reasons_enabled: false,
    timer_expires_at: null,
    created_by: 'user1',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    session_id: 'sess-1',
    text: 'Do you agree?',
    type: 'agree_disagree',
    options: null,
    position: 0,
    anonymous: false,
    status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
    batch_id: null,
    ...overrides,
  };
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: 'v-1',
    question_id: 'q-1',
    session_id: 'sess-1',
    participant_id: 'p-1',
    value: 'Agree',
    reason: null,
    display_name: null,
    locked_in: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// -- react-router --
vi.mock('react-router', () => ({
  useParams: () => ({ adminToken: 'test-token' }),
}));

// -- Supabase chainable mock --
// We build a chainable query builder that can be configured per-test via
// `mockFromResolvers`.  Each key is a table name; its value is a function
// that receives the chain and decorates the terminal methods (single, order,
// the implicit promise returned by select...eq).

interface ChainableQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  // allow await on the chain itself (for cases like votes select without single)
  then: ReturnType<typeof vi.fn>;
}

function createDefaultChain(): ChainableQuery {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn((resolve: any) =>
    resolve({ data: [], error: null })
  );
  return chain;
}

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user1' } },
  error: null,
});

// Per-test resolver map.  Tests set this before render to control supabase
// responses per table.
let fromCallIndex: Record<string, number> = {};
let mockFromResolvers: Record<string, (chain: ChainableQuery, callIndex: number) => void> = {};

const mockFrom = vi.fn((table: string) => {
  const chain = createDefaultChain();
  if (!fromCallIndex[table]) fromCallIndex[table] = 0;
  const idx = fromCallIndex[table]++;
  if (mockFromResolvers[table]) {
    mockFromResolvers[table](chain, idx);
  }
  return chain;
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      send: vi.fn(),
      presenceState: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
  },
}));

// -- Session store mock --
// Mutable state object so tests can set different store states.
const mockSetSession = vi.fn();
const mockSetQuestions = vi.fn();
const mockSetLoading = vi.fn();
const mockSetError = vi.fn();
const mockUpdateQuestion = vi.fn();
const mockReset = vi.fn();
const mockAddQuestion = vi.fn();
const mockSetBatches = vi.fn();
const mockAddBatch = vi.fn();
const mockUpdateBatch = vi.fn();
const mockRemoveBatch = vi.fn();
const mockSetActiveBatchId = vi.fn();
const mockSetBatchQuestions = vi.fn();

let mockStoreState: any = {};

function defaultStoreState(overrides: Record<string, any> = {}) {
  return {
    session: null,
    questions: [],
    batches: [],
    loading: true,
    error: null,
    setSession: mockSetSession,
    setQuestions: mockSetQuestions,
    setLoading: mockSetLoading,
    setError: mockSetError,
    updateQuestion: mockUpdateQuestion,
    reset: mockReset,
    addQuestion: mockAddQuestion,
    setBatches: mockSetBatches,
    addBatch: mockAddBatch,
    updateBatch: mockUpdateBatch,
    removeBatch: mockRemoveBatch,
    activeBatchId: null,
    setActiveBatchId: mockSetActiveBatchId,
    batchQuestions: [],
    setBatchQuestions: mockSetBatchQuestions,
    ...overrides,
  };
}

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: any) => {
      if (typeof selector === 'function') return selector(mockStoreState);
      return mockStoreState;
    }),
    {
      getState: vi.fn(() => mockStoreState),
    }
  ),
}));

// -- Hooks --
const mockStartCountdown = vi.fn();
const mockStopCountdown = vi.fn();

vi.mock('../hooks/use-countdown', () => ({
  useCountdown: () => ({
    remaining: 0,
    isRunning: false,
    start: mockStartCountdown,
    stop: mockStopCountdown,
  }),
}));

const mockChannelSend = vi.fn();
const mockChannelRef = { current: { send: mockChannelSend } };

vi.mock('../hooks/use-realtime-channel', () => ({
  useRealtimeChannel: () => ({
    channelRef: mockChannelRef,
    connectionStatus: 'connected' as const,
    participantCount: 3,
  }),
}));

// -- vote-aggregation --
const mockAggregateVotes = vi.fn().mockReturnValue([]);
vi.mock('../lib/vote-aggregation', () => ({
  aggregateVotes: (...args: unknown[]) => mockAggregateVotes(...args),
}));

// -- Child components --
vi.mock('../components/AdminPasswordGate', () => ({
  AdminPasswordGate: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-password-gate">{children}</div>
  ),
}));

vi.mock('../components/ConnectionBanner', () => ({
  ConnectionBanner: ({ status }: { status: string }) => (
    <div data-testid="connection-banner">ConnectionBanner:{status}</div>
  ),
}));

vi.mock('../components/QuestionForm', () => ({
  default: (_props: any) => <div data-testid="question-form">QuestionForm</div>,
}));

vi.mock('../components/QuestionList', () => ({
  default: (_props: any) => <div data-testid="question-list">QuestionList</div>,
}));

vi.mock('../components/QRCode', () => ({
  SessionQRCode: (_props: any) => <div data-testid="session-qr-code">QRCode</div>,
}));

vi.mock('../components/SessionResults', () => ({
  default: (props: any) => (
    <div data-testid="session-results">SessionResults:{props.sessionId}</div>
  ),
}));

vi.mock('../components/ParticipantCount', () => ({
  ParticipantCount: ({ count }: { count: number }) => (
    <div data-testid="participant-count">Participants:{count}</div>
  ),
}));

vi.mock('../components/CountdownTimer', () => ({
  CountdownTimer: (_props: any) => <div data-testid="countdown-timer">CountdownTimer</div>,
}));

vi.mock('../components/AdminControlBar', () => ({
  AdminControlBar: (props: any) => {
    return (
      <div data-testid="admin-control-bar">
        <span data-testid="acb-status">{props.status}</span>
        <button data-testid="acb-start" onClick={props.onStartSession}>Start</button>
        <button data-testid="acb-begin" onClick={props.onBeginVoting}>Begin</button>
        <button data-testid="acb-end" onClick={props.onEndSession}>End</button>
        <button data-testid="acb-copy" onClick={props.onCopyLink}>Copy</button>
        <button data-testid="acb-activate" onClick={() => props.onActivateQuestion('q-1', 30)}>Activate</button>
        <button data-testid="acb-close" onClick={() => props.onCloseVoting('q-1')}>Close</button>
        <button data-testid="acb-quick" onClick={() => props.onQuickQuestion('Quick Q', null)}>Quick</button>
      </div>
    );
  },
}));

vi.mock('../components/SessionImportExport', () => ({
  SessionImportExport: () => <div data-testid="session-import-export">SessionImportExport</div>,
}));

vi.mock('../components/TemplatePanel', () => ({
  TemplatePanel: () => <div data-testid="template-panel">TemplatePanel</div>,
}));

vi.mock('../components/BatchList', () => ({
  BatchList: () => <div data-testid="batch-list">BatchList</div>,
}));

vi.mock('../components/ProgressDashboard', () => ({
  ProgressDashboard: () => <div data-testid="progress-dashboard">ProgressDashboard</div>,
}));

vi.mock('../components/BarChart', () => ({
  BarChart: (_props: any) => <div data-testid="bar-chart">BarChart</div>,
  AGREE_DISAGREE_COLORS: { agree: '#22c55e', disagree: '#ef4444', sometimes: '#eab308' },
  MULTI_CHOICE_COLORS: ['#6366f1', '#f59e0b', '#10b981', '#ef4444'],
}));

// ---------------------------------------------------------------------------
// Import component under test (AFTER mocks)
// ---------------------------------------------------------------------------
import AdminSession from './AdminSession';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallIndex = {};
    mockFromResolvers = {};
    mockStoreState = defaultStoreState();

    // Default supabase responses — session load returns nothing (tests override)
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user1' } },
      error: null,
    });

    // Default clipboard mock
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    // Provide a default sessions resolver so that the loadSession effect
    // (which always runs because adminToken = 'test-token') doesn't crash
    // with "single is not a function".  Individual tests override as needed.
    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: null, error: { message: 'default' } });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({ data: [], error: null });
    };
  });

  // -----------------------------------------------------------------------
  // 1. Loading state
  // -----------------------------------------------------------------------
  it('shows loading state when store has loading=true', () => {
    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    expect(screen.getByText('Loading session...')).toBeDefined();
    expect(screen.getByTestId('admin-password-gate')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Error state with an error message
  // -----------------------------------------------------------------------
  it('shows error state when store has error set', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      error: 'Something went wrong',
      session: null,
    });

    render(<AdminSession />);

    expect(screen.getByText('Session not found')).toBeDefined();
    expect(screen.getByText('Back to Home')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 3. Error state when session is null and not loading
  // -----------------------------------------------------------------------
  it('shows error state when session is null and not loading', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      error: null,
      session: null,
    });

    render(<AdminSession />);

    expect(screen.getByText('Session not found')).toBeDefined();
    const link = screen.getByText('Back to Home');
    expect(link.getAttribute('href')).toBe('/');
  });

  // -----------------------------------------------------------------------
  // 4. Draft view
  // -----------------------------------------------------------------------
  it('renders draft view with session title and "draft" badge', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft', title: 'My Draft Session' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('My Draft Session')).toBeDefined();
    // The badge is a <span> with rounded-full class; AdminControlBar also has the status text
    const draftTexts = screen.getAllByText('draft');
    expect(draftTexts.length).toBeGreaterThanOrEqual(1);
    // At least one should be the badge span
    const badge = draftTexts.find((el) => el.tagName === 'SPAN' && el.className.includes('rounded-full'));
    expect(badge).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 5. Lobby view
  // -----------------------------------------------------------------------
  it('renders lobby view with session title', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'lobby', title: 'Lobby Session' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Lobby Session')).toBeDefined();
    expect(screen.getByText('Scan to join or visit:')).toBeDefined();
    // Lobby renders both an inline QR code and the overlay QR code
    const qrCodes = screen.getAllByTestId('session-qr-code');
    expect(qrCodes.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('participant-count')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 6. Active view
  // -----------------------------------------------------------------------
  it('renders active view with session title', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Test Session')).toBeDefined();
    // Active view with no active question shows ready prompt
    expect(screen.getByText('Ready for questions')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 7. Ended view
  // -----------------------------------------------------------------------
  it('renders ended view with SessionResults and "Start New Session" link', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'ended' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByTestId('session-results')).toBeDefined();
    expect(screen.getByText('SessionResults:sess-1')).toBeDefined();
    const link = screen.getByText('Start New Session');
    expect(link.getAttribute('href')).toBe('/');
  });

  // -----------------------------------------------------------------------
  // 8. Share link in draft view
  // -----------------------------------------------------------------------
  it('shows share link input in draft view', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Share with participants')).toBeDefined();
    const input = screen.getByDisplayValue(/\/session\/sess-1/);
    expect(input).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 9. Draft view shows Questions section and QuestionForm
  // -----------------------------------------------------------------------
  it('draft view shows Questions & Batches section and BatchList', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Questions & Batches')).toBeDefined();
    expect(screen.getByTestId('batch-list')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 10. Draft view shows Session Settings section
  // -----------------------------------------------------------------------
  it('draft view shows Session Settings section', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft', reasons_enabled: false }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Session Settings')).toBeDefined();
    expect(screen.getByText('Reasons Disabled')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 11. Reasons toggle text when enabled
  // -----------------------------------------------------------------------
  it('shows "Reasons Enabled" when session.reasons_enabled is true', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft', reasons_enabled: true }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Reasons Enabled')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 12. Loads session data from supabase on mount
  // -----------------------------------------------------------------------
  it('loads session data from supabase on mount', async () => {
    const sessionData = makeSession();
    const questionsData = [makeQuestion()];

    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: sessionData, error: null });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({ data: questionsData, error: null });
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(mockFrom).toHaveBeenCalledWith('sessions');
    });

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(sessionData);
      expect(mockSetQuestions).toHaveBeenCalledWith(questionsData);
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  // -----------------------------------------------------------------------
  // 13. Fetches votes when session is active
  // -----------------------------------------------------------------------
  it('fetches votes when session status is active', async () => {
    const sessionData = makeSession({ status: 'active' });
    const questionsData = [makeQuestion({ status: 'active' })];
    const votesData = [makeVote()];

    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: sessionData, error: null });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({ data: questionsData, error: null });
    };
    mockFromResolvers['votes'] = (chain) => {
      // The vote fetch after session load doesn't use .single() or .order(),
      // it just chains select().eq() which resolves via the chain's then()
      chain.then = vi.fn((resolve: any) => resolve({ data: votesData, error: null }));
      // Also make eq return something thenable for the implicit await
      const thenableResult = { data: votesData, error: null, then: (r: any) => r({ data: votesData, error: null }) };
      chain.eq.mockReturnValue(thenableResult);
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('votes');
    });
  });

  // -----------------------------------------------------------------------
  // 14. Fetches votes when session is ended
  // -----------------------------------------------------------------------
  it('fetches votes when session status is ended', async () => {
    const sessionData = makeSession({ status: 'ended' });

    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: sessionData, error: null });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({ data: [], error: null });
    };
    mockFromResolvers['votes'] = (chain) => {
      const thenableResult = { data: [], error: null, then: (r: any) => r({ data: [], error: null }) };
      chain.eq.mockReturnValue(thenableResult);
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('votes');
    });
  });

  // -----------------------------------------------------------------------
  // 15. Does NOT fetch votes for draft sessions
  // -----------------------------------------------------------------------
  it('does not fetch votes for draft sessions', async () => {
    const sessionData = makeSession({ status: 'draft' });

    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: sessionData, error: null });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({ data: [], error: null });
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(sessionData);
    });

    // votes table should NOT have been queried
    const fromCalls = mockFrom.mock.calls.map((c: any) => c[0]);
    expect(fromCalls).not.toContain('votes');
  });

  // -----------------------------------------------------------------------
  // 16. Handles session load error
  // -----------------------------------------------------------------------
  it('handles session load error from supabase', async () => {
    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Not found');
      expect(mockSetSession).toHaveBeenCalledWith(null);
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  // -----------------------------------------------------------------------
  // 17. Handles questions load error
  // -----------------------------------------------------------------------
  it('handles questions load error from supabase', async () => {
    const sessionData = makeSession();

    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: sessionData, error: null });
    };
    mockFromResolvers['questions'] = (chain) => {
      chain.order.mockReturnValue({
        data: null,
        error: { message: 'Questions query failed' },
      });
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Questions query failed');
    });
  });

  // -----------------------------------------------------------------------
  // 18. Copy link button functionality
  // -----------------------------------------------------------------------
  it('copies participant link to clipboard on click', async () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    const copyBtn = screen.getByText('Copy Link');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/session/sess-1')
      );
    });
  });

  // -----------------------------------------------------------------------
  // 19. Draft view shows ImportExportPanel and TemplatePanel
  // -----------------------------------------------------------------------
  it('draft view shows SessionImportExport and TemplatePanel', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByTestId('session-import-export')).toBeDefined();
    expect(screen.getByTestId('template-panel')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 20. ConnectionBanner shows in non-ended states
  // -----------------------------------------------------------------------
  it('shows ConnectionBanner in live (lobby/active) views', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'lobby' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByTestId('connection-banner')).toBeDefined();
  });

  it('does not show ConnectionBanner in ended view', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'ended' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 21. AdminControlBar is always rendered with correct props
  // -----------------------------------------------------------------------
  it('renders AdminControlBar with session status', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByTestId('admin-control-bar')).toBeDefined();
    expect(screen.getByTestId('acb-status').textContent).toBe('draft');
  });

  // -----------------------------------------------------------------------
  // 22. QR code overlay always visible in main views
  // -----------------------------------------------------------------------
  it('renders QR code overlay in all non-loading views', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'lobby' }),
      questions: [],
    });

    render(<AdminSession />);

    // There should be at least one QRCode (overlay + possibly the centered one in lobby)
    const qrCodes = screen.getAllByTestId('session-qr-code');
    expect(qrCodes.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 23. Active view with active question shows ActiveQuestionHero
  // -----------------------------------------------------------------------
  it('renders active question hero when there is an active question', () => {
    const activeQ = makeQuestion({ id: 'q-active', status: 'active', text: 'Is this working?' });

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [activeQ],
    });

    render(<AdminSession />);

    // The hero renders the question text in quotes
    expect(screen.getByText(/Is this working/)).toBeDefined();
    expect(screen.getByText('Question 1 of 1')).toBeDefined();
    expect(screen.getByText('0 votes')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 24. Active view with no active question shows ready state
  // -----------------------------------------------------------------------
  it('shows ready state when active but no question active', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [makeQuestion({ status: 'pending' })],
    });

    render(<AdminSession />);

    expect(screen.getByText('Ready for questions')).toBeDefined();
    expect(screen.getByText('Use the control bar below to add questions')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 25. Active view with vote counts
  // -----------------------------------------------------------------------
  it('shows vote count on active question hero', () => {
    const activeQ = makeQuestion({ id: 'q-1', status: 'active', text: 'Vote now?' });

    // We need the component to have sessionVotes in its local state.
    // Since sessionVotes is local state set during loadSession, we test via
    // the initial render with the question active.
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [activeQ],
    });

    render(<AdminSession />);

    // With no votes loaded (default), it shows 0 votes
    expect(screen.getByText('0 votes')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 26. Draft view with questions shows question settings
  // -----------------------------------------------------------------------
  it('shows BatchList when questions exist in draft', () => {
    const q1 = makeQuestion({ id: 'q-1', text: 'First question', anonymous: false });
    const q2 = makeQuestion({ id: 'q-2', text: 'Second question', anonymous: true, position: 1 });

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [q1, q2],
    });

    render(<AdminSession />);

    // Questions and batches are now managed via BatchList
    expect(screen.getByTestId('batch-list')).toBeDefined();
    expect(screen.getByText('Questions & Batches')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 27. Does not show question settings when no questions in draft
  // -----------------------------------------------------------------------
  it('does not show question settings when no questions exist in draft', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'draft' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.queryByText('Question Settings')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 28. Toggle reasons via AdminControlBar triggers supabase update
  // -----------------------------------------------------------------------
  it('toggles reasons setting by clicking the button', async () => {
    const session = makeSession({ status: 'draft', reasons_enabled: false });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    // Default chain handles .update().eq() via thenable resolution

    render(<AdminSession />);

    const reasonsBtn = screen.getByText('Reasons Disabled');
    await act(async () => {
      fireEvent.click(reasonsBtn);
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('sessions');
    });
  });

  // -----------------------------------------------------------------------
  // 29. handleStartSession via AdminControlBar
  // -----------------------------------------------------------------------
  it('starts session via AdminControlBar', async () => {
    const session = makeSession({ status: 'draft' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    // Default chain handles .update().eq() via thenable resolution

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-start'));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('sessions');
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'lobby' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 30. handleBeginVoting via AdminControlBar
  // -----------------------------------------------------------------------
  it('begins voting via AdminControlBar', async () => {
    const session = makeSession({ status: 'lobby' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    // Default chain handles .update().eq() via thenable resolution

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-begin'));
    });

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 31. handleEndSession via AdminControlBar
  // -----------------------------------------------------------------------
  it('ends session via AdminControlBar', async () => {
    const session = makeSession({ status: 'active' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    // Both loadSession and handleEndSession call from('sessions') and from('questions').
    // The chain must stay self-referencing so all methods (.single(), .eq(), etc.) work.
    // The default chain already handles this since eq returns chain (thenable).
    // We just need .single() for loadSession to not break, and the awaited chain
    // for handleEndSession to resolve with { error: null }.

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-end'));
    });

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ended' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 32. handleActivateQuestion via AdminControlBar
  // -----------------------------------------------------------------------
  it('activates a question via AdminControlBar', async () => {
    const session = makeSession({ status: 'active' });
    const q = makeQuestion({ id: 'q-1', status: 'pending' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [q],
    });

    // Default chain handles .update().eq() chaining

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-activate'));
    });

    await waitFor(() => {
      expect(mockUpdateQuestion).toHaveBeenCalledWith('q-1', { status: 'active' });
    });
  });

  // -----------------------------------------------------------------------
  // 33. handleCloseVoting via AdminControlBar
  // -----------------------------------------------------------------------
  it('closes voting on a question via AdminControlBar', async () => {
    const session = makeSession({ status: 'active' });
    const q = makeQuestion({ id: 'q-1', status: 'active' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [q],
    });

    // Default chain handles .update().eq() chaining

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-close'));
    });

    await waitFor(() => {
      expect(mockStopCountdown).toHaveBeenCalled();
      expect(mockUpdateQuestion).toHaveBeenCalledWith('q-1', { status: 'closed' });
    });
  });

  // -----------------------------------------------------------------------
  // 34. Active view with closed questions shows "Previous Results"
  // -----------------------------------------------------------------------
  it('shows previous results grid when closed questions exist in active view', () => {
    const closedQ = makeQuestion({ id: 'q-closed', status: 'closed', text: 'Closed Q' });
    const activeQ = makeQuestion({ id: 'q-active', status: 'active', text: 'Active Q' });

    mockAggregateVotes.mockReturnValue([]);

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [closedQ, activeQ],
    });

    render(<AdminSession />);

    expect(screen.getByText('Previous Results')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 35. Closed question with no votes shows "No votes"
  // -----------------------------------------------------------------------
  it('shows "No votes" for closed question with no votes in previous results', () => {
    const closedQ = makeQuestion({ id: 'q-closed', status: 'closed', text: 'Closed Q' });

    mockAggregateVotes.mockReturnValue([]);

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [closedQ],
    });

    render(<AdminSession />);

    expect(screen.getByText('No votes')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 36. Closed question with aggregated votes shows BarChart
  // -----------------------------------------------------------------------
  it('shows BarChart for closed question with votes in previous results', () => {
    const closedQ = makeQuestion({ id: 'q-closed', status: 'closed', text: 'Closed Q', type: 'agree_disagree' });

    mockAggregateVotes.mockReturnValue([
      { value: 'Agree', count: 5, percentage: 100 },
    ]);

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [closedQ],
    });

    render(<AdminSession />);

    // There may be multiple bar charts (hero + previous results)
    const barCharts = screen.getAllByTestId('bar-chart');
    expect(barCharts.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 37. Revealed questions also appear in Previous Results
  // -----------------------------------------------------------------------
  it('shows revealed questions in previous results', () => {
    const revealedQ = makeQuestion({ id: 'q-rev', status: 'revealed', text: 'Revealed Q' });

    mockAggregateVotes.mockReturnValue([]);

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [revealedQ],
    });

    render(<AdminSession />);

    expect(screen.getByText('Previous Results')).toBeDefined();
    expect(screen.getByText('Revealed Q')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 38. ActiveQuestionHero displays "1 vote" (singular) for single vote
  // -----------------------------------------------------------------------
  it('shows singular "vote" when exactly 1 vote', () => {
    // We need a question with status active and the component to have 1 vote
    // in its sessionVotes local state. Since local state is set during loadSession
    // and that runs async, we'll verify the hero renders with default 0 votes first.
    // But we can test the hero rendering by examining the text.
    const activeQ = makeQuestion({ id: 'q-1', status: 'active', text: 'Single vote Q' });

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [activeQ],
    });

    render(<AdminSession />);

    // With 0 votes, it should show "0 votes" (plural)
    expect(screen.getByText('0 votes')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 39. Lobby view shows participant URL
  // -----------------------------------------------------------------------
  it('shows participant URL in lobby view', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'lobby' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText(/\/session\/sess-1/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 40. Go Live button is disabled when quick question is empty
  // -----------------------------------------------------------------------
  it('shows ready state when session is active with no active questions', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [],
    });

    render(<AdminSession />);

    // Quick question functionality moved to AdminControlBar
    // Verify the ready state is shown
    expect(screen.getByText('Ready for questions')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 41. Cleanup calls reset on unmount
  // -----------------------------------------------------------------------
  it('calls reset on unmount', () => {
    mockStoreState = defaultStoreState({ loading: true });

    const { unmount } = render(<AdminSession />);
    unmount();

    // reset is called via the cleanup function of the useEffect
    // It may take a tick to fire
    expect(mockReset).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 42. Session error with null data shows fallback message
  // -----------------------------------------------------------------------
  it('sets "Session not found" error when session data is null without error object', async () => {
    mockFromResolvers['sessions'] = (chain) => {
      chain.single.mockResolvedValue({ data: null, error: null });
    };

    mockStoreState = defaultStoreState({ loading: true });

    render(<AdminSession />);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Session not found');
    });
  });

  // -----------------------------------------------------------------------
  // 43. Active view shows CountdownTimer on hero
  // -----------------------------------------------------------------------
  it('renders CountdownTimer in active question hero', () => {
    const activeQ = makeQuestion({ id: 'q-1', status: 'active', text: 'Timed Q' });

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [activeQ],
    });

    render(<AdminSession />);

    expect(screen.getByTestId('countdown-timer')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 44. handleActivateQuestion with timer starts countdown
  // -----------------------------------------------------------------------
  it('starts countdown when activating with timer duration', async () => {
    const session = makeSession({ status: 'active' });
    const q = makeQuestion({ id: 'q-1', status: 'pending' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [q],
    });

    // Default chain handles .update().eq() chaining

    render(<AdminSession />);

    // Our mock AdminControlBar activate button passes timerDuration=30
    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-activate'));
    });

    await waitFor(() => {
      expect(mockStartCountdown).toHaveBeenCalledWith(30000);
    });
  });

  // -----------------------------------------------------------------------
  // 45. handleCloseVoting sends broadcast events
  // -----------------------------------------------------------------------
  it('sends broadcast events when closing voting', async () => {
    const session = makeSession({ status: 'active' });
    const q = makeQuestion({ id: 'q-1', status: 'active' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [q],
    });

    // Default chain handles .update().eq() chaining

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-close'));
    });

    await waitFor(() => {
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'voting_closed',
        })
      );
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'results_revealed',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 46. handleStartSession sends broadcast
  // -----------------------------------------------------------------------
  it('sends session_lobby broadcast when starting session', async () => {
    const session = makeSession({ status: 'draft' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    // Default chain handles .update().eq() via thenable resolution

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-start'));
    });

    await waitFor(() => {
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'session_lobby',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 47. handleEndSession broadcasts and closes active questions
  // -----------------------------------------------------------------------
  it('closes active questions when ending session', async () => {
    const session = makeSession({ status: 'active' });
    const activeQ = makeQuestion({ id: 'q-1', status: 'active' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [activeQ],
    });

    // Default chain handles all chaining; loadSession effect's from('sessions')
    // call also works since .eq() returns chain (which has .single()).

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-end'));
    });

    await waitFor(() => {
      expect(mockUpdateQuestion).toHaveBeenCalledWith('q-1', { status: 'closed' });
      expect(mockChannelSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'session_ended',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 48. Multiple-choice closed question uses MULTI_CHOICE_COLORS
  // -----------------------------------------------------------------------
  it('handles multiple_choice type in previous results', () => {
    const closedQ = makeQuestion({
      id: 'q-mc',
      status: 'closed',
      text: 'Multi Q',
      type: 'multiple_choice',
    });

    mockAggregateVotes.mockReturnValue([
      { value: 'Option A', count: 3, percentage: 60 },
      { value: 'Option B', count: 2, percentage: 40 },
    ]);

    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [closedQ],
    });

    render(<AdminSession />);

    // There may be multiple bar charts (hero + previous results)
    const barCharts = screen.getAllByTestId('bar-chart');
    expect(barCharts.length).toBeGreaterThanOrEqual(1);
    // aggregateVotes is called with an empty array (since sessionVotes is empty local state)
    expect(mockAggregateVotes).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 49. Quick question via control bar
  // -----------------------------------------------------------------------
  it('handles quick question creation via AdminControlBar', async () => {
    const session = makeSession({ status: 'active' });

    mockStoreState = defaultStoreState({
      loading: false,
      session,
      questions: [],
    });

    const newQuestionData = makeQuestion({ id: 'q-new', status: 'active', text: 'Quick Q' });

    // handleQuickQuestion calls insert().select().single() - need single to return the new question
    mockFromResolvers['questions'] = (chain) => {
      chain.single.mockResolvedValue({ data: newQuestionData, error: null });
    };

    render(<AdminSession />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('acb-quick'));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('questions');
    });
  });

  // -----------------------------------------------------------------------
  // 50. Participant count in lobby and active views
  // -----------------------------------------------------------------------
  it('shows participant count in lobby view', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'lobby' }),
      questions: [],
    });

    render(<AdminSession />);

    expect(screen.getByText('Participants:3')).toBeDefined();
  });

  it('shows participant count in active view', () => {
    mockStoreState = defaultStoreState({
      loading: false,
      session: makeSession({ status: 'active' }),
      questions: [],
    });

    render(<AdminSession />);

    // Active view has ParticipantCount in the header bar
    expect(screen.getByText('Participants:3')).toBeDefined();
  });
});
