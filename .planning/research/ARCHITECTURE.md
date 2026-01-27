# Architecture Patterns: Real-Time Voting System (QuickVote)

**Domain:** Real-time voting / audience polling web application
**Researched:** 2026-01-27
**Overall confidence:** MEDIUM (based on training data; WebSearch/WebFetch unavailable for live verification)

---

## Recommended Architecture

QuickVote is a **real-time broadcast-and-collect system**: the admin pushes state changes (new question, close voting, reveal results) and participants react (submit votes). The data flows are asymmetric -- one admin broadcasts to many participants, many participants write votes that aggregate back to the admin's view.

### High-Level System Diagram

```
+------------------+       +-------------------+       +------------------+
|  Admin Client    | <---> |   Supabase        | <---> | Participant      |
|  (React SPA)     |       |                   |       | Clients (React)  |
|                  |       |  - Database (PG)  |       |                  |
|  Creates session |       |  - Realtime       |       |  Joins via QR    |
|  Pushes questions|       |    (WebSocket)    |       |  Sees questions  |
|  Views results   |       |  - Auth (anon)    |       |  Submits votes   |
|                  |       |  - Edge Functions |       |                  |
+------------------+       +-------------------+       +------------------+
        |                          |                          |
        |    Vercel (hosting)      |    Supabase (backend)    |
        +--------------------------+--------------------------+
```

### Core Insight: Two Realtime Mechanisms, Different Purposes

Supabase Realtime offers three channel types. QuickVote should use **two** of them strategically:

| Mechanism | Use In QuickVote | Why |
|-----------|------------------|-----|
| **Broadcast** | Admin pushing session state (current question, voting open/closed, reveal results) | Low-latency, ephemeral, no database write needed for state transitions. Admin sends, all participants receive instantly. |
| **Postgres Changes** | Vote aggregation -- admin sees live vote counts as participants submit | Votes are persisted to DB; listening to inserts gives live tallies without extra plumbing. |
| **Presence** | Participant count / "who's here" in lobby | Shows admin how many people have joined before starting. |

**Confidence: MEDIUM** -- This three-mechanism split is well-documented in Supabase's architecture as of my training data (early 2025). Verify against current Supabase Realtime docs that Broadcast, Presence, and Postgres Changes are still the three primitives.

---

## Component Boundaries

### Component 1: Session Management

**Responsibility:** Create sessions, generate unique admin links, generate participant join codes/QR URLs.

| Aspect | Detail |
|--------|--------|
| **Data** | `sessions` table: id (UUID), admin_token (unique), join_code (short string), mode (live/self-paced), created_at, status (lobby/active/ended) |
| **Who writes** | Admin client on session creation |
| **Who reads** | Admin client (via admin_token), Participant client (via join_code) |
| **Realtime** | None needed -- session is created once, rarely updated |

**Key decision:** The admin_token in the URL is the sole authentication for the admin. No accounts, no passwords. This means the session URL IS the credential. Treat it like a bearer token.

### Component 2: Question Engine

**Responsibility:** Store questions, manage question ordering, track which question is "current" in a live session.

| Aspect | Detail |
|--------|--------|
| **Data** | `questions` table: id, session_id (FK), text, type (agree_disagree/multiple_choice), options (JSONB for MC), position (ordering), anonymous (boolean), status (pending/active/closed) |
| **Who writes** | Admin client (creates questions, changes status) |
| **Who reads** | Both admin and participant clients |
| **Realtime** | **Broadcast** for live mode: admin advances question, broadcast tells all participants "show question X now" |

### Component 3: Vote Collection

**Responsibility:** Accept and store individual votes, enforce one-vote-per-participant-per-question.

| Aspect | Detail |
|--------|--------|
| **Data** | `votes` table: id, question_id (FK), session_id (FK), participant_id (client-generated UUID stored in localStorage), value (text -- the choice), display_name (nullable, for named votes), created_at |
| **Who writes** | Participant clients |
| **Who reads** | Admin client (for results), participant client (to check "did I already vote?") |
| **Realtime** | **Postgres Changes** -- admin subscribes to INSERT on votes table filtered by session_id. Each new vote triggers a live tally update on admin's results view. |
| **Constraint** | UNIQUE(question_id, participant_id) prevents double-voting. Handle conflict at DB level (ON CONFLICT DO NOTHING or upsert). |

