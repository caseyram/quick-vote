# Phase 26: Sequence & Results Enhancements - Research

**Researched:** 2026-02-14
**Domain:** Multi-select drag-and-drop, realtime vote count display, session configuration UX
**Confidence:** HIGH

## Summary

Phase 26 implements multi-select rearrangement in the sequence sidebar, live completion count for active batches, and session configuration simplification. The project already has @dnd-kit v6.3.1 for drag-and-drop, Supabase realtime for vote updates, and a proven session config pattern. The primary technical challenges are: (1) implementing shift-click and ctrl-click multi-select without native @dnd-kit support, (2) extending SequenceItemCard to show live progress bars instead of static status badges, and (3) restructuring AdminSession.tsx to move all content editing to the template editor while keeping only runtime settings in session config.

Multi-select drag with @dnd-kit requires custom state management (Set for selected IDs) plus keyboard event handlers. The library handles single-item drag natively but doesn't provide built-in multi-select — developers manually track selection and implement group drag logic. Live vote counts are already available via the existing `sessionVotes` state (updated via realtime postgres_changes) — the implementation adds a progress bar component that replaces the "Results ready" badge on batch cards. Session config simplification removes duplicate editing UI that already exists in TemplateEditorPage, keeping only session name, teams, reasons toggle, and test mode.

**Primary recommendation:** Add React state for selected items (Set), implement keyboard handlers for shift/ctrl-click selection, extend SequenceItemCard with conditional progress bar rendering based on `sessionVotes` prop, and refactor AdminSession.tsx draft view to remove slide/question/template editing UI while preserving the SequenceManager integration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Multi-select rearrangement (SEQE-02):**
- Selection method: Shift-click for range, Ctrl-click to add/remove individual items
- Visual indicator: Background tint on selected items
- Group drag behavior: Claude's discretion (stacked preview, ghost stack, or best fit with existing drag library)
- Deselection: Both Escape key and clicking empty space clear the selection

**Live completion count (RESL-01):**
- Format: Progress bar with numeric count (e.g., "12/30")
- Placement: Replaces the existing status badge / "Results ready" text on the sequence item card
- Update mechanism: Realtime via existing Supabase realtime subscription (not polling)
- Completion state: Progress bar turns green when 100% of participants have voted

**Session configuration simplification:**
- Remove all slide/question editing from session config — content editing lives exclusively in the template editor
- Remove response template, question template, and session template selectors from session config
- Keep only: session name, teams configuration, reasons enabled toggle, test data toggle
- Reasons enabled defaults to ON (both in template editor and session config)

### Claude's Discretion

- Group drag visual implementation (stacked preview vs ghost stack)
- Progress bar styling to fit existing sequence card layout
- Session config page layout after simplification
- How to handle existing sessions that were created with the old config flow

### Deferred Ideas (OUT OF SCOPE)

- Session editing vs template editing architectural refactoring — extract shared editing components, eliminate duplication between session config and template editor. Separate phase.

</user_constraints>

## Standard Stack

The project has all necessary dependencies installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | Already integrated in SequenceManager.tsx |
| @dnd-kit/sortable | 10.0.0 | Sortable list preset | Provides useSortable hook and reordering |
| @dnd-kit/utilities | 3.2.2 | CSS transform utilities | Standard companion for DnD animations |
| Supabase JS | 2.93.1 | Realtime database client | Vote updates via postgres_changes |
| Zustand | 5.0.5 | State management | Project's chosen solution for session state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.1.18 | Styling framework | Progress bars, selection tints, layout |
| React | 19.0.0 | UI framework | Hooks for selection state, keyboard events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom multi-select | react-multi-select-component | @dnd-kit already integrated, custom implementation gives full control |
| Realtime subscription | Polling every N seconds | Supabase realtime is already set up, more responsive than polling |
| Progress bar component | Third-party library | Simple enough to build in-house with Tailwind |

**Installation:**
No new dependencies required — all libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── SequenceManager.tsx        # EXTEND: Add multi-select state and handlers
│   ├── SequenceItemCard.tsx       # EXTEND: Add progress bar for batches
│   └── VoteProgressBar.tsx        # NEW: Reusable progress bar component
├── hooks/
│   └── use-multi-select.ts        # NEW: Shift/ctrl-click selection logic
├── pages/
│   └── AdminSession.tsx           # MODIFY: Simplify draft config section
└── stores/
    └── session-store.ts           # EXISTS: Already has sessionVotes state
