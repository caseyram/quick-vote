# Phase 3: Join Flow and Voting Mechanics - Research

**Researched:** 2026-01-27
**Domain:** QR code join flow, vote submission/upsert, double-tap lock-in gesture, haptic feedback, admin question activation, participant session state management
**Confidence:** HIGH

## Summary

Phase 3 builds the complete vote lifecycle: participants join via QR code, see a lobby, vote on active questions (agree/disagree or multiple choice), lock in with a double-tap, and see confirmation. The admin activates questions one at a time, views vote progress, and closes voting to reveal results. The phase works end-to-end without realtime -- all state changes happen via direct Supabase queries and page refreshes or polling.

The technical domains are well-understood. QR code generation uses `qrcode.react` (v4.2.0, React 19 compatible). Vote submission uses Supabase upsert with the existing `UNIQUE(question_id, participant_id)` constraint. The double-tap lock-in pattern uses a custom hook with `useRef` timestamps -- no library needed. Haptic feedback uses the browser Vibration API (`navigator.vibrate()`), which works on Android Chrome/Firefox but not iOS Safari. The admin state machine (draft -> lobby -> active -> ended) is enforced via Supabase update queries with RLS restricting updates to the session creator.

**Primary recommendation:** Use `qrcode.react` for QR generation, Supabase `.upsert()` with `onConflict: 'question_id,participant_id'` for idempotent votes, a custom `useDoubleTap` hook for lock-in, `navigator.vibrate()` with visual fallback for confirmation, and extend the existing Zustand store with voting slice state for the participant view. Client-side vote aggregation via `Array.reduce()` is sufficient for v1 (50-100 users).

## Standard Stack

### Core (New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qrcode.react | ^4.2.0 | QR code rendering (SVG) | Most popular React QR library (1,151 dependents). v4.2.0 adds React 19 peer dependency. Exports `QRCodeSVG` (recommended) and `QRCodeCanvas`. Zero external deps. |

### Existing (Already Installed)
| Library | Version | Purpose | Phase 3 Usage |
|---------|---------|---------|---------------|
| @supabase/supabase-js | ^2.93.1 | DB queries, auth | Vote upsert, session/question status updates, vote fetching |
| zustand | ^5.0.5 | State management | Extend store with vote state for participant view |
| react-router | ^7.6.1 | Client routing | Existing `/session/:sessionId` route for participant |
| nanoid | ^5.1.5 | URL IDs | Already used for session_id in QR URLs |

### No New Dependencies Needed For
| Feature | Approach | Why No Library |
|---------|----------|----------------|
| Double-tap detection | Custom `useDoubleTap` hook (useRef + timestamp) | 15 lines of code. `use-double-tap` npm package adds unnecessary dependency for trivial logic. |
| Haptic feedback | `navigator.vibrate()` browser API | Native browser API, no wrapper needed. Feature-detect and degrade gracefully. |
| Vote aggregation | `Array.reduce()` client-side | Decision from STATE.md: client-side aggregation for v1 (50-100 users). Fetching all votes and reducing is adequate at this scale. |
| Updated_at trigger | Supabase `moddatetime` extension | PostgreSQL extension, no JS dependency. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| qrcode.react | react-qr-code | react-qr-code has fewer dependents (329 vs 1,151) and less active maintenance. qrcode.react has explicit React 19 support. |
| qrcode.react | lean-qr | Smaller bundle (~4kB) but less ecosystem adoption. qrcode.react is well-proven. |
| Custom useDoubleTap | use-double-tap npm | Extra dependency for 15 lines of hook code. Not worth it. |
| Client-side aggregation | SQL view / RPC | Over-engineering for v1 scale. Deferred per STATE.md decisions. |

**Installation:**
```bash
npm install qrcode.react
```

## Architecture Patterns

