# Phase 7: Batch Activation - Research

**Researched:** 2026-01-28
**Domain:** Supabase Realtime broadcast patterns, Zustand state management for exclusive modes, React disabled state UX
**Confidence:** HIGH

## Summary

Phase 7 implements batch activation, allowing admins to deliver multiple questions simultaneously to participants for self-paced voting. This research investigated three primary domains: (1) extending the existing Supabase Realtime broadcast pattern to support batch activation, (2) implementing exclusive mode state management in Zustand to prevent live questions and batch mode from running simultaneously, and (3) UI patterns for visual state feedback (active borders, disabled buttons with tooltips).

The standard approach mirrors the existing live question activation pattern established in Phase 4. Batch activation uses a new broadcast event (`batch_activated`) that delivers an array of question IDs. Admin state uses Zustand to track the currently active batch ID, which serves as the mutex for exclusive mode enforcement. Visual feedback follows Tailwind's state utility patterns with border color changes for active state and disabled button styling with tooltip wrappers.

One-time activation is enforced through a batch status field in the database. Once a batch transitions to `closed`, it cannot be reactivated. This prevents confusion and maintains data integrity for completion tracking (Phase 8).

**Primary recommendation:** Add `activeBatchId: string | null` to Zustand store, broadcast `batch_activated` with `{ batchId, questionIds[] }` payload, use border color (green-500/indigo-500) for active state, and add `status` field to batches table for one-time activation enforcement.

## Standard Stack

No new dependencies required. Built entirely with existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.93.1 | Realtime broadcast for batch activation | Already used for live question activation; batch is same pattern with array payload |
| Zustand | ^5.0.5 | State management for active batch tracking and mode exclusion | Already used for session state; selective subscriptions prevent unnecessary re-renders |
| Tailwind CSS | ^4.1.18 | Visual feedback (borders, disabled states, tooltips) | Already used; state utilities handle hover/focus/disabled without custom CSS |
| React | ^19.0.0 | Component state for button interactions | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand activeBatchId | React Context | Context requires Provider wrapper; Zustand store already exists and is more performant |
| Border for active state | Background color change | Border less intrusive; batches remain visually equal when not active per CONTEXT.md |
| Tooltip wrapper | Native title attribute | Title attribute has poor mobile support and styling; wrapper div enables custom tooltip |
| Broadcast event | Postgres Changes on batch | Broadcast is immediate; Postgres Changes has slight delay and requires polling fallback |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
src/
  stores/
    session-store.ts           # MODIFY: Add activeBatchId state
  components/
    BatchCard.tsx              # MODIFY: Add Activate button, active border styling
    AdminControlBar.tsx        # MODIFY: Disable Push Question when batch active
  pages/
    AdminSession.tsx           # MODIFY: Add handleActivateBatch, handleCloseBatch handlers
    ParticipantSession.tsx     # MODIFY: Add batch_activated broadcast listener (Phase 8)
sql/
  add-batch-status.sql         # NEW: Add status field to batches table
```

### Pattern 1: Batch Activation via Broadcast (Mirror Live Question Pattern)

**What:** Admin activates a batch by broadcasting a `batch_activated` event with the batch ID and array of question IDs. Participants receive the event and load all questions for self-paced navigation.

**When to use:** This is the decided architecture from CONTEXT.md. Batch activation mirrors live question activation but with multiple questions.

**Example:**
```typescript
// Source: Existing live question activation pattern (AdminSession.tsx lines 294-332)
// Adapted for batch activation

async function handleActivateBatch(batchId: string) {
  if (!session) return;

  // Close any active live question first
  await supabase
    .from('questions')
    .update({ status: 'closed' as const })
    .eq('session_id', session.session_id)
    .eq('status', 'active');

  for (const q of questions) {
    if (q.status === 'active') {
      updateQuestion(q.id, { status: 'closed' });
    }
  }

  // Mark batch as active
  const { error: batchError } = await supabase
    .from('batches')
    .update({ status: 'active' as const })
    .eq('id', batchId);

  if (!batchError) {
    useSessionStore.getState().setActiveBatchId(batchId);

    // Get question IDs for this batch
    const batchQuestions = questions.filter(q => q.batch_id === batchId);
    const questionIds = batchQuestions.map(q => q.id);

    // Broadcast to participants
    channelRef.current?.send({
      type: 'broadcast',
      event: 'batch_activated',
      payload: { batchId, questionIds },
    });
  }
}