```

### Pattern 1: Multi-Select State Management with Shift/Ctrl-Click
**What:** Track selected items in a Set, handle keyboard modifiers for range and toggle selection.
**When to use:** User needs to select multiple items before performing batch operations (like drag).
**Example:**
```typescript
// Source: Recommended pattern based on research (stereobooster.com, TanStack table discussions)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

function handleItemClick(itemId: string, event: React.MouseEvent) {
  if (event.shiftKey && lastSelectedId) {
    // Range selection: select all items between last and current
    const itemIds = sessionItems.map(item => item.id);
    const lastIdx = itemIds.indexOf(lastSelectedId);
    const currentIdx = itemIds.indexOf(itemId);
    const [start, end] = lastIdx < currentIdx
      ? [lastIdx, currentIdx]
      : [currentIdx, lastIdx];

    const rangeIds = itemIds.slice(start, end + 1);
    setSelectedIds(prev => new Set([...prev, ...rangeIds]));
  } else if (event.ctrlKey || event.metaKey) {
    // Toggle selection: add or remove individual item
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    setLastSelectedId(itemId);
  } else {
    // Regular click: select only this item
    setSelectedIds(new Set([itemId]));
    setLastSelectedId(itemId);
  }
}

// Escape key to deselect all
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setSelectedIds(new Set());
      setLastSelectedId(null);
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// Click empty space to deselect
function handleContainerClick(e: React.MouseEvent) {
  if (e.target === e.currentTarget) {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }
}
```
**Key requirements:**
- Use Set for O(1) lookups (avoid Array.includes for performance)
- Track lastSelectedId separately to enable shift-range selection
- Support both Ctrl (Windows/Linux) and Meta (macOS) for cross-platform compatibility
- Clear selection on Escape or click outside items

### Pattern 2: Group Drag with @dnd-kit (Manual Implementation)
**What:** When dragging a selected item, move all selected items as a group.
**When to use:** Multi-select is active and user drags one of the selected items.
**Example:**
```typescript
// Source: dnd-kit discussions (#120, #1313) — no built-in multi-select
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const draggedId = active.id as string;
  const targetId = over.id as string;

  // Determine which items to move
  const itemsToMove = selectedIds.has(draggedId)
    ? Array.from(selectedIds)  // Move all selected items
    : [draggedId];              // Move only dragged item

  const oldIndex = sessionItems.findIndex(item => item.id === draggedId);
  const newIndex = sessionItems.findIndex(item => item.id === targetId);

  if (oldIndex === -1 || newIndex === -1) return;

  // Compute new order: remove selected items, insert at target position
  const remainingItems = sessionItems.filter(
    item => !itemsToMove.includes(item.id)
  );

  // Insert all moved items at new position
  const finalOrder = [
    ...remainingItems.slice(0, newIndex),
    ...sessionItems.filter(item => itemsToMove.includes(item.id)),
    ...remainingItems.slice(newIndex),
  ];

  // Update positions and persist
  const updates = finalOrder.map((item, idx) => ({ id: item.id, position: idx }));
  useSessionStore.getState().updateSessionItemPositions(updates);

  try {
    await reorderSessionItems(updates);
  } catch (err) {
    console.error('Reorder failed:', err);
    // Revert on error
  }

  // Clear selection after successful drag
  setSelectedIds(new Set());
  setLastSelectedId(null);
}
```
**Key requirements:**
- Check if dragged item is in selectedIds to determine group vs single drag
- Maintain relative order of selected items when moving as group
- Clear selection after successful drop to avoid confusion
- Preserve existing error handling and optimistic updates

### Pattern 3: Live Progress Bar for Active Batches
**What:** Replace static "Results ready" badge with dynamic progress bar showing vote completion.
**When to use:** Batch is active and voting is in progress.
**Example:**
```typescript
// Source: Existing ProgressDashboard.tsx pattern (lines 34-37, 85-90)
interface VoteProgressBarProps {
  currentVotes: number;
  totalParticipants: number;
  isComplete?: boolean;
}

function VoteProgressBar({ currentVotes, totalParticipants, isComplete = false }: VoteProgressBarProps) {
  const percent = totalParticipants > 0
    ? Math.min(100, (currentVotes / totalParticipants) * 100)
    : 0;

  const barColor = isComplete ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 whitespace-nowrap">
        {currentVotes}/{totalParticipants}
      </span>
    </div>
  );
}