### Recommended Project Structure (Phase 3 Additions)
```
src/
├── components/
│   ├── QRCode.tsx              # QR code wrapper (admin screen corner)
│   ├── VoteAgreeDisagree.tsx   # Two-button agree/disagree voting UI
│   ├── VoteMultipleChoice.tsx  # Multiple choice option cards
│   ├── VoteConfirmation.tsx    # Visual confirmation overlay/highlight
│   ├── Lobby.tsx               # "Waiting for host" screen
│   ├── SessionResults.tsx      # End-of-session results summary
│   └── AdminQuestionControl.tsx # Start/close question, view vote count
├── hooks/
│   ├── use-auth.ts             # (existing)
│   ├── use-double-tap.ts       # Double-tap detection hook
│   └── use-haptic.ts           # Vibration API wrapper with feature detection
├── stores/
│   └── session-store.ts        # Extended with vote state (participant)
├── lib/
│   ├── supabase.ts             # (existing)
│   └── vote-aggregation.ts     # Client-side vote counting helpers
├── pages/
│   ├── AdminSession.tsx        # Extended: question activation, vote progress, QR code
│   └── ParticipantSession.tsx  # Extended: lobby, voting, results states
└── types/
    └── database.ts             # Extended: ActiveQuestion type, VoteCount type
```

### Pattern 1: Participant Session State Machine
**What:** The participant view is a state machine driven by session and question status. Each state renders a different component.
**When to use:** ParticipantSession page -- the single entry point for all participant states.

```typescript
// ParticipantSession.tsx -- state-driven rendering
type ParticipantView = 'loading' | 'lobby' | 'voting' | 'waiting' | 'results' | 'error';

function ParticipantSession() {
  const { sessionId } = useParams();
  const [view, setView] = useState<ParticipantView>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Determine view from session + question status
  useEffect(() => {
    if (!session) { setView('loading'); return; }
    if (session.status === 'ended') { setView('results'); return; }
    if (session.status === 'draft' || session.status === 'lobby') { setView('lobby'); return; }
    if (session.status === 'active') {
      if (activeQuestion) { setView('voting'); }
      else { setView('waiting'); }
    }
  }, [session, activeQuestion]);

  switch (view) {
    case 'loading': return <LoadingScreen />;
    case 'lobby': return <Lobby session={session!} />;
    case 'voting': return <VotingScreen question={activeQuestion!} />;
    case 'waiting': return <WaitingForQuestion />;
    case 'results': return <SessionResults sessionId={sessionId!} />;
    case 'error': return <ErrorScreen />;
  }
}
```

### Pattern 2: Idempotent Vote Upsert
**What:** Use Supabase `.upsert()` with `onConflict: 'question_id,participant_id'` so the same participant can change their vote by simply re-upserting.
**When to use:** Every vote submission (first vote and vote changes).

```typescript
// Vote submission -- idempotent upsert
async function submitVote(
  questionId: string,
  sessionId: string,
  participantId: string,
  value: string,
  lockedIn: boolean = false
) {
  const { data, error } = await supabase
    .from('votes')
    .upsert(
      {
        question_id: questionId,
        session_id: sessionId,
        participant_id: participantId,
        value,
        locked_in: lockedIn,
      },
      { onConflict: 'question_id,participant_id' }
    )
    .select()
    .single();

  return { data, error };
}
```

**Critical notes:**
- The `onConflict` value is a comma-separated string, NOT an array.
- The existing `UNIQUE(question_id, participant_id)` constraint in the votes table automatically creates a unique index, which PostgREST uses to resolve the conflict.
- Both INSERT and UPDATE RLS policies must pass for upsert to work. The existing schema already has both policies on the votes table.
- The existing SELECT policy on votes also passes (required for upsert + `.select()` chaining).

### Pattern 3: Double-Tap Lock-In Hook
**What:** A custom hook that distinguishes between a first tap (select) and a second tap on the same option (lock in). Uses `useRef` to track last tap time and target, avoiding re-renders.
**When to use:** All voting interactions (agree/disagree buttons, multiple choice cards).

