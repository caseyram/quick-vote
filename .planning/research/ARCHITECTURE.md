# Architecture: Batch Questions and Collections Integration

**Project:** QuickVote v1.1
**Focus:** How batch questions and collections integrate with existing architecture
**Researched:** 2026-01-28
**Confidence:** HIGH (builds on verified v1.0 architecture)

---

## Executive Summary

Batch questions and collections introduce **two new concepts** to QuickVote:

1. **Collections** - Named, reusable groups of questions (library feature)
2. **Batches** - Runtime activation of multiple questions for self-paced voting

These concepts are orthogonal: collections are a storage/organization feature; batches are a runtime/session-mode feature. The architecture adds one new table (`collections`), two new columns on `questions`, and a new participant state tracking mechanism. The existing realtime channel can be extended with new broadcast events without structural changes.

**Key insight:** Self-paced batch mode is a *different state machine* than live mode, not just a different UI. Participants control their own progression, so the admin no longer broadcasts per-question state changes. Instead, participants track their own progress locally and sync completion status back to the server.

---

## Current Architecture (v1.0 Baseline)

### Existing Schema

```sql
-- Sessions: admin creates, controls flow
sessions (
  id UUID PRIMARY KEY,
  session_id TEXT UNIQUE,      -- human-readable join code
  admin_token UUID UNIQUE,     -- admin access credential
  title TEXT,
  status TEXT,                 -- 'draft' | 'lobby' | 'active' | 'ended'
  reasons_enabled BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ
)

-- Questions: belong to a session
questions (
  id UUID PRIMARY KEY,
  session_id TEXT,             -- FK to sessions.session_id
  text TEXT,
  type TEXT,                   -- 'agree_disagree' | 'multiple_choice'
  options JSONB,               -- for multiple choice
  position INTEGER,            -- ordering
  anonymous BOOLEAN,
  status TEXT,                 -- 'pending' | 'active' | 'closed' | 'revealed'
  created_at TIMESTAMPTZ
)

-- Votes: participant responses
votes (
  id UUID PRIMARY KEY,
  question_id UUID,            -- FK to questions.id
  session_id TEXT,             -- denormalized for efficient filtering
  participant_id UUID,         -- client-generated, stored in localStorage
  value TEXT,
  reason TEXT,
  display_name TEXT,
  locked_in BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(question_id, participant_id)
)
```

### Existing Realtime Architecture

Single multiplexed Supabase channel per session: `session:{sessionId}`

| Feature | Mechanism | Direction | Purpose |
|---------|-----------|-----------|---------|
| Admin commands | Broadcast | Admin -> Participants | `question_activated`, `voting_closed`, `session_ended` |
| Vote streaming | Postgres Changes | Participants -> Admin | Live vote count updates |
| Participant count | Presence | Bidirectional | Show connected user count |

### Existing State Machine (Live Mode)

```
Session: draft -> lobby -> active -> ended

Question (within active session):
  pending -> active -> closed -> revealed
             ^                      |
             +---- admin control ---+
```

Admin controls all transitions via Broadcast. Participants are passive receivers.

---

## New Concepts for v1.1

### Concept 1: Collections (Storage/Library)

**What:** Named groups of questions that exist independently of sessions. Admin can import a collection into a session, or create a collection from session questions.

**Purpose:**
- Reuse question sets across sessions
- Share collections (export/import JSON)
- Build a question library over time

**Relationship to sessions:** Many-to-many. A collection can be imported into multiple sessions. A session can have questions from multiple collections (or no collection).

### Concept 2: Batches (Runtime/Session Mode)

**What:** A set of questions activated together for self-paced participant voting. Participants see all batch questions and navigate freely (previous/next). Admin sees aggregate completion progress.

**Purpose:**
- Allow participants to answer at their own pace
- Admin activates 3-5 questions as a batch, then reviews results after
- Different UX from the "one question at a time, admin controls" live mode

**Relationship to live mode:** Mutually exclusive within an active session. Session is either in "live mode" (admin controls per-question) or "batch mode" (admin activates batch, participants self-pace).

---

## Schema Changes