async function handleCloseBatch(batchId: string) {
  // Mark batch as closed (one-time only)
  const { error } = await supabase
    .from('batches')
    .update({ status: 'closed' as const })
    .eq('id', batchId);

  if (!error) {
    useSessionStore.getState().setActiveBatchId(null);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'batch_closed',
      payload: { batchId },
    });
  }
}
```

**Why this pattern:**
- Consistent with existing live question activation (same broadcast mechanism)
- Immediate delivery to all participants (no polling required)
- Single source of truth: Supabase broadcast ensures all clients receive state change
- Preserves existing realtime channel multiplexing (no new channel needed)

### Pattern 2: Exclusive Mode State Management with Zustand

**What:** Zustand store tracks `activeBatchId: string | null`. When non-null, live question push buttons are disabled. When a live question is active, batch activation buttons are disabled.

**When to use:** Any time you have mutually exclusive modes that need to disable UI elements across multiple components.

**Example:**
```typescript
// Source: Zustand patterns for shared client state (Web search: Zustand state management patterns)
// Modified for exclusive mode tracking

// In session-store.ts
interface SessionState {
  // ... existing state
  activeBatchId: string | null;
  setActiveBatchId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  // ... existing state
  activeBatchId: null,
  setActiveBatchId: (id) => set({ activeBatchId: id }),
}));

// In BatchCard.tsx - conditional rendering
function BatchCard({ batch, isActive, onActivate }: Props) {
  const activeQuestionId = useSessionStore(state => state.activeQuestionId);
  const activeBatchId = useSessionStore(state => state.activeBatchId);

  const isAnotherBatchActive = activeBatchId && activeBatchId !== batch.id;
  const isLiveQuestionActive = activeQuestionId !== null;
  const canActivate = !isAnotherBatchActive && !isLiveQuestionActive && batch.status !== 'closed';

  return (
    <div className={`border rounded-lg ${isActive ? 'border-green-500 border-2' : 'border-gray-700'}`}>
      <button
        onClick={() => onActivate(batch.id)}
        disabled={!canActivate}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        title={!canActivate ? "Close active question or batch first" : ""}
      >
        {isActive ? '▶ Close Batch' : '▶ Activate'}
      </button>
    </div>
  );
}

// In AdminControlBar.tsx - disable push buttons
function AdminControlBar({ activeQuestion, onActivateQuestion }: Props) {
  const activeBatchId = useSessionStore(state => state.activeBatchId);
  const batchModeActive = activeBatchId !== null;

  return (
    <button
      onClick={() => onActivateQuestion(question.id)}
      disabled={batchModeActive}
      title={batchModeActive ? "Close active batch before pushing questions" : ""}
    >
      Push Question
    </button>
  );
}
```

**Why this pattern:**
- Zustand selective subscriptions mean only components that read `activeBatchId` re-render
- Single source of truth for mode state prevents race conditions
- Easy to test: just check store state rather than complex component interactions
- Scales to additional modes (e.g., future poll mode) by adding fields to store

### Pattern 3: Visual State Feedback (Active Border + Disabled Tooltips)

**What:** Active batch is indicated by a green/indigo border change. Disabled buttons show tooltips explaining why they're disabled. Inactive batches remain visually equal (not dimmed).

**When to use:** Any time state needs clear visual indication without overwhelming the interface.

**Example:**
```typescript
// Source: Tailwind CSS state utilities (border-color, disabled utilities)
// https://tailwindcss.com/docs/hover-focus-and-other-states
// https://tailwindcss.com/docs/border-color