```typescript
// hooks/use-double-tap.ts
import { useRef, useCallback } from 'react';

const DOUBLE_TAP_THRESHOLD = 400; // ms

export function useDoubleTap(
  onSingleTap: (value: string) => void,
  onDoubleTap: (value: string) => void
) {
  const lastTapRef = useRef<{ value: string; time: number } | null>(null);

  const handleTap = useCallback((value: string) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && last.value === value && now - last.time < DOUBLE_TAP_THRESHOLD) {
      // Double tap on same option -- lock in
      lastTapRef.current = null;
      onDoubleTap(value);
    } else {
      // First tap -- select
      lastTapRef.current = { value, time: now };
      onSingleTap(value);
    }
  }, [onSingleTap, onDoubleTap]);

  return handleTap;
}
```

**Key design decisions:**
- Threshold of 400ms (not 300ms) to be forgiving on mobile -- users may be less precise with touch targets.
- Tracks BOTH the value AND the timestamp -- double-tap only triggers if the same option is tapped twice. Tapping Option A then Option B is a selection change, not a lock-in.
- Uses `useRef` to avoid re-renders on every tap.

### Pattern 4: Haptic Feedback with Graceful Degradation
**What:** Trigger phone vibration on vote confirmation, with feature detection for devices that lack vibration support.
**When to use:** After first tap (short pulse) and after lock-in (distinct pattern).

```typescript
// hooks/use-haptic.ts
export function useHaptic() {
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return {
    // Short tap feedback -- selection
    tap: () => {
      if (canVibrate) navigator.vibrate(30);
    },
    // Confirmation feedback -- lock-in
    confirm: () => {
      if (canVibrate) navigator.vibrate([40, 30, 40]);
    },
  };
}
```

**Browser support reality:**
- Works on Android Chrome and Firefox.
- Does NOT work on iOS Safari (Apple has never implemented the Vibration API for web).
- Always pair with visual feedback -- haptic is supplementary, not primary.
- `navigator.vibrate()` requires "sticky user activation" -- must be in response to a user action (click/touch), which is always the case for voting.

### Pattern 5: QR Code in Admin Corner
**What:** A persistent, toggleable QR code in the bottom-right corner of the admin screen that encodes the participant URL.
**When to use:** Admin session page during lobby and active states.

```typescript
// components/QRCode.tsx
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  visible: boolean;
}

export function SessionQRCode({ url, visible }: QRCodeProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white p-3 rounded-xl shadow-lg z-50">
      <QRCodeSVG
        value={url}
        size={120}
        level="M"
        marginSize={1}
      />
      <p className="text-xs text-gray-600 text-center mt-1 font-medium">
        Scan to join
      </p>
    </div>
  );
}
```

**QR code sizing notes:**
- `size={120}` is a reasonable starting point for a corner element -- scannable from ~1 meter but not obtrusive.
- Error correction level "M" (15% recovery) is sufficient since the URL is short.
- White background with padding ensures scannability against the dark admin UI.

### Pattern 6: Admin Question Activation Flow
**What:** Admin clicks "Start" on a question to activate it. This updates the question status to `active` and the session status to `active` (if not already). Only one question can be active at a time.
**When to use:** Admin session page during the voting flow.

```typescript
// Activate a question (admin only)
async function activateQuestion(questionId: string, sessionId: string) {
  // Close any currently active question first
  await supabase
    .from('questions')
    .update({ status: 'closed' })
    .eq('session_id', sessionId)
    .eq('status', 'active');

  // Activate the target question
  const { error: qError } = await supabase
    .from('questions')
    .update({ status: 'active' })
    .eq('id', questionId);

  // Ensure session is active
  const { error: sError } = await supabase
    .from('sessions')
    .update({ status: 'active' })
    .eq('session_id', sessionId);

  return { error: qError || sError || null };
}
```