### New Table: `collections`

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_created_by ON collections(created_by);
```

**RLS Policies:**
```sql
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Creator can manage their collections
CREATE POLICY "Creator can CRUD own collections"
  ON collections FOR ALL TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

-- Anyone can read collections (for import feature)
CREATE POLICY "Anyone can read collections"
  ON collections FOR SELECT TO authenticated
  USING (true);
```

### New Table: `collection_questions`

Junction table for collection -> question templates (not linked to sessions).

```sql
CREATE TABLE collection_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agree_disagree', 'multiple_choice')),
  options JSONB,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collection_questions_collection_id ON collection_questions(collection_id);
```

**RLS Policies:**
```sql
ALTER TABLE collection_questions ENABLE ROW LEVEL SECURITY;

-- Inherit from collection ownership
CREATE POLICY "Collection owner can manage collection_questions"
  ON collection_questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_questions.collection_id
      AND collections.created_by = (select auth.uid())
    )
  );

-- Anyone can read (for import)
CREATE POLICY "Anyone can read collection_questions"
  ON collection_questions FOR SELECT TO authenticated
  USING (true);
```

### Modified Table: `questions` (New Columns)

```sql
-- Add batch tracking to questions
ALTER TABLE questions ADD COLUMN batch_id UUID;
ALTER TABLE questions ADD COLUMN source_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;

CREATE INDEX idx_questions_batch_id ON questions(batch_id);
```

| Column | Type | Purpose |
|--------|------|---------|
| `batch_id` | UUID | Groups questions into a batch. NULL = not part of any batch (live mode question). Same `batch_id` = same batch. |
| `source_collection_id` | UUID | Tracks which collection this question was imported from (for attribution). NULL = created directly. |

**Design decision:** `batch_id` is a simple UUID, not a foreign key to a batches table. Batches are ephemeral groupings created on-the-fly, not first-class entities requiring their own table. This keeps the schema simple. The batch_id is generated client-side when admin selects questions to batch-activate.

### Modified Table: `sessions` (New Column)

```sql
-- Add mode tracking to sessions
ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'batch'));
ALTER TABLE sessions ADD COLUMN active_batch_id UUID;
```

| Column | Type | Purpose |
|--------|------|---------|
| `mode` | TEXT | 'live' (admin controls per-question) or 'batch' (self-paced voting on batch) |
| `active_batch_id` | UUID | When mode='batch', which batch is currently active. NULL when mode='live'. |

### New Table: `batch_progress` (Participant Progress Tracking)

```sql
CREATE TABLE batch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, participant_id, question_id)
);

CREATE INDEX idx_batch_progress_batch_participant ON batch_progress(batch_id, participant_id);
CREATE INDEX idx_batch_progress_session ON batch_progress(session_id);
```

**Purpose:** Track which questions each participant has answered in a batch. This enables:
- Participant UI: show answered/unanswered state, enable review navigation
- Admin UI: show completion percentage per participant, aggregate progress

**RLS Policies:**
```sql
ALTER TABLE batch_progress ENABLE ROW LEVEL SECURITY;

-- Participants track their own progress
CREATE POLICY "Participants can insert own progress"
  ON batch_progress FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = participant_id);

-- Anyone can read progress (admin sees all, participant sees own)
CREATE POLICY "Anyone can read progress"
  ON batch_progress FOR SELECT TO authenticated
  USING (true);
```

**Alternative considered:** Track progress implicitly via votes table (if vote exists for question_id + participant_id, question is answered). This is simpler but doesn't distinguish between "in this batch" and "in a previous session or re-vote scenario." Explicit progress tracking is cleaner and supports the "review answered questions" UX.

---

## State Machine Changes

### Session State Machine (Unchanged)

```
draft -> lobby -> active -> ended
```

No changes. The `mode` column is orthogonal to `status`.

### Question State Machine (Batch Mode)

In batch mode, questions don't go through `pending -> active -> closed` individually. Instead:

```
Batch mode question states:
  pending (not in active batch)
  batch_active (part of currently active batch)
  batch_closed (batch ended, results available)