### Component 4: Results Aggregation

**Responsibility:** Compute and display vote tallies in real time.

| Aspect | Detail |
|--------|--------|
| **Data** | Derived from `votes` table -- COUNT grouped by value per question |
| **Computation** | Client-side aggregation from Postgres Changes stream, OR a database view/function |
| **Who reads** | Admin client (always), Participant client (when results are revealed) |
| **Realtime** | Rides on Component 3's Postgres Changes subscription. Each INSERT triggers re-aggregation client-side. |

**Architecture decision: Client-side vs server-side aggregation.**

For v1 (50-100 participants), **client-side aggregation is correct**:
- Each vote INSERT arrives via Postgres Changes
- Admin client maintains a local count map: `{ [choiceValue]: count }`
- On each new vote event, increment the relevant counter
- Chart re-renders reactively

At 50-100 concurrent voters, this is well within client capacity. Server-side aggregation (Supabase Edge Function or DB view) becomes worthwhile above ~500 concurrent voters per question.

### Component 5: Session State Machine (Live Mode)

**Responsibility:** Orchestrate the flow of a live presentation session.

```
LOBBY --> QUESTION_ACTIVE --> VOTING_CLOSED --> RESULTS_REVEALED
  ^                                                    |
  |                                                    v
  +-------- NEXT_QUESTION (loops) --------<-----------+
                                                       |
                                                  SESSION_ENDED
```

| State | What Admin Sees | What Participants See |
|-------|-----------------|----------------------|
| LOBBY | Waiting screen with participant count, QR code | "Waiting for host to start..." |
| QUESTION_ACTIVE | Question + live vote count streaming in | Question + voting buttons (full-screen tactile UI) |
| VOTING_CLOSED | Question + final tally | "Voting closed" or their submitted answer |
| RESULTS_REVEALED | Chart/visualization of results | Chart/visualization of results (same view) |
| SESSION_ENDED | Summary of all questions/results | "Thanks for participating" |

**Realtime mechanism:** The admin client **Broadcasts** state transitions on a channel named by session ID. All participant clients subscribe to that channel and render the appropriate view based on the broadcast payload.

**Broadcast payload structure:**
```typescript
type SessionBroadcast = {
  type: 'STATE_CHANGE';
  state: 'lobby' | 'question_active' | 'voting_closed' | 'results_revealed' | 'ended';
  questionId?: string;       // which question is active
  questionData?: Question;   // full question object (so participant doesn't need extra fetch)
  results?: AggregatedResult; // included when results_revealed
};
```

**Why Broadcast (not Postgres Changes) for state:**
- State transitions are ephemeral commands -- "show this now"
- Writing state to DB and relying on Postgres Changes adds unnecessary latency (write to PG -> WAL -> Realtime -> client vs. direct WebSocket broadcast)
- Broadcast is lower latency for this "command" pattern
- BUT: also write current state to DB as source of truth for late joiners (they fetch via REST on connect, then listen to broadcast for updates)

### Component 6: Participant Identity

**Responsibility:** Track participants without accounts.

| Aspect | Detail |
|--------|--------|
| **Mechanism** | Generate a UUID on first visit, store in `localStorage`. This is the `participant_id`. |
| **For named votes** | Prompt for display name, also stored in `localStorage` and sent with vote. |
| **Supabase Auth** | Use Supabase anonymous auth (signInAnonymously). This gives a Supabase user ID that can be used for RLS policies without requiring email/password. |
| **Persistence** | Same device + same browser = same participant. Different device = new participant. This is acceptable for v1. |

**Confidence: MEDIUM** -- Supabase anonymous auth was available as of early 2025. Verify it is still the recommended approach and check for any API changes.

### Component 7: QR Code / Join Flow

**Responsibility:** Get participants from "I'm in the room" to "I see the current question."