function BatchCard({ batch, isActive }: Props) {
  return (
    <div className={`
      bg-gray-800
      border
      rounded-lg
      transition-colors
      duration-200
      ${isActive
        ? 'border-green-500 border-2'
        : 'border-indigo-700/50'
      }
    `}>
      {/* Content */}
    </div>
  );
}

// Disabled button with tooltip wrapper
function ActivateButton({ disabled, onClick, isActive }: Props) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        px-3 py-1.5
        bg-indigo-600 hover:bg-indigo-500
        disabled:bg-gray-400
        disabled:cursor-not-allowed
        disabled:opacity-60
        text-white text-sm font-medium
        rounded transition-colors
      "
    >
      {isActive ? '■ Close Batch' : '▶ Activate'}
    </button>
  );

  // Wrap in tooltip if disabled
  if (disabled) {
    return (
      <div className="relative group">
        {button}
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2 py-1 bg-gray-900 text-white text-xs rounded
          opacity-0 group-hover:opacity-100 transition-opacity
          pointer-events-none whitespace-nowrap
        ">
          Close active question or batch first
        </div>
      </div>
    );
  }

  return button;
}
```

**Why this pattern:**
- Border change is immediate visual feedback without obscuring content
- Disabled opacity follows WCAG 2.2 (doesn't need 4.5:1 contrast per guidelines)
- Tooltip wrapper enables hover on disabled buttons (disabled buttons don't fire mouse events)
- CSS transitions make state changes feel smooth rather than jarring
- Green border for active state is universally understood (traffic light metaphor)

### Anti-Patterns to Avoid

- **Using activeQuestionId for batch state:** Live questions and batches are different modes. Don't overload `activeQuestionId` to mean "batch or question active." Use separate `activeBatchId` field.

- **Dimming inactive batches:** Per CONTEXT.md, inactive batches should remain visually equal when one is active. Only the active batch gets border highlight. Dimming creates visual clutter.

- **Allowing re-activation of closed batches:** One-time activation prevents confusion about which votes belong to which activation period. Once closed, batches cannot be reopened.

- **Native title attribute for tooltips:** Mobile doesn't show title attributes reliably. Use CSS-based tooltip wrappers for consistency across devices.

- **Broadcasting question content:** Don't send full question objects in broadcast payload. Send IDs only; participants fetch full data from database. This prevents payload size issues and ensures consistency.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip positioning | Calculate absolute positioning manually | CSS `group` + `group-hover` pattern | Tailwind's group utilities handle hover state propagation from parent to child without JS |
| Disabled button hover | Complex event handling workarounds | Wrapper div approach | Disabled elements don't fire pointer events; wrapper allows tooltip to still show |
| Exclusive mode mutex | Multiple boolean flags (isBatchActive, isQuestionActive) | Single source of truth (activeBatchId) | Boolean flags create race conditions; single field is easier to reason about |
| Border transition | JavaScript animation | CSS `transition-colors` | CSS transitions are 60fps by default; no JS overhead |

**Key insight:** State management for exclusive modes should use a single field (activeBatchId) rather than multiple booleans. When `activeBatchId` is non-null, derive `isBatchActive` from it. When `activeQuestionId` is non-null, derive `isLiveQuestionActive`. This prevents impossible states (batch and question both active).

## Common Pitfalls

### Pitfall 1: Forgetting to Close Active Live Questions Before Batch Activation

**What goes wrong:** Admin activates a batch while a live question is still active. Participants are now in an undefined state (are they voting on the live question or the batch?).

**Why it happens:** No explicit check before batch activation. Developer assumes UI disable is sufficient, but direct Supabase calls or test code can bypass UI.

**How to avoid:** Always close active questions in the activation handler:

```typescript
async function handleActivateBatch(batchId: string) {
  // ALWAYS close active questions first
  await supabase
    .from('questions')
    .update({ status: 'closed' })
    .eq('session_id', session.session_id)
    .eq('status', 'active');

  // Then activate batch
}
```

**Warning signs:** Tests fail with "multiple active questions" errors. Participants see voting UI for both live question and batch.

### Pitfall 2: Using activeQuestionId for Batch Mode Detection

**What goes wrong:** Code checks `if (activeQuestionId)` to determine if push buttons should be disabled. This doesn't account for batch mode. Developer adds `|| activeBatchId` checks everywhere, leading to scattered logic.

**Why it happens:** Overloading existing state rather than creating explicit batch state. Seems like less code initially but creates maintenance burden.

**How to avoid:** Create separate derived booleans:

```typescript
const isLiveMode = activeQuestionId !== null;
const isBatchMode = activeBatchId !== null;
const canPushQuestion = !isLiveMode && !isBatchMode;
const canActivateBatch = !isLiveMode && !isBatchMode;
```

**Warning signs:** Many `if (activeQuestionId || activeBatchId)` checks scattered across components. Logic is duplicated rather than centralized.

### Pitfall 3: Allowing Batch Re-activation After Close

**What goes wrong:** Admin closes a batch, then realizes they wanted to leave it open longer and tries to reactivate it. The batch shows questions participants already completed. Votes from first activation are mixed with votes from second activation. Results are confusing.

**Why it happens:** Database doesn't enforce one-time activation. Developer thinks "just set status back to pending" is harmless.

**How to avoid:** Add `status` field to batches table with CHECK constraint:

```sql
ALTER TABLE batches
  ADD COLUMN status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'closed'));