```

**Implementation:** The existing `status` column semantics change based on session mode:

| Session Mode | Question Status Meaning |
|--------------|-------------------------|
| `live` | `pending` -> `active` -> `closed` -> `revealed` (admin controls each transition) |
| `batch` | All questions in batch have status `active` simultaneously. When admin ends batch, all become `closed`. |

**Design decision:** Reuse the existing `status` column rather than adding a separate `batch_status`. This keeps the schema simpler and the admin UI can handle the different semantics based on `session.mode`.

### Participant State Machine (New for Batch Mode)

Participants in batch mode have local state tracking their position in the batch:

```
Participant batch state:
  current_question_index: number (0 to batch.length - 1)
  answered_questions: Set<questionId>
  review_mode: boolean (true after answering all)
```

This is **client-side state**, not stored in the database. The `batch_progress` table is the source of truth for what's answered, but the current index is ephemeral (resets on page reload, which is fine).

---

## Realtime Changes

### New Broadcast Events

| Event | Payload | Direction | When |
|-------|---------|-----------|------|
| `batch_activated` | `{ batchId, questionIds }` | Admin -> Participants | Admin activates a batch |
| `batch_ended` | `{ batchId }` | Admin -> Participants | Admin closes the batch |
| `participant_progress` | `{ participantId, answeredCount, totalCount }` | Participants -> Admin | Participant completes a question (for progress dashboard) |

### Broadcast: `batch_activated`

```typescript
// Admin side
channel.send({
  type: 'broadcast',
  event: 'batch_activated',
  payload: {
    batchId: generatedUUID,
    questionIds: ['q1', 'q2', 'q3'],
  },
});

// Participant side
channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }) => {
  const { batchId, questionIds } = payload;
  // Fetch all questions in batch
  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds)
    .order('position');

  setBatchQuestions(questions);
  setCurrentQuestionIndex(0);
  setView('batch_voting');
});
```

### Broadcast: `batch_ended`

```typescript
// Admin side (after updating session.active_batch_id = null)
channel.send({
  type: 'broadcast',
  event: 'batch_ended',
  payload: { batchId },
});

// Participant side
channel.on('broadcast', { event: 'batch_ended' }, () => {
  setView('waiting'); // or 'batch_results' if we want to show summary
});
```

### Broadcast: `participant_progress`

This is **participant-to-admin** communication for the progress dashboard. Two options:

**Option A: Postgres Changes on `batch_progress` table**
Admin subscribes to INSERT on `batch_progress` where `session_id=eq.{sessionId}`. Each progress insert triggers a re-aggregation.

**Option B: Explicit Broadcast from participant**
After inserting progress, participant broadcasts their updated count.

**Recommendation: Option A (Postgres Changes)**
Reasons:
- Consistent with how vote streaming works
- No additional broadcast logic needed
- `batch_progress` table already captures the event
- Admin can query aggregate on demand or incrementally update from changes

```typescript
// Admin subscribes to batch_progress
channel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'batch_progress',
    filter: `session_id=eq.${sessionId}`,
  },
  (payload) => {
    const { participant_id, question_id } = payload.new;
    // Update local progress tracking
    updateParticipantProgress(participant_id, question_id);
  }
);
```

### Publication Setup

```sql
-- Add batch_progress to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE batch_progress;
```

### Channel Structure (Unchanged)

The existing single-channel-per-session pattern continues to work. All new events are just additional listeners on the same channel.

---

## Data Flow Diagrams

### Flow 1: Admin Creates Collection

```
Admin Client                    Supabase DB
    |                               |
    |-- INSERT collection --------->|
    |<---- collection row ----------|
    |                               |
    |-- INSERT collection_questions -->|
    |   (batch insert all questions)   |
    |<---- collection_questions rows --|
```

No realtime involved. Standard CRUD.

### Flow 2: Admin Imports Collection into Session

```
Admin Client                    Supabase DB
    |                               |
    |-- SELECT collection_questions ->|
    |<---- question templates --------|
    |                               |
    |-- INSERT questions ----------->|
    |   (copy from templates,        |
    |    set session_id,             |
    |    set source_collection_id)   |
    |<---- new question rows --------|