| Step | What Happens |
|------|-------------|
| 1 | Admin shares URL or displays QR code (encodes `https://quickvote.app/join/{joinCode}`) |
| 2 | Participant scans QR / clicks link |
| 3 | App loads, checks `localStorage` for existing participant_id, generates one if needed |
| 4 | App fetches current session state via REST: `GET /sessions?join_code=eq.{code}` |
| 5 | App subscribes to Broadcast channel for this session |
| 6 | App renders the view matching current session state (lobby, active question, etc.) |
| 7 | If Presence is enabled, participant announces themselves on the Presence channel |

---

## Data Flow Diagrams

### Flow 1: Admin Creates Session and First Question

```
Admin Client                    Supabase DB
    |                               |
    |-- INSERT session ------------>|
    |<---- session row (with id, ---|
    |      admin_token, join_code)  |
    |                               |
    |-- INSERT question ----------->|
    |      (session_id, text,       |
    |       type, options)          |
    |<---- question row ------------|
    |                               |
    |-- Generate QR code locally ---|
    |   (from join URL)             |
```

### Flow 2: Participant Joins (Late Join)

```
Participant Client              Supabase               Broadcast Channel
    |                               |                        |
    |-- GET session (join_code) --->|                        |
    |<---- session + current -------|                        |
    |      state (REST)             |                        |
    |                               |                        |
    |-- Subscribe to channel -------|----------------------->|
    |   (session:{sessionId})       |                        |
    |                               |                        |
    |-- Join Presence (optional) ---|----------------------->|
    |                               |                        |
    |   [Render current state       |                        |
    |    based on REST response]    |                        |
```

### Flow 3: Admin Pushes New Question (Live Mode)

```
Admin Client                Broadcast Channel         Participant Clients
    |                            |                          |
    |-- UPDATE question -------->|                          |
    |   status='active'          |                          |
    |   (DB write for            |                          |
    |    persistence)            |                          |
    |                            |                          |
    |-- Broadcast: ------------->|-- delivers to all ------>|
    |   { type: STATE_CHANGE,    |   subscribers            |
    |     state: question_active,|                          |
    |     questionId: X,         |                    [Render question UI]
    |     questionData: {...} }  |                          |
```

### Flow 4: Participant Submits Vote and Admin Sees Live Results

```
Participant Client          Supabase DB              Admin Client
    |                            |                        |
    |-- INSERT vote ------------>|                        |
    |   (question_id,            |                        |
    |    participant_id,         |-- Postgres Changes --->|
    |    value)                  |   (INSERT on votes     |
    |                            |    where session_id=X) |
    |<--- 201 Created -----------|                        |
    |                            |                  [Increment local
    |   [Show "vote submitted"   |                   tally, re-render
    |    confirmation]           |                   chart]
```

### Flow 5: Admin Reveals Results

```
Admin Client                Broadcast Channel         Participant Clients
    |                            |                          |
    |-- Broadcast: ------------->|-- delivers to all ------>|
    |   { type: STATE_CHANGE,    |                          |
    |     state: results_revealed|                    [Render results
    |     results: {             |                     chart -- same view
    |       agree: 23,           |                     as admin]
    |       disagree: 14         |                          |
    |     }                      |                          |
    |   }                        |                          |
```

---

## Supabase Channel Strategy

**Recommendation: One channel per session, multiplexing message types.**

```typescript
// Channel name pattern
const channel = supabase.channel(`session:${sessionId}`);

// Broadcast (admin -> participants)
channel.on('broadcast', { event: 'state_change' }, (payload) => {
  // Handle state transitions
});

// Presence (participant count)
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  // Update participant count
});

// Postgres Changes (vote stream for admin)
channel.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
  (payload) => {
    // Update live tally
  }
);

channel.subscribe();
```

**Why one channel, not separate ones:**
- Simpler connection management (one WebSocket subscription per session)
- Supabase channels multiplex naturally over a single WebSocket connection
- Reduces complexity of subscribe/unsubscribe lifecycle
- Each feature (broadcast, presence, postgres_changes) is a separate listener on the same channel