### Pattern 7: Client-Side Vote Aggregation
**What:** Fetch all votes for a question and aggregate client-side using `Array.reduce()`.
**When to use:** Admin view when closing a question (reveal results), and session end summary.

```typescript
// lib/vote-aggregation.ts
import type { Vote } from '../types/database';

export interface VoteCount {
  value: string;
  count: number;
  percentage: number;
}

export function aggregateVotes(votes: Vote[]): VoteCount[] {
  const total = votes.length;
  const counts = votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.value] = (acc[vote.value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([value, count]) => ({
    value,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}
```

### Pattern 8: Touch-Action CSS for Double-Tap
**What:** Apply `touch-action: manipulation` to voting buttons to prevent the browser's default double-tap-to-zoom behavior from interfering with the double-tap lock-in gesture.
**When to use:** All voting UI elements (agree/disagree buttons, multiple choice cards).

```css
/* Apply to all voting interactive elements */
.vote-button {
  touch-action: manipulation;
}
```

This is essential. Without it, double-tapping a vote button on mobile will trigger the browser's zoom gesture instead of the lock-in action. The `manipulation` value preserves panning and pinch-zoom while disabling double-tap-to-zoom. Works on both Android and iOS Safari.

### Anti-Patterns to Avoid
- **Using `select('*')` on sessions in participant queries:** Always use explicit column lists to exclude `admin_token`. The existing pattern in `ParticipantSession.tsx` already does this correctly.
- **Allowing vote changes after lock-in:** Once `locked_in: true` is set, the UI must prevent further changes. Enforce this client-side by disabling vote buttons, and consider a CHECK constraint or RLS policy for defense-in-depth.
- **Not preventing double-tap zoom on voting elements:** Without `touch-action: manipulation`, the browser's double-tap-to-zoom will fight with the lock-in gesture on mobile.
- **Polling too aggressively in participant view:** Without realtime (Phase 4), participants need to fetch state. Use conservative polling intervals (3-5 seconds) or manual refresh. Do not poll every 500ms.
- **Forgetting to close the previous active question before activating the next:** The activation function must close any currently active question first to maintain the "one active at a time" invariant.
- **Using `.upsert()` without both INSERT and UPDATE RLS policies:** Upsert always starts with INSERT. If the INSERT policy fails, the entire operation fails -- even if the row already exists and would be an update. The existing schema already has both policies.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Canvas-based QR encoder | `qrcode.react` QRCodeSVG | QR encoding has complex error correction math. The library handles all QR spec versions, error correction levels, and produces clean SVG output. |
| Vote deduplication | Manual "check if exists then insert or update" | Supabase `.upsert()` with `onConflict` | The check-then-act pattern has race conditions. Upsert is atomic at the database level. |
| Updated_at timestamp | Manual `updated_at: new Date().toISOString()` in every update call | PostgreSQL `moddatetime` trigger | Client clocks drift. The trigger runs server-side with the database clock, ensuring consistency. Also fires automatically on upsert conflict updates. |
| Double-tap detection | Complex gesture library | Custom `useRef` + timestamp hook | This is a simple time-delta check on the same element. A gesture library (e.g., react-use-gesture) would be massive overkill. |
| Vote count display | Manual DOM counting | `Array.reduce()` aggregation helper | Centralize the counting logic in a utility function to avoid duplicating reduce logic across components. |

**Key insight:** This phase is primarily UI and state management. The database schema and RLS from Phase 2 already handle the hard parts (idempotent votes, authorization). The complexity here is in the user experience -- touch interactions, state transitions, and visual feedback -- not in novel technology.

## Common Pitfalls

### Pitfall 1: Double-Tap Zoom Interfering with Lock-In
**What goes wrong:** On mobile, double-tapping a vote button triggers the browser's zoom gesture instead of the lock-in action. The user sees the page zoom in unexpectedly.
**Why it happens:** Mobile browsers default to double-tap-to-zoom unless explicitly told otherwise.
**How to avoid:** Apply `touch-action: manipulation` CSS to all voting buttons and interactive vote elements. This preserves pinch-zoom and panning while disabling double-tap zoom.
**Warning signs:** Testing on mobile shows the page zooming when trying to lock in a vote.