```

Questions are copied, not linked. Changes to collection don't affect session questions.

### Flow 3: Admin Activates Batch (Self-Paced Mode)

```
Admin Client                    Supabase DB             Broadcast Channel
    |                               |                        |
    |-- Generate batch_id (UUID) ---|                        |
    |                               |                        |
    |-- UPDATE questions ---------->|                        |
    |   SET batch_id, status='active'                        |
    |   WHERE id IN (selected)      |                        |
    |                               |                        |
    |-- UPDATE session ------------>|                        |
    |   SET mode='batch',           |                        |
    |   active_batch_id             |                        |
    |                               |                        |
    |-- Broadcast: batch_activated ->----------------------->|
    |   { batchId, questionIds }    |                   [All participants
    |                               |                    receive, switch
    |                               |                    to batch view]
```

### Flow 4: Participant Answers Question in Batch

```
Participant Client              Supabase DB              Admin Client
    |                               |                        |
    |-- UPSERT vote --------------->|                        |
    |   (same as live mode)         |                        |
    |                               |-- Postgres Changes --->|
    |                               |   (vote stream)        |
    |                               |                        |
    |-- INSERT batch_progress ----->|                        |
    |   (batchId, participantId,    |                        |
    |    questionId)                |-- Postgres Changes --->|
    |                               |   (progress stream)    |
    |                               |                        |
    |-- Local: advance to next -----|                   [Update progress
    |   question or enter review    |                    dashboard]
```

### Flow 5: Admin Views Progress Dashboard

```
Admin Client                    Supabase DB
    |                               |
    |-- SELECT batch_progress ----->|
    |   WHERE batch_id = X          |
    |   GROUP BY participant_id     |
    |<---- aggregate counts --------|
    |                               |
    |   [Also receiving live        |
    |    Postgres Changes for       |
    |    incremental updates]       |
```

### Flow 6: Admin Ends Batch

```
Admin Client                    Supabase DB             Broadcast Channel
    |                               |                        |
    |-- UPDATE questions ---------->|                        |
    |   SET status='closed'         |                        |
    |   WHERE batch_id = X          |                        |
    |                               |                        |
    |-- UPDATE session ------------>|                        |
    |   SET mode='live',            |                        |
    |   active_batch_id=NULL        |                        |
    |                               |                        |
    |-- Broadcast: batch_ended ---->------------------------>|
    |                               |                   [Participants
    |                               |                    exit batch view]
```

---

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `CollectionManager` | CRUD for collections, import/export JSON | Supabase DB only |
| `BatchActivator` | UI for selecting questions, creating batch | session-store, Broadcast |
| `BatchVotingView` | Participant multi-question navigation | session-store, Supabase DB |
| `BatchProgressDashboard` | Admin view of participant completion | Postgres Changes, session-store |

### Modified Components

| Component | Changes |
|-----------|---------|
| `session-store.ts` | Add: `batchQuestions`, `currentBatchIndex`, `batchProgress`, `sessionMode` |
| `AdminSession.tsx` | Add: mode toggle, batch activation UI, progress dashboard |
| `ParticipantSession.tsx` | Add: batch view with navigation (prev/next), review mode |
| `QuestionList.tsx` | Add: batch selection checkboxes, source collection indicator |

### Store Shape Changes

```typescript
// Additions to SessionState
interface SessionState {
  // ... existing fields ...

  // Batch mode state
  sessionMode: 'live' | 'batch';
  activeBatchId: string | null;
  batchQuestions: Question[];
  currentBatchIndex: number;
  answeredQuestionIds: Set<string>;