**Confidence: MEDIUM** -- This multiplexing pattern was supported as of Supabase JS v2. Verify that the current `@supabase/supabase-js` version supports combining broadcast + presence + postgres_changes on a single channel. If not, use two channels: one for broadcast+presence, one for postgres_changes.

---

## Database Schema (Recommended)

```sql
-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  join_code TEXT UNIQUE NOT NULL,  -- short, human-friendly (e.g., 6 chars)
  title TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'self_paced')),
  current_question_id UUID,  -- FK added after questions table
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Questions
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agree_disagree', 'multiple_choice')),
  options JSONB,  -- for MC: ["Option A", "Option B", "Option C"]
  position INTEGER NOT NULL,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for current_question_id
ALTER TABLE sessions ADD CONSTRAINT fk_current_question
  FOREIGN KEY (current_question_id) REFERENCES questions(id);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,  -- client-generated, stored in localStorage
  value TEXT NOT NULL,  -- the chosen option
  display_name TEXT,  -- nullable, for named voting
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, participant_id)  -- one vote per participant per question
);

-- Index for realtime subscription filter
CREATE INDEX idx_votes_session_id ON votes(session_id);

-- Index for fetching questions by session
CREATE INDEX idx_questions_session_id ON questions(session_id);
```

### Row Level Security (RLS) Strategy

Since there are no user accounts, RLS must be carefully designed:

```sql
-- Sessions: anyone can read by join_code (participants) or admin_token (admin)
-- Admin writes require admin_token match
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions by join_code"
  ON sessions FOR SELECT
  USING (true);  -- join_code lookup is safe; admin_token exposure is the risk

CREATE POLICY "Admin can update own sessions"
  ON sessions FOR UPDATE
  USING (admin_token = current_setting('request.headers')::json->>'x-admin-token')
  -- Note: This approach requires passing admin_token as a header

-- Votes: anyone can insert (participant), read for aggregation
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert votes"
  ON votes FOR INSERT
  WITH CHECK (true);  -- rate limiting handled at app level

CREATE POLICY "Anyone can read votes for aggregation"
  ON votes FOR SELECT
  USING (true);
```

**Confidence: LOW** -- RLS with anonymous/no-auth users is tricky in Supabase. The above is a starting pattern but may need adjustment. Two common approaches:
1. Use Supabase anonymous auth -- gives each client a JWT, and RLS can use `auth.uid()`.
2. Disable RLS and rely on application-level checks via Edge Functions.

**Recommendation:** Use Supabase anonymous auth. It gives you a real JWT per client, making RLS policies cleaner and more secure. The admin_token can be validated via an Edge Function or a Postgres function called from RLS.

---

## Self-Paced Mode vs Live Mode

The architecture supports both modes through the same components, with behavioral differences:

| Aspect | Live Mode | Self-Paced Mode |
|--------|-----------|-----------------|
| Question progression | Admin Broadcasts state changes | Participant navigates freely |
| Broadcast channel | Active -- admin pushes state | Minimal -- maybe just session open/close |
| Postgres Changes | Admin listens for live vote tally | Optional (admin can view aggregate later) |
| Late join behavior | Participant sees current question | Participant sees first unanswered question |
| Timing | Real-time, synchronized | Async, at participant's pace |
| UI | One question at a time, full-screen | List or paginated question view |

**Key insight:** Self-paced mode is architecturally simpler. It is essentially a form with realtime vote-count updates. Live mode is the complex case requiring Broadcast orchestration. Build self-paced first only if you want an easier foundation, BUT live mode is the core value proposition. Recommendation: build live mode first -- it exercises all the hard parts.

---

## Patterns to Follow

### Pattern 1: Optimistic UI for Vote Submission

**What:** When a participant taps a vote button, immediately show "vote submitted" state locally before the database confirms.

**When:** Every vote submission.

**Why:** Mobile networks can have 100-300ms latency. The participant should feel instant feedback. If the INSERT fails (duplicate vote, network error), revert the UI and show an error.