// Usage in SequenceItemCard (replace status badge)
{isBatch && isActive && (
  <VoteProgressBar
    currentVotes={batchQuestionIds.reduce((sum, qId) =>
      sum + (sessionVotes[qId]?.length || 0), 0)}
    totalParticipants={participantCount}
    isComplete={/* all questions at 100% */}
  />
)}
```
**Key requirements:**
- Calculate total votes by summing votes across all batch questions
- Use existing `sessionVotes` state (updated via realtime)
- Green color when 100% complete, blue while in progress
- Smooth transition animation on vote count changes

### Pattern 4: Realtime Vote Updates via Supabase Postgres Changes
**What:** Subscribe to vote INSERT/UPDATE events to update vote counts in real-time.
**When to use:** Live session with active voting.
**Example:**
```typescript
// Source: Existing AdminSession.tsx pattern (lines 223-253)
// Already implemented — votes are tracked via postgres_changes subscription
channel.on(
  'postgres_changes' as any,
  {
    event: '*',
    schema: 'public',
    table: 'votes',
    filter: `session_id=eq.${sessionId}`,
  },
  (payload: any) => {
    const newVote = payload.new as Vote;
    if (!newVote) return;

    setSessionVotes((prev) => {
      const qId = newVote.question_id;
      const existing = prev[qId] ?? [];

      if (payload.eventType === 'INSERT') {
        const alreadyExists = existing.some((v) => v.id === newVote.id);
        if (alreadyExists) return prev;
        return { ...prev, [qId]: [...existing, newVote] };
      } else if (payload.eventType === 'UPDATE') {
        return {
          ...prev,
          [qId]: existing.map((v) => (v.id === newVote.id ? newVote : v)),
        };
      }
      return prev;
    });
  }
);

// Pass sessionVotes to SequenceItemCard
<SequenceItemCard
  sessionVotes={sessionVotes}
  participantCount={participantCount}
/>
```
**Key requirements:**
- Subscription already set up in AdminSession.tsx — reuse existing pattern
- Pass sessionVotes and participantCount as props to SequenceItemCard
- No polling needed — realtime updates are immediate

### Anti-Patterns to Avoid

- **Don't use array.includes for selected check** — O(n) lookup, use Set instead (O(1))
- **Don't modify position directly in state** — always recompute full order array and update positions sequentially
- **Don't poll for votes** — Supabase realtime postgres_changes already provides live updates
- **Don't duplicate template editing in session config** — all content editing belongs in TemplateEditorPage

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shift-click range selection | Custom index math for all edge cases | Proven pattern from TanStack table, stereobooster.com | Handles bidirectional ranges, deselection, keyboard modifiers correctly |
| Drag ghost overlay | Custom multi-item drag preview | DndContext DragOverlay with conditional rendering | @dnd-kit provides accessibility and animation out of the box |
| Vote count aggregation | Custom WebSocket polling | Existing Supabase realtime subscription | Already handles reconnection, deduplication, and state sync |

**Key insight:** Multi-select with @dnd-kit is not a built-in feature — the library provides single-item drag primitives, so selection state and group drag logic must be implemented manually. However, the core drag-and-drop mechanics (sensors, collision detection, overlay) are handled by @dnd-kit, so only selection state management needs custom code.

## Common Pitfalls

### Pitfall 1: Text Selection During Shift-Click
**What goes wrong:** Default browser text selection interferes with shift-click range selection.
**Why it happens:** Shift + click normally extends text selection in the browser.
**How to avoid:** Conditionally disable text selection only when shift key is held.
**Warning signs:** Selected text highlights appear when shift-clicking items.

```typescript
// Prevent text selection during shift-click
<div
  onMouseDown={(e) => {
    if (e.shiftKey) {
      e.preventDefault(); // Prevent text selection
    }
  }}
>
  {/* List items */}