### Pitfall 2: Upsert Failing Silently Due to Missing RLS Policy
**What goes wrong:** Vote upsert returns `{ data: null, error: null }` -- no error but also no data.
**Why it happens:** Supabase upsert requires INSERT, UPDATE, AND SELECT RLS policies to all pass. If any are missing, the operation may fail silently (especially when using `.select()` after upsert).
**How to avoid:** Verify all three RLS policies exist on the votes table before starting development. The existing schema has all three. Test with an actual anonymous auth user, not the Supabase dashboard (which bypasses RLS).
**Warning signs:** Vote submissions appear to succeed but no rows appear in the database.

### Pitfall 3: onConflict String Format
**What goes wrong:** Upsert throws "no unique or exclusion constraint matching the ON CONFLICT specification" error.
**Why it happens:** The `onConflict` parameter must be a comma-separated STRING (`'question_id,participant_id'`), not an array. Also, the column names must exactly match the unique constraint columns.
**How to avoid:** Always use string format: `{ onConflict: 'question_id,participant_id' }`. The existing `UNIQUE(question_id, participant_id)` inline constraint automatically creates a unique index, which PostgREST resolves correctly.
**Warning signs:** Error code `42P10` in Supabase logs.

### Pitfall 4: Allowing Vote Changes After Lock-In
**What goes wrong:** A participant locks in their vote, but the UI still allows them to change it. Or worse, a stale UI state causes an upsert that overwrites the locked vote.
**Why it happens:** Lock-in state is only tracked client-side and the page refresh loses it, or the participant's own vote is not re-fetched after lock-in.
**How to avoid:** After lock-in, fetch the vote back from the database to confirm `locked_in: true`. Disable all vote buttons when `locked_in` is true. Consider adding a database-level check: the UPDATE policy on votes could include `AND NOT locked_in` (defense-in-depth).
**Warning signs:** Participants report being able to change votes after locking in.

### Pitfall 5: Multiple Active Questions
**What goes wrong:** Admin activates a new question without closing the previous one. Two questions are now `active`, causing confusion for participants.
**Why it happens:** The activation function does not close the previous active question first.
**How to avoid:** Always close all active questions for the session before activating a new one. Use a transaction if available, or a two-step sequential update (close all active, then activate new).
**Warning signs:** Participants see two different questions, or the participant view shows the wrong question.

### Pitfall 6: Haptic Feedback Expectation on iOS
**What goes wrong:** The haptic feedback (phone vibration) works during Android testing but does nothing on iOS. Stakeholder testing on iPhones shows no tactile response.
**Why it happens:** Apple has never implemented the Vibration API for Safari/WebKit. `navigator.vibrate` is `undefined` on iOS.
**How to avoid:** Always pair haptic with visual feedback (highlight color change, checkmark animation, button scale). Haptic is supplementary. Feature-detect before calling: `if ('vibrate' in navigator) navigator.vibrate(30)`.
**Warning signs:** "It doesn't vibrate on my iPhone" feedback during testing.

### Pitfall 7: Participant Sees Stale Session State (No Realtime Yet)
**What goes wrong:** Admin activates a question, but the participant's page still shows the lobby because there is no realtime subscription yet (Phase 4).
**Why it happens:** Phase 3 works without realtime. The participant page only fetches state on mount.
**How to avoid:** Implement polling as a temporary bridge. Poll session status every 3-5 seconds. Add a visible "Refresh" button. Phase 4 will replace polling with Supabase Realtime subscriptions.
**Warning signs:** Participants stuck on lobby screen after admin activates a question.