-- In activation handler
UPDATE batches
SET status = 'active'
WHERE id = ? AND status = 'pending';  -- Only allows pending->active

-- In close handler
UPDATE batches
SET status = 'closed'
WHERE id = ? AND status = 'active';   -- Only allows active->closed
```

And in UI, disable activate button for closed batches:

```typescript
const canActivate = batch.status === 'pending' && !isAnotherBatchActive;
```

**Warning signs:** Test data shows duplicate votes for same participant in same batch. Admin reports "batch questions reappearing."

### Pitfall 4: Broadcast Payload Size Assumption

**What goes wrong:** Developer sends full question objects in `batch_activated` payload. For a batch with 5 questions with long text and options arrays, payload exceeds Supabase Broadcast message size limit (1MB, but soft limit at ~100KB for performance).

**Why it happens:** Convenience. Seems easier to send everything rather than have participants fetch from database.

**How to avoid:** Send IDs only in broadcast:

```typescript
// GOOD
channelRef.current?.send({
  event: 'batch_activated',
  payload: { batchId, questionIds: ['uuid1', 'uuid2', 'uuid3'] }
});

// BAD - Don't do this
channelRef.current?.send({
  event: 'batch_activated',
  payload: { batchId, questions: [fullQuestionObject1, fullQuestionObject2] }
});
```

Participants fetch full data on receiving the broadcast:

```typescript
channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }) => {
  const { questionIds } = payload;

  // Fetch full question data
  const { data } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  setActiveBatchQuestions(data);
});
```

**Warning signs:** Broadcast messages fail silently for batches with many questions. Works in development with 2 questions, breaks in production with 10 questions.

## Code Examples

Verified patterns from existing codebase and official sources:

### Batch Activation Handler (AdminSession.tsx)

```typescript
// Source: Existing live question activation pattern (AdminSession.tsx:294-332)
// Adapted for batch activation

async function handleActivateBatch(batchId: string) {
  if (!session) return;

  // 1. Close any active live questions
  await supabase
    .from('questions')
    .update({ status: 'closed' as const })
    .eq('session_id', session.session_id)
    .eq('status', 'active');

  for (const q of questions) {
    if (q.status === 'active') {
      updateQuestion(q.id, { status: 'closed' });
    }
  }

  // 2. Update batch status to active
  const { error: batchError } = await supabase
    .from('batches')
    .update({ status: 'active' as const })
    .eq('id', batchId);

  if (batchError) {
    console.error('Failed to activate batch:', batchError);
    return;
  }

  // 3. Update store
  useSessionStore.getState().setActiveBatchId(batchId);

  // 4. Get question IDs for broadcast
  const batchQuestions = questions.filter(q => q.batch_id === batchId);
  const questionIds = batchQuestions.map(q => q.id);

  // 5. Broadcast to participants
  channelRef.current?.send({
    type: 'broadcast',
    event: 'batch_activated',
    payload: { batchId, questionIds },
  });
}
```

### Batch Close Handler (AdminSession.tsx)

```typescript
// Source: Existing voting close pattern (AdminSession.tsx:334-358)
// Adapted for batch close