</div>
```

### Pitfall 2: Stale Selection After Drag
**What goes wrong:** Selected items remain highlighted after group drag completes.
**Why it happens:** Selection state is not cleared after successful drop.
**How to avoid:** Clear selectedIds and lastSelectedId in handleDragEnd after position update.
**Warning signs:** Items stay selected with background tint after drag operation.

### Pitfall 3: Race Condition Between Optimistic Update and Realtime Subscription
**What goes wrong:** Vote count flickers or shows incorrect value briefly after realtime update.
**Why it happens:** Optimistic local update conflicts with incoming postgres_changes event.
**How to avoid:** Rely on realtime subscription as single source of truth — don't optimistically update vote counts.
**Warning signs:** Progress bar jumps backward or shows duplicate count increments.

### Pitfall 4: Incorrect Progress Calculation for Batches
**What goes wrong:** Progress bar shows 100% when only some batch questions have full votes.
**Why it happens:** Calculation uses total votes across all questions instead of checking per-question completion.
**How to avoid:** Check if ALL batch questions have votes >= participantCount before marking complete.
**Warning signs:** Green progress bar appears when some questions still have 0 votes.

```typescript
// Correct completion check
const batchQuestionIds = questions
  .filter(q => q.batch_id === batchId)
  .map(q => q.id);

const allQuestionsComplete = batchQuestionIds.every(qId =>
  (sessionVotes[qId]?.length || 0) >= participantCount
);

const isComplete = allQuestionsComplete && participantCount > 0;
```

### Pitfall 5: Duplicate Editing UI Between Session Config and Template Editor
**What goes wrong:** User sees slide upload, question creation, and template selectors in both session config and template editor.
**Why it happens:** Session config was built before template editor existed.
**How to avoid:** Remove all content editing from AdminSession.tsx draft view, keep only runtime settings.
**Warning signs:** Users ask "where should I edit content?" or create slides in wrong location.

## Code Examples

Verified patterns from official sources and existing codebase:

### Multi-Select with Shift/Ctrl-Click
```typescript
// Source: Recommended pattern from stereobooster.com and TanStack table discussions
// Combined with existing SequenceManager.tsx patterns

function SequenceManager({ /* existing props */ }) {
  const { sessionItems } = useSessionStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  function handleItemClick(itemId: string, event: React.MouseEvent) {
    // Shift-click: range selection
    if (event.shiftKey && lastSelectedId) {
      const itemIds = sessionItems.map(item => item.id);
      const lastIdx = itemIds.indexOf(lastSelectedId);
      const currentIdx = itemIds.indexOf(itemId);
      const [start, end] = lastIdx < currentIdx
        ? [lastIdx, currentIdx]
        : [currentIdx, lastIdx];

      const rangeIds = itemIds.slice(start, end + 1);
      setSelectedIds(prev => new Set([...prev, ...rangeIds]));
    }
    // Ctrl/Cmd-click: toggle selection
    else if (event.ctrlKey || event.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      setLastSelectedId(itemId);
    }
    // Regular click: single selection
    else {
      setSelectedIds(new Set([itemId]));
      setLastSelectedId(itemId);
    }
  }

  // Escape key clears selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setLastSelectedId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click empty space clears selection
  function handleContainerClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      setSelectedIds(new Set());
      setLastSelectedId(null);
    }
  }

  return (
    <div onClick={handleContainerClick}>
      {sessionItems.map(item => (
        <SequenceItemCard
          key={item.id}
          item={item}
          isSelected={selectedIds.has(item.id)}
          onClick={(e) => handleItemClick(item.id, e)}
        />
      ))}
    </div>
  );
}
```

### Live Vote Progress Bar
```typescript
// Source: Existing ProgressDashboard.tsx pattern adapted for individual batch cards

interface VoteProgressBarProps {
  batchId: string;
  batchQuestionIds: string[];
  sessionVotes: Record<string, Vote[]>;
  participantCount: number;
}

function VoteProgressBar({
  batchQuestionIds,
  sessionVotes,
  participantCount
}: VoteProgressBarProps) {
  // Calculate total votes across all batch questions
  const totalVotes = batchQuestionIds.reduce(
    (sum, qId) => sum + (sessionVotes[qId]?.length || 0),
    0
  );

  // Check if all questions have full participation
  const allComplete = batchQuestionIds.every(
    qId => (sessionVotes[qId]?.length || 0) >= participantCount
  );

  const percent = participantCount > 0
    ? Math.min(100, (totalVotes / (batchQuestionIds.length * participantCount)) * 100)
    : 0;

  const barColor = allComplete ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 font-medium">
        {totalVotes}/{batchQuestionIds.length * participantCount}
      </span>
    </div>
  );
}
```

### Session Config Simplification
```typescript
// Source: User requirements from CONTEXT.md
// REMOVE these sections from AdminSession.tsx draft view:

// ❌ REMOVE: Image uploader for slides
<ImageUploader sessionId={session.session_id} onUploaded={handleSlideUploaded} />