  // Progress tracking (admin)
  batchProgress: Record<string, number>; // participantId -> answered count
}
```

---

## Integration Points

### 1. Collection Import into Session

**Trigger:** Admin clicks "Import from Collection" in draft session
**Integration:**
- Fetch collection_questions for selected collection
- Copy each template into questions table with session_id and source_collection_id
- Append to existing questions (maintain position ordering)

**Code location:** New `lib/collection-import.ts`

### 2. Batch Activation

**Trigger:** Admin selects questions and clicks "Start Batch"
**Prerequisites:**
- Session must be in `active` status
- Session mode must be `live` (switching to batch)
- Selected questions must have status `pending`

**Integration:**
- Generate batch_id (UUID)
- Update selected questions: `batch_id = X, status = 'active'`
- Update session: `mode = 'batch', active_batch_id = X`
- Broadcast `batch_activated`

**Code location:** Extend `AdminControlBar.tsx` or new `BatchControls.tsx`

### 3. Participant Batch Navigation

**Trigger:** Participant receives `batch_activated` broadcast
**Integration:**
- Fetch all questions where `batch_id = X` ordered by position
- Store in session-store as `batchQuestions`
- Render `BatchVotingView` with prev/next navigation
- On vote submit: also insert into `batch_progress`

**Code location:** New `components/BatchVotingView.tsx`, modify `ParticipantSession.tsx`

### 4. Admin Progress Dashboard

**Trigger:** Admin activates batch
**Integration:**
- Query initial progress: `SELECT participant_id, COUNT(*) FROM batch_progress WHERE batch_id = X GROUP BY participant_id`
- Subscribe to Postgres Changes on `batch_progress` for live updates
- Display grid/table of participant progress

**Code location:** New `components/BatchProgressDashboard.tsx`

### 5. Batch End

**Trigger:** Admin clicks "End Batch"
**Integration:**
- Update questions: `status = 'closed' WHERE batch_id = X`
- Update session: `mode = 'live', active_batch_id = NULL`
- Broadcast `batch_ended`
- Optionally transition to results view (same as live mode)

**Code location:** Extend `AdminControlBar.tsx` or `BatchControls.tsx`

---

## Suggested Build Order

Based on dependencies, build in this order:

### Phase 1: Collections Foundation (No Realtime)

1. **Schema: collections + collection_questions tables**
   - Run migrations, set up RLS
   - Prerequisite for: everything else

2. **CollectionManager component**
   - CRUD UI for collections
   - Add/edit/delete questions within collection
   - Export to JSON / Import from JSON

3. **Import collection into session**
   - "Import" button in session draft view
   - Copies questions from collection_questions to questions

**Deliverable:** Admin can create, manage, and import collections. No batch mode yet.

### Phase 2: Batch Schema + Basic Activation

4. **Schema: batch_id column on questions, mode/active_batch_id on sessions**
   - Migration to add columns
   - Prerequisite for: batch activation

5. **Batch selection UI in admin**
   - Checkboxes on question list
   - "Start Batch" button

6. **Batch activation logic**
   - Generate batch_id
   - Update questions and session
   - Broadcast `batch_activated`

**Deliverable:** Admin can select questions and activate a batch. Participants don't react yet.

### Phase 3: Participant Batch Experience

7. **Schema: batch_progress table**
   - Migration, RLS, add to realtime publication
   - Prerequisite for: progress tracking

8. **BatchVotingView component**
   - Multi-question navigation (prev/next)
   - Progress indicator (3/5 answered)
   - Vote submission + progress tracking

9. **ParticipantSession: handle batch_activated**
   - Switch to batch view when broadcast received
   - Fetch batch questions, render BatchVotingView

**Deliverable:** Participants can complete a batch at their own pace.

### Phase 4: Admin Progress + Batch End

10. **BatchProgressDashboard component**
    - Aggregate view of participant completion
    - Subscribe to batch_progress changes

11. **Batch end flow**
    - "End Batch" button
    - Update questions/session status
    - Broadcast `batch_ended`

12. **Participant: handle batch_ended**
    - Exit batch view, return to waiting/results

**Deliverable:** Full batch workflow from activation to completion.

### Phase 5: Polish + Edge Cases

13. **Late joiner in batch mode**
    - Fetch active_batch_id from session
    - Load batch questions, resume at first unanswered

14. **Review mode for participants**
    - After all answered, allow navigation to review votes
    - Optional: allow vote changes before batch ends

15. **Batch results view for admin**
    - Same as live mode results but for all batch questions

---

## Migration Path from v1.0

### Backward Compatibility

- Existing sessions continue to work in `live` mode (default)
- `batch_id` NULL on existing questions = no batch grouping
- `source_collection_id` NULL = question created directly
- No changes to existing vote/realtime behavior for live mode

### Migration SQL

```sql
-- Migration 001: Add collections table
CREATE TABLE collections (...);
CREATE TABLE collection_questions (...);