```typescript
// Pseudocode
const handleVote = async (value: string) => {
  setVoteState('submitted'); // Optimistic
  setSelectedValue(value);

  const { error } = await supabase
    .from('votes')
    .insert({ question_id, participant_id, value, session_id });

  if (error) {
    setVoteState('idle'); // Revert
    setSelectedValue(null);
    showError('Vote failed, please try again');
  }
};
```

### Pattern 2: Broadcast + DB Write (Dual Write for State)

**What:** When admin changes session state (advance question, close voting), both Broadcast the change AND write it to the database.

**When:** Every admin state transition in live mode.

**Why:** Broadcast is ephemeral -- if a participant joins after the broadcast, they miss it. The DB write ensures late joiners can fetch current state via REST. The Broadcast ensures connected participants see it instantly.

```typescript
// Admin advances to next question
const advanceQuestion = async (questionId: string) => {
  // 1. Write to DB (source of truth for late joiners)
  await supabase
    .from('questions')
    .update({ status: 'active' })
    .eq('id', questionId);

  await supabase
    .from('sessions')
    .update({ current_question_id: questionId })
    .eq('id', sessionId);

  // 2. Broadcast (instant delivery to connected participants)
  channel.send({
    type: 'broadcast',
    event: 'state_change',
    payload: {
      state: 'question_active',
      questionId,
      questionData: questions.find(q => q.id === questionId),
    },
  });
};
```

### Pattern 3: Participant Reconciliation on Connect

**What:** When a participant connects (or reconnects after network drop), fetch current state from REST API, THEN subscribe to realtime channel.

**When:** Every participant page load and reconnection.

**Why:** Prevents the "missed broadcast" problem. The REST fetch gives you the current truth, then realtime keeps you updated going forward.

```typescript
const initParticipant = async (joinCode: string) => {
  // 1. Fetch current state (REST)
  const { data: session } = await supabase
    .from('sessions')
    .select('*, questions(*)')
    .eq('join_code', joinCode)
    .single();

  // 2. Set initial UI state from fetched data
  setSessionState(session);

  // 3. Subscribe to realtime updates
  const channel = supabase.channel(`session:${session.id}`);
  channel.on('broadcast', { event: 'state_change' }, handleStateChange);
  channel.subscribe();
};
```

### Pattern 4: Idempotent Vote Insertion

**What:** Use the UNIQUE constraint on (question_id, participant_id) and INSERT with ON CONFLICT to make vote submission idempotent.

**When:** Every vote submission.

**Why:** Network issues may cause retry. Double-tap on mobile is common. The DB constraint prevents double-counting. The client can safely retry without worrying about duplicates.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling Instead of Realtime

**What:** Using `setInterval` to fetch vote counts every N seconds instead of subscribing to Postgres Changes.

**Why bad:** Wastes bandwidth, adds latency, hammers the database with repeated queries. With 50 participants all polling every 2 seconds, that is 25 queries/second for no reason.

**Instead:** Use Supabase Realtime subscriptions (Postgres Changes for votes, Broadcast for state).

### Anti-Pattern 2: Storing Session State Only in Broadcast

**What:** Using Broadcast alone for session state without persisting to the database.

**Why bad:** Late joiners have no way to know the current state. If the admin refreshes their browser, all state is lost. Broadcast is ephemeral.

**Instead:** Dual write -- Broadcast for instant delivery, DB for persistence (Pattern 2 above).

### Anti-Pattern 3: Server-Side Aggregation for Small Scale

**What:** Building a Supabase Edge Function or database function to aggregate vote counts and push results, when you have < 100 voters.

**Why bad:** Over-engineering. Adds latency, complexity, and a deployment dependency. Client-side counting from the Postgres Changes stream is simpler and fast enough for v1.

**Instead:** Aggregate client-side. Add server-side aggregation only when scale demands it (500+ concurrent voters).

### Anti-Pattern 4: Using Postgres Changes for Admin Commands

**What:** Having the admin write a "command" row to a commands table, then listening for INSERT via Postgres Changes to advance questions.