// ❌ REMOVE: Response template panel
<ResponseTemplatePanel />

// ❌ REMOVE: Question template panel
<TemplatePanel sessionId={session.session_id} />

// ❌ REMOVE: Session template panel
<SessionTemplatePanel sessionId={session.session_id} />

// ❌ REMOVE: Session import/export
<SessionImportExport sessionId={session.session_id} />

// ❌ REMOVE: Default template selector
<TemplateSelector
  value={session.default_template_id ?? null}
  onChange={handleDefaultTemplateChange}
  templates={templates}
/>

// ✅ KEEP: Session name, teams, reasons toggle, test mode
<div className="bg-white rounded-lg p-4 space-y-3">
  <input
    value={sessionName}
    onChange={(e) => setSessionName(e.target.value)}
    placeholder="Session name"
  />

  <TeamConfiguration teams={session.teams} />

  <button onClick={handleToggleSessionReasons}>
    {session.reasons_enabled ? 'Reasons Enabled' : 'Reasons Disabled'}
  </button>

  <button onClick={handleToggleTestMode}>
    {session.test_mode ? 'Test Mode On' : 'Test Mode Off'}
  </button>
</div>

// ✅ KEEP: SequenceManager (but remove inline editing)
<SequenceManager
  sessionId={session.session_id}
  onExpandBatch={(batchId) => setExpandedBatchId(batchId)}
  onCreateBatch={handleCreateBatch}
  onDeleteBatch={handleDeleteBatch}
  onDeleteSlide={handleDeleteSlide}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static "Results ready" badge | Live progress bar with vote count | Phase 26 | Admin sees real-time voting progress instead of binary ready state |
| Single-item drag only | Multi-select group drag | Phase 26 | Faster batch reordering for long sequences |
| Content editing in session config | Template editor for all content | Phase 22-23 | Session config focuses on runtime settings, reduces duplicate UI |
| Polling for vote updates | Realtime postgres_changes subscription | Phase 4 (existing) | Immediate updates, lower server load |

**Deprecated/outdated:**
- Editing slides and questions in session config — now done exclusively in template editor
- Default template selector in session config — moved to template editor settings

## Open Questions

1. **Multi-select drag overlay visual**
   - What we know: @dnd-kit provides DragOverlay for single items
   - What's unclear: Best UX for showing multiple selected items during drag (stacked cards, ghost stack, count badge?)
   - Recommendation: Start with count badge on drag overlay (e.g., "3 items"), iterate based on user feedback

2. **Handling existing sessions created with old config flow**
   - What we know: Older sessions may have slides/questions created before template editor existed
   - What's unclear: Should we migrate data, show read-only view, or allow legacy editing?
   - Recommendation: Keep existing data as-is, remove creation UI but allow deletion. Users migrate content manually to templates if needed.

3. **Progress bar placement when batch is not active**
   - What we know: Progress bar replaces "Results ready" text for active batches
   - What's unclear: What to show for inactive batches (draft, closed)?
   - Recommendation: Show nothing (no badge) for draft batches, show final count for closed batches

## Sources

### Primary (HIGH confidence)
- @dnd-kit Documentation: [https://docs.dndkit.com/](https://docs.dndkit.com/)
- Supabase Realtime Postgres Changes: [https://supabase.com/docs/guides/realtime/postgres-changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- Existing codebase patterns: SequenceManager.tsx, AdminSession.tsx, ProgressDashboard.tsx

### Secondary (MEDIUM confidence)
- dnd-kit multi-select discussion: [https://github.com/clauderic/dnd-kit/issues/120](https://github.com/clauderic/dnd-kit/issues/120)
- React shift-click pattern: [https://stereobooster.com/posts/react-hook-to-select-multiple-items-with-a-shift/](https://stereobooster.com/posts/react-hook-to-select-multiple-items-with-a-shift/)
- TanStack table multi-select: [https://github.com/TanStack/table/discussions/3068](https://github.com/TanStack/table/discussions/3068)

### Tertiary (LOW confidence)
- Top drag-and-drop libraries 2026: [https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed and integrated
- Architecture: HIGH - Strong precedent in existing SequenceManager.tsx and realtime patterns
- Pitfalls: MEDIUM - Multi-select edge cases well-documented in community, but implementation needs testing

**Research date:** 2026-02-14
**Valid until:** 2026-03-15 (30 days for stable stack, 7 days for fast-moving features if any changes)