### Pitfall 8: updated_at Not Auto-Updating on Vote Changes
**What goes wrong:** Vote upsert updates the `value` column but `updated_at` stays at the original insertion time.
**Why it happens:** The `updated_at DEFAULT now()` only fires on INSERT, not on UPDATE (upsert conflict resolution).
**How to avoid:** Create a `moddatetime` trigger on the votes table that sets `updated_at = now()` on every UPDATE. The trigger fires automatically even for upsert conflict updates.
**Warning signs:** All votes show the same `updated_at` regardless of when they were changed.

## Code Examples

### QR Code SVG Rendering
```typescript
// Source: https://github.com/zpao/qrcode.react
import { QRCodeSVG } from 'qrcode.react';

// In admin session page
const participantUrl = `${window.location.origin}/session/${session.session_id}`;

<QRCodeSVG
  value={participantUrl}
  size={120}
  level="M"            // 15% error correction
  bgColor="#FFFFFF"
  fgColor="#000000"
  marginSize={1}
  title="Scan to join session"
/>
```

### Vote Upsert with Lock-In
```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
const { data, error } = await supabase
  .from('votes')
  .upsert(
    {
      question_id: questionId,
      session_id: sessionId,
      participant_id: participantId,  // auth.uid()
      value: selectedOption,           // 'agree', 'disagree', or option text
      locked_in: isLockIn,
    },
    { onConflict: 'question_id,participant_id' }
  )
  .select()
  .single();
```

### Fetching Current Participant's Vote
```typescript
// Check if participant already voted on active question
const { data: existingVote } = await supabase
  .from('votes')
  .select('value, locked_in')
  .eq('question_id', questionId)
  .eq('participant_id', participantId)
  .maybeSingle();  // Returns null if no vote, not an error
```

### Fetching Vote Counts (Admin View)
```typescript
// Simple count of votes for active question
const { data: votes, error } = await supabase
  .from('votes')
  .select('value, locked_in')
  .eq('question_id', questionId);

const totalVotes = votes?.length ?? 0;
const lockedVotes = votes?.filter(v => v.locked_in).length ?? 0;
// Display: "12/50 voted (8 locked in)"
```

### Session Status Transitions (Admin)
```typescript
// Move session to lobby (from draft)
await supabase
  .from('sessions')
  .update({ status: 'lobby' })
  .eq('session_id', sessionId);

// End session
await supabase
  .from('sessions')
  .update({ status: 'ended' })
  .eq('session_id', sessionId);

// Close all active questions when ending session
await supabase
  .from('questions')
  .update({ status: 'closed' })
  .eq('session_id', sessionId)
  .eq('status', 'active');
```

### Vibration API Feature Detection
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
function triggerHaptic(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
  // Silently no-op on unsupported devices (iOS, desktop)
}

// Usage in vote handler
triggerHaptic(30);           // Short tap feedback
triggerHaptic([40, 30, 40]); // Lock-in confirmation pattern
```

### Touch-Action CSS for Voting Elements
```css
/* Prevent double-tap zoom on all voting buttons */
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action */
.vote-button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent; /* Remove iOS tap highlight */
}
```

### Moddatetime Trigger for updated_at
```sql
-- Enable the extension (run once in SQL editor)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Auto-update updated_at on vote changes
CREATE TRIGGER handle_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);
```

### Polling Bridge (Until Phase 4 Realtime)
```typescript
// Temporary polling for participant view
useEffect(() => {
  if (!sessionId) return;

  const interval = setInterval(async () => {
    // Fetch current session status
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('status')
      .eq('session_id', sessionId)
      .single();

    // Fetch active question
    const { data: activeQ } = await supabase
      .from('questions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    // Update local state
    if (sessionData) setSessionStatus(sessionData.status);
    if (activeQ !== undefined) setActiveQuestion(activeQ);
  }, 4000); // Poll every 4 seconds

  return () => clearInterval(interval);
}, [sessionId]);
```

## Database Changes Required

### New: moddatetime Trigger
The votes table already exists with the correct schema. The only database change needed is adding the auto-update trigger:

```sql
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);
```

### Optional: Prevent Vote Changes After Lock-In (Defense-in-Depth)
Consider adding a check in the UPDATE RLS policy on votes to prevent updating locked-in votes:

```sql
-- Replace existing update policy
DROP POLICY "Users can update own votes" ON votes;
CREATE POLICY "Users can update own unlocked votes"
  ON votes FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = participant_id
    AND locked_in = false
  );