**Why bad:** Adds write latency (Postgres INSERT), unnecessary data persistence, and WAL overhead. Broadcast is purpose-built for this: ephemeral, low-latency, point-to-multipoint.

**Instead:** Use Broadcast for admin commands. Only write to DB for persistence (source of truth), not as a signaling mechanism.

### Anti-Pattern 5: Complex Participant Auth for v1

**What:** Building user accounts, email verification, or OAuth for a casual voting app.

**Why bad:** Kills the "scan QR and vote in 3 seconds" value proposition. Participants will not sign up. The friction destroys the use case.

**Instead:** Anonymous identity via localStorage UUID + optional Supabase anonymous auth for RLS.

---

## Scalability Considerations

| Concern | At 50 users (v1) | At 500 users | At 5,000 users |
|---------|-------------------|--------------|----------------|
| **Realtime connections** | Well within Supabase free tier | Check Supabase plan limits (concurrent connections) | May need Supabase Pro or self-hosted |
| **Vote aggregation** | Client-side counting | Client-side still fine | Server-side aggregation (Edge Function or DB view) to avoid N events hitting admin client |
| **Broadcast latency** | Sub-100ms typical | Sub-200ms | Test; may need message batching |
| **DB writes (votes)** | Trivial | Manageable | Consider write batching or queue |
| **QR code / join** | Instant | Instant | Instant (stateless) |

**v1 architecture handles 50-100 users with zero scaling concerns.** The first real scaling bottleneck will be Supabase Realtime connection limits on the free plan, and that is a plan-upgrade solution, not an architecture change.

---

## Suggested Build Order (Dependencies)

The following build order respects component dependencies -- each layer builds on the one before it.

### Layer 1: Data Foundation (no realtime yet)

1. **Supabase project setup** -- create project, configure
2. **Database schema** -- sessions, questions, votes tables with constraints and indexes
3. **RLS policies** -- at minimum, permissive policies for anonymous access
4. **Session CRUD** -- admin can create session, generate join code
5. **Question CRUD** -- admin can add/edit/reorder questions for a session

**Why first:** Everything else depends on having data in the database. Build this with regular REST (supabase-js `.from().select()`) -- no realtime yet.

### Layer 2: Participant Join Flow

6. **Join page** -- participant enters join code or scans QR, fetches session
7. **Participant identity** -- localStorage UUID generation, optional Supabase anonymous auth
8. **QR code generation** -- admin view shows QR code encoding the join URL

**Why second:** Participants need to be able to reach the session before they can vote or see realtime updates.

### Layer 3: Voting Mechanics (still no realtime)

9. **Vote submission** -- participant sees question (hardcoded/static), submits vote via REST INSERT
10. **Vote constraint enforcement** -- UNIQUE(question_id, participant_id) works, error handling for duplicates
11. **Results query** -- admin can query aggregated results (REST, not realtime yet)

**Why third:** Voting works end-to-end without realtime. This is a testable, demoable checkpoint. Admin creates session + questions, participant joins and votes, admin queries results.

### Layer 4: Realtime Layer

12. **Supabase channel setup** -- subscribe to session channel
13. **Postgres Changes for votes** -- admin sees live vote count update as participants vote
14. **Broadcast for session state** -- admin pushes question transitions, participants see them
15. **Presence for participant count** -- lobby shows how many people are connected

**Why fourth:** Realtime is the "magic" layer but it adds complexity. Having Layer 3 working means you can test in isolation, and realtime is additive -- it makes the existing flows live instead of requiring page refresh.

### Layer 5: Live Session Orchestration

16. **Session state machine** -- admin UI for advancing through questions (next, close voting, reveal results)
17. **Participant state rendering** -- participant UI reacts to broadcast messages (show question, show results, etc.)
18. **Late joiner reconciliation** -- fetch current state on connect, then subscribe

**Why fifth:** This is the "live presentation" experience that ties together all previous layers. It depends on Broadcast (Layer 4), Voting (Layer 3), and Join Flow (Layer 2).

### Layer 6: Polish and Self-Paced Mode