async function handleCloseBatch(batchId: string) {
  // 1. Update batch status to closed (one-time only)
  const { error } = await supabase
    .from('batches')
    .update({ status: 'closed' as const })
    .eq('id', batchId);

  if (!error) {
    // 2. Clear active batch from store
    useSessionStore.getState().setActiveBatchId(null);

    // 3. Broadcast to participants
    channelRef.current?.send({
      type: 'broadcast',
      event: 'batch_closed',
      payload: { batchId },
    });
  }
}
```

### Zustand Store Extension (session-store.ts)

```typescript
// Source: Existing session store pattern (session-store.ts)
// Add batch state tracking

interface SessionState {
  // ... existing state
  activeQuestionId: string | null;
  activeBatchId: string | null;     // NEW

  setActiveQuestionId: (id: string | null) => void;
  setActiveBatchId: (id: string | null) => void;  // NEW
}

export const useSessionStore = create<SessionState>()((set) => ({
  // ... existing state
  activeQuestionId: null,
  activeBatchId: null,

  setActiveQuestionId: (id) => set({ activeQuestionId: id }),
  setActiveBatchId: (id) => set({ activeBatchId: id }),
}));
```

### Active Border Styling (BatchCard.tsx)

```typescript
// Source: Tailwind CSS border utilities
// https://tailwindcss.com/docs/border-color

function BatchCard({ batch, isActive, questions }: Props) {
  return (
    <div className={`
      bg-gray-800
      rounded-lg
      overflow-hidden
      transition-all duration-200
      ${isActive
        ? 'border-2 border-green-500 shadow-lg shadow-green-500/20'
        : 'border border-indigo-700/50'
      }
    `}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-750 transition-colors text-left"
      >
        {/* Chevron */}
        <svg width="16" height="16" /* ... */ />

        {/* Name */}
        <span className="text-white font-medium">{batch.name}</span>

        {/* Question count badge */}
        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </span>

        {/* Activate/Close button */}
        <ActivateButton
          batch={batch}
          isActive={isActive}
          disabled={!canActivate}
          onClick={(e) => {
            e.stopPropagation();
            isActive ? onClose(batch.id) : onActivate(batch.id);
          }}
        />
      </button>

      {/* Expanded body */}
      {/* ... */}
    </div>
  );
}
```

### Disabled Button with Tooltip (BatchCard.tsx)

```typescript
// Source: Tailwind CSS disabled utilities + custom tooltip pattern
// https://www.dhiwise.com/post/the-ultimate-guide-to-react-button-disabled-best-practices

function ActivateButton({ batch, isActive, disabled, onClick }: Props) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        px-3 py-1.5
        text-white text-xs font-medium
        rounded transition-colors
        ${isActive
          ? 'bg-red-600 hover:bg-red-500'
          : 'bg-indigo-600 hover:bg-indigo-500'
        }
        disabled:bg-gray-500
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    >
      {isActive ? '■ Close' : '▶ Activate'}
    </button>
  );

  // Wrap in tooltip if disabled (disabled buttons don't fire hover events)
  if (disabled) {
    return (
      <div className="relative group inline-block">
        {button}
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2 py-1
          bg-gray-900 text-white text-xs rounded
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
          whitespace-nowrap
          z-50
        ">
          {getDisabledReason(batch)}
        </div>
      </div>
    );
  }

  return button;
}