```

This is defense-in-depth -- the UI should also prevent this, but database enforcement is stronger.

### Existing Schema Verification
The following already exists and requires no changes:
- `votes` table with `UNIQUE(question_id, participant_id)` -- supports upsert
- INSERT policy on votes: `WITH CHECK ((select auth.uid()) = participant_id)` -- participants insert their own votes
- UPDATE policy on votes: `USING ((select auth.uid()) = participant_id)` -- participants update their own votes
- SELECT policy on votes: `USING (true)` -- anyone can read votes (for aggregation)
- `sessions.status` CHECK constraint: `IN ('draft', 'lobby', 'active', 'ended')` -- state machine values
- `questions.status` CHECK constraint: `IN ('pending', 'active', 'closed', 'revealed')` -- question lifecycle

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `qrcode.react` v3 with default export | v4 named exports `QRCodeSVG` / `QRCodeCanvas` | v4.0.0 (2024) | Must use `import { QRCodeSVG } from 'qrcode.react'`, not default import |
| `qrcode.react` v4.0-4.1 | v4.2.0 adds React 19 peer dependency | Late 2024 | Safe to use with React 19 without `--legacy-peer-deps` |
| `navigator.vibrate()` on iOS | Still unsupported on iOS Safari | N/A (never supported) | Always provide visual fallback. Vibration is Android-only in practice for web. |
| Supabase GROUP BY via RPC only | PostgREST v12 supports aggregate functions | Late 2024 | Must be enabled manually. Not needed for v1 -- client-side aggregation suffices. |

**Deprecated/outdated:**
- `qrcode.react` default export: Removed in v4. Use named exports.
- `includeMargin` prop on qrcode.react: Deprecated in favor of `marginSize`.
- `xlink:href` in QR SVG output: Replaced with `href` in v4 for modern SVG compatibility.

## Zustand Store Extension Strategy

The existing `session-store.ts` manages session and questions. For Phase 3, extend it with voting state:

**Recommended: Add a vote slice to the existing store.** Session, questions, and votes are tightly coupled (vote depends on active question which depends on session status). Separate stores would require cross-store coordination.

New state additions:
```typescript
interface VotingState {
  // Current participant's vote on the active question
  currentVote: Vote | null;
  // All votes for active question (admin view / aggregation)
  questionVotes: Vote[];
  // Voting state flags
  submitting: boolean;