-- Migration 002: Add batch columns to questions
ALTER TABLE questions ADD COLUMN batch_id UUID;
ALTER TABLE questions ADD COLUMN source_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
CREATE INDEX idx_questions_batch_id ON questions(batch_id);

-- Migration 003: Add mode to sessions
ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'batch'));
ALTER TABLE sessions ADD COLUMN active_batch_id UUID;

-- Migration 004: Add batch_progress table
CREATE TABLE batch_progress (...);
ALTER PUBLICATION supabase_realtime ADD TABLE batch_progress;
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Channel for Batch Mode

**Bad:** Create a new channel `batch:{batchId}` for batch-specific events.
**Why bad:** Fragments the realtime architecture, complicates subscription management, participants need to subscribe to multiple channels.
**Instead:** Use the existing session channel with new event types.

### Anti-Pattern 2: Store Participant Position in Database

**Bad:** Track `current_question_index` per participant in database.
**Why bad:** Creates unnecessary writes (every navigation = write), doesn't add value (position is ephemeral).
**Instead:** Track position in client-side state. Only persist answers (votes) and completion (batch_progress).

### Anti-Pattern 3: Batches as First-Class Entities

**Bad:** Create a `batches` table with name, status, timing, etc.
**Why bad:** Over-engineering for v1.1 scope. Batches are just a grouping mechanism.
**Instead:** `batch_id` on questions is sufficient. If batch metadata is needed later, add it then.

### Anti-Pattern 4: Poll for Progress Updates

**Bad:** Admin polls `batch_progress` every 2 seconds for progress dashboard.
**Why bad:** Unnecessary load, higher latency than Postgres Changes.
**Instead:** Subscribe to Postgres Changes on `batch_progress` table.

### Anti-Pattern 5: Broadcast Full Question Data in batch_activated

**Bad:** Include all question data in the `batch_activated` payload.
**Why bad:** Payload size limits, data duplication, stale data risk.
**Instead:** Send only `questionIds`, let participant fetch from database.

---

## Open Questions

### 1. Can participants change votes in batch mode?

**Current design:** Yes, same as live mode (UPSERT on votes). No additional complexity.

### 2. What happens if admin ends batch while participant is mid-vote?

**Current design:** `batch_ended` broadcast transitions participant to waiting. Vote in progress may be lost (same as live mode when voting_closed arrives).

**Mitigation:** Optimistic UI shows "submitted" immediately, actual write happens async. Brief race window is acceptable.

### 3. Should batch questions be ordered or randomized?

**Current design:** Ordered by `position` (same as live mode).

**Future consideration:** Add `randomize_order` flag to batch activation. Client shuffles order locally using seeded random (participant_id as seed for consistency on reload).

### 4. How to handle very large batches (20+ questions)?

**Current design:** No special handling. Participant navigates linearly.

**Future consideration:** Progress bar becomes more important. Consider "jump to question" dropdown for long batches.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Schema design | HIGH | Follows existing patterns, minimal new tables |
| Realtime changes | HIGH | Extends existing channel pattern, proven in v1.0 |
| State machine | HIGH | Clear separation between live and batch modes |
| Progress tracking | MEDIUM | Postgres Changes for progress is same pattern as votes, but batch_progress is new |
| Build order | HIGH | Dependencies clearly mapped |
| Participant UX | MEDIUM | Navigation pattern is new, may need iteration |

---

## Sources

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime) - Channel multiplexing, Broadcast, Postgres Changes
- [PostgreSQL Schema Design Best Practices](https://www.tigerdata.com/learn/guide-to-postgresql-database-design) - Schema organization
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices) - RLS patterns, scaling considerations
- QuickVote v1.0 codebase (verified architecture)
- `.planning/phases/04-realtime-and-live-session-orchestration/04-RESEARCH.md` - Existing realtime patterns

---

*Researched: 2026-01-28*
*Valid for: QuickVote v1.1 milestone*