19. **Self-paced mode** -- participant navigates questions freely (simpler variant of live mode)
20. **Full-screen tactile UI** -- large buttons, animations, mobile-optimized
21. **Chart visualizations** -- bar charts, pie charts for results
22. **Session summary** -- admin sees all questions + results after session ends

---

## Client-Side State Management

**Recommendation: React Context + useReducer for session state, no external state library.**

Rationale for v1:
- The state shape is simple: current session, current question, vote status, results
- Two main contexts: `SessionContext` (admin) and `ParticipantContext` (participant)
- Realtime events dispatch actions to the reducer -- clean, testable pattern
- Adding Zustand, Redux, or Jotai is unnecessary overhead for this state complexity

```typescript
// Simplified participant state
type ParticipantState = {
  session: Session | null;
  currentQuestion: Question | null;
  sessionStatus: 'lobby' | 'question_active' | 'voting_closed' | 'results_revealed' | 'ended';
  myVote: string | null;
  results: Record<string, number> | null;
  participantCount: number;
};

type ParticipantAction =
  | { type: 'SESSION_LOADED'; session: Session }
  | { type: 'STATE_CHANGE'; payload: SessionBroadcast }
  | { type: 'VOTE_SUBMITTED'; value: string }
  | { type: 'VOTE_FAILED' }
  | { type: 'PRESENCE_UPDATED'; count: number };
```

---

## Routing Structure

```
/                       -- Landing page (create new session)
/admin/{adminToken}     -- Admin dashboard for session
/join/{joinCode}        -- Participant entry point
/session/{joinCode}     -- Participant in-session view
```

**Why separate `/join` and `/session`:** The join page handles the identity setup (generate participant_id, optional name entry for named votes). Once joined, redirect to the session view. This also lets the QR code point to `/join/{code}` which is a cleaner entry point than dropping directly into a session.

---

## Technology-Specific Notes

### Supabase Realtime Limits (Verify)

- **Free tier:** Likely limited concurrent realtime connections (possibly 200-500). Verify current limits.
- **Channel limits:** Check if there is a per-project channel limit.
- **Postgres Changes filter:** The `filter` parameter on Postgres Changes subscriptions is limited (equality filters only, as of training data). Cannot do complex WHERE clauses.
- **Message size:** Broadcast messages have a size limit (likely 1MB per message). Not a concern for QuickVote payloads.

**Confidence: LOW** -- These limits may have changed. Verify against current Supabase pricing/docs page.

### Vercel Deployment Notes

- The app is a pure SPA (Vite + React). Vercel serves it as static files. No SSR needed.
- All "backend" logic lives in Supabase (database, realtime, edge functions if needed).
- Vercel's edge network provides fast static asset delivery globally -- good for mobile participants.
- No Vercel Functions needed for v1 (Supabase handles everything server-side).

### Vite + React Notes

- Use `@supabase/supabase-js` as the sole backend SDK.
- Supabase client initialization should use environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- These are public (anon key is designed to be public; RLS provides security).

---

## Sources and Confidence

| Claim | Source | Confidence |
|-------|--------|------------|
| Supabase Realtime has Broadcast, Presence, Postgres Changes | Training data (Supabase docs as of early 2025) | MEDIUM |
| Broadcast is lower latency than Postgres Changes for signaling | Training data (Supabase architecture docs) | MEDIUM |
| Channel multiplexing (broadcast + presence + postgres_changes on one channel) | Training data (supabase-js v2 docs) | MEDIUM -- verify with current docs |
| UNIQUE constraint for idempotent votes | Standard PostgreSQL pattern | HIGH |
| Client-side aggregation sufficient for 50-100 users | Engineering judgment | HIGH |
| Supabase anonymous auth availability | Training data | LOW -- verify current availability |
| Supabase free tier connection limits | Training data (may be outdated) | LOW |
| Vercel static SPA deployment | Standard pattern, well-documented | HIGH |

**Note:** WebSearch and WebFetch were unavailable during this research. All findings are based on training data. Before implementation, verify Supabase Realtime API surface and limits against current official documentation at https://supabase.com/docs/guides/realtime.