  setCurrentVote: (vote: Vote | null) => void;
  setQuestionVotes: (votes: Vote[]) => void;
  setSubmitting: (submitting: boolean) => void;
}
```

This extends the existing store interface. The store creation uses the spread pattern:
```typescript
export const useSessionStore = create<SessionState & VotingState>()((set) => ({
  // ...existing session state
  // ...new voting state
  currentVote: null,
  questionVotes: [],
  submitting: false,
  setCurrentVote: (vote) => set({ currentVote: vote }),
  setQuestionVotes: (votes) => set({ questionVotes: votes }),
  setSubmitting: (submitting) => set({ submitting }),
}));
```

## Open Questions

1. **Polling interval for participant view**
   - What we know: Phase 3 works without realtime. Participants need to detect when admin activates/closes questions.
   - What's unclear: Optimal polling interval -- too fast wastes bandwidth, too slow feels unresponsive.
   - Recommendation: Start with 4-second polling. This is a temporary bridge; Phase 4 replaces it with Supabase Realtime. A "Refresh" button provides manual override.

2. **Lock-in RLS enforcement**
   - What we know: The UPDATE policy on votes currently allows updating any own vote regardless of lock-in status. Defense-in-depth would restrict this.
   - What's unclear: Whether adding `AND locked_in = false` to the UPDATE policy breaks the upsert flow (since upsert starts with INSERT).
   - Recommendation: Test in development. If the RLS change breaks upsert for locked-in users, keep enforcement client-side only for v1.

3. **Session results data fetching strategy**
   - What we know: Session end shows a scrollable summary of all questions with results.
   - What's unclear: Whether to fetch all votes for all questions in one query (possibly large) or paginate by question.
   - Recommendation: For v1 (50-100 users, ~10 questions), fetching all votes in one query is fine. Optimize later if needed.

4. **Participant count in lobby**
   - What we know: The lobby should display participant count ("Waiting for host to start... 12 participants joined").
   - What's unclear: Without realtime or a participants table, how to count participants. Options: (a) query distinct `auth.uid()` from votes (but no votes yet in lobby), (b) use Supabase Presence (Phase 4), (c) skip count for Phase 3.
   - Recommendation: For Phase 3, show a static lobby screen without participant count. Phase 4 adds Supabase Presence which provides this naturally.

## Sources

### Primary (HIGH confidence)
- [qrcode.react GitHub](https://github.com/zpao/qrcode.react) - v4.2.0 API, React 19 peer dependency, named exports
- [qrcode.react CHANGELOG](https://github.com/zpao/qrcode.react/blob/trunk/CHANGELOG.md) - v4.x breaking changes, React 19 support added in v4.2.0
- [Supabase JS Upsert Docs](https://supabase.com/docs/reference/javascript/upsert) - onConflict syntax, options, examples
- [MDN Navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) - API spec, browser compatibility, security requirements
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) - Pattern syntax, cancellation
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) - `manipulation` value, browser support
- [PostgreSQL UNIQUE Indexes Docs](https://www.postgresql.org/docs/current/indexes-unique.html) - Automatic index creation from UNIQUE constraints
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy patterns for INSERT + UPDATE (required for upsert)

### Secondary (MEDIUM confidence)
- [Supabase moddatetime extension discussion](https://github.com/orgs/supabase/discussions/6741) - Trigger pattern for auto-updating timestamps
- [Supabase upsert RLS discussion](https://github.com/orgs/supabase/discussions/30499) - Requires both INSERT and UPDATE policies
- [Supabase composite constraint discussion](https://github.com/orgs/supabase/discussions/28927) - PostgREST uses column names not constraint names; inline UNIQUE auto-creates index
- [Zustand store patterns discussion](https://github.com/pmndrs/zustand/discussions/2486) - Single store vs multiple stores guidance

### Tertiary (LOW confidence)
- Polling interval (4 seconds) is an educated guess based on typical UX patterns -- not verified against Supabase rate limits.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - qrcode.react v4.2.0 verified with React 19 support via GitHub releases and CHANGELOG. Supabase upsert verified against official docs.
- Architecture: HIGH - Patterns follow established Supabase + React conventions. State machine pattern is well-understood. Double-tap hook is simple and well-tested in the community.
- Don't hand-roll: HIGH - Each recommendation backed by clear rationale (QR spec complexity, race conditions in check-then-act, client clock drift).
- Pitfalls: HIGH - Every pitfall verified against official documentation or community reports with concrete solutions.
- Haptic/touch: MEDIUM - Vibration API browser support verified via MDN. iOS non-support is well-documented. Touch-action verified via MDN. The specific vibration patterns (30ms, 40-30-40ms) are subjective and need user testing.
- Polling bridge: LOW - Polling interval is an interim solution replaced by Phase 4 realtime. Exact timing needs empirical validation.

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days -- stable technologies, qrcode.react and Supabase JS unlikely to change)