function getDisabledReason(batch: Batch): string {
  if (batch.status === 'closed') return 'Batch already closed (one-time only)';
  if (batch.status === 'active') return 'Close this batch first';
  // Called from parent that checks other conditions
  return 'Close active question or batch first';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global "mode" enum | Parallel state fields (activeQuestionId, activeBatchId) | 2026 | Derived booleans clearer than enum; easier to add new modes |
| title attribute tooltips | CSS group hover wrappers | 2025+ | Better mobile support; consistent styling across browsers |
| JavaScript border animations | CSS transition-colors | 2024+ | Native 60fps performance; no JS overhead |
| Redux for mode state | Zustand selective subscriptions | 2023+ | Less boilerplate; better performance for frequent updates |

**Deprecated/outdated:**
- **title attribute for complex tooltips:** Mobile support is poor. Use CSS-based tooltips with hover wrappers.
- **Boolean "isBatchMode" + "isLiveMode" flags:** Derive from source of truth (activeBatchId, activeQuestionId) rather than maintaining parallel flags.
- **Custom animation libraries for simple transitions:** CSS transitions are sufficient for border/opacity changes. Save animation libraries for complex orchestrations.

## Open Questions

Things that couldn't be fully resolved:

1. **Should closed batches show completion percentage in admin view?**
   - What we know: CONTEXT.md defers participant completion tracking to Phase 8
   - What's unclear: Whether admin should see "3/5 participants completed" summary for closed batches
   - Recommendation: Phase 8 concern. Phase 7 only needs "closed" vs "active" distinction for UI disable logic.

2. **What happens if admin closes batch while participant is mid-vote?**
   - What we know: Votes are preserved per CONTEXT.md decision
   - What's unclear: Should participant see "voting closed" notification or just silently continue?
   - Recommendation: Phase 8 concern (participant UX). Phase 7 only needs to broadcast batch_closed event.

3. **Should batches have a timer option like live questions?**
   - What we know: CONTEXT.md doesn't mention timers for batches
   - What's unclear: Whether "self-paced" means no time limits whatsoever
   - Recommendation: Defer to future phase. Phase 7 implements no-timer activation. Timer can be added later without breaking changes.

## Sources

### Primary (HIGH confidence)
- Existing codebase (AdminSession.tsx live question activation pattern) - verified implementation
- Existing codebase (session-store.ts Zustand patterns) - verified state management
- Supabase SQL schema (add-batches.sql) - verified batch table structure
- Phase 4 Research (04-RESEARCH.md) - verified Realtime broadcast patterns
- Phase 6 Research (06-RESEARCH.md) - verified batch schema decisions

### Secondary (MEDIUM confidence)
- [Zustand documentation](https://zustand.docs.pmnd.rs/) - official library docs
- [Tailwind CSS state utilities](https://tailwindcss.com/docs/hover-focus-and-other-states) - official CSS framework docs
- [Tailwind CSS border-color](https://tailwindcss.com/docs/border-color) - official CSS framework docs
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) - official Supabase docs

### Tertiary (LOW confidence - web search, verified with code)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - trends article
- [Zustand for React: Simple State Management](https://medium.com/@ishimdarahamad_84327/zustand-for-react-simple-state-management-seriously-cdb2d002154c) - community article
- [The Ultimate Guide to React Button Disabled: Best Practices](https://www.dhiwise.com/post/the-ultimate-guide-to-react-button-disabled-best-practices) - UX patterns
- [Implementing Tooltips in React JS with Tailwind CSS](https://medium.com/@reactmasters.in/implementing-tooltips-in-react-js-with-tailwind-css-58f1bf0954a4) - implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing dependencies, no new installs required
- Architecture: HIGH - Mirrors verified live question activation pattern from Phase 4
- Pitfalls: HIGH - Based on code review and established broadcast patterns
- UI patterns: HIGH - Tailwind utilities are stable and well-documented

**Research date:** 2026-01-28
**Valid until:** 30 days (stable technologies; no fast-moving frameworks)
