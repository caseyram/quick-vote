# Phase 17: Unified Sequence - Research

**Researched:** 2026-02-10
**Domain:** Drag-and-drop heterogeneous list UI, session_items CRUD, database backfill
**Confidence:** HIGH

## Summary

Phase 17 creates a unified sequence by consolidating batches and slides into a single ordered list using the existing `session_items` table. The project already has robust @dnd-kit patterns in `BatchList.tsx` and `TemplateEditor.tsx`, strong precedent for position-based reordering, and slide CRUD operations in `slide-api.ts`. The primary technical challenges are: (1) lazy backfilling session_items from batch ordering on-demand, (2) extending the existing drag-and-drop pattern to support mixed item types (batch cards vs. slide cards), and (3) auto-save optimistic updates with proper error recovery.

The standard approach is to use @dnd-kit's `SortableContext` with heterogeneous item IDs, implement on-demand backfill in a client-side function (not migration), and leverage existing position update patterns. Color-coded cards (blue tints for batches, purple tints for slides) with type icons provide visual distinction. Auto-save on drop is implemented with optimistic Zustand updates followed by sequential database writes.

**Primary recommendation:** Extend existing `BatchList.tsx` patterns for heterogeneous lists, implement lazy backfill on session load, use Tailwind color tints (blue-50/100 for batches, purple-50/100 for slides), and apply the proven `handleReorderItems` sequential update pattern to `session_items.position`.

## Standard Stack

The project already has the complete stack needed for this phase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | Already used in BatchList and TemplateEditor |
| @dnd-kit/sortable | 10.0.0 | Sortable list preset | Provides useSortable hook and array reordering |
| @dnd-kit/utilities | 3.2.2 | CSS transform utilities | Standard companion for DnD animations |
| Zustand | 5.0.5 | State management | Project's chosen state solution |
| Supabase JS | 2.93.1 | Database client | Project's backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.1.18 | Styling framework | Card tints, spacing, responsive design |
| React Router | 7.6.1 | Navigation | Session page routing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | react-beautiful-dnd | @dnd-kit is lighter, more flexible, already integrated |
| Sequential DB updates | PostgreSQL RPC transaction | Supabase JS client lacks transaction support, RPC adds complexity |
| Client-side backfill | Migration with backfill | Lazy loading avoids affecting old sessions until opened |

**Installation:**
No new dependencies required — all libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── SequenceManager.tsx      # NEW: Unified sequence UI
│   └── SequenceItemCard.tsx     # NEW: Card for batch or slide
├── lib/
│   ├── sequence-api.ts          # NEW: session_items CRUD + backfill
│   └── slide-api.ts             # EXISTS: Slide operations (reuse)
├── stores/
│   └── session-store.ts         # EXTEND: Add sessionItems state
└── pages/
    └── AdminSession.tsx         # MODIFY: Replace BatchList with SequenceManager
```

### Pattern 1: Heterogeneous Sortable List with @dnd-kit
**What:** Single `SortableContext` managing mixed item types (batches and slides) with type-prefixed IDs.
**When to use:** Unified ordering of different entity types in a single list.
**Example:**
```typescript
// Source: Existing BatchList.tsx pattern (lines 289-318)
const interleavedItems = useMemo(() => {
  const items: ListItem[] = [];

  // Add batches with type prefix
  for (const batch of batches) {
    items.push({
      type: 'batch',
      batch,
      id: `batch-${batch.id}`,
      position: batch.position,
    });
  }

  // Add slides with type prefix
  for (const slide of slides) {
    items.push({
      type: 'slide',
      slide,
      id: `slide-${slide.id}`,
      position: slide.position,
    });
  }

  return items.sort((a, b) => a.position - b.position);
}, [batches, slides]);

const sortableIds = interleavedItems.map(item => item.id);

// DndContext with single SortableContext
<DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
    {interleavedItems.map(item => (
      item.type === 'batch'
        ? <BatchCard key={item.id} {...item.batch} />
        : <SlideCard key={item.id} {...item.slide} />
    ))}
  </SortableContext>
</DndContext>
```
**Key requirements:**
- IDs must be unique and type-prefixed (`batch-${uuid}`, `slide-${uuid}`)
- Array order MUST match render order (sort by position before mapping)
- Use `closestCenter` collision detection for forgiving drag behavior

### Pattern 2: On-Demand Lazy Backfill
**What:** Generate session_items from existing data when first needed, not via migration.
**When to use:** Adding new schema without forcing immediate data migration for all records.
**Example:**
```typescript
// Source: Recommended pattern for QuickVote architecture
async function ensureSessionItems(sessionId: string): Promise<SessionItem[]> {
  // 1. Check if session_items already exist
  const { data: existing } = await supabase
    .from('session_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (existing && existing.length > 0) {
    return existing; // Already backfilled
  }

  // 2. Fetch batches to backfill from
  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (!batches || batches.length === 0) {
    return []; // Empty session, nothing to backfill
  }

  // 3. Create session_items for each batch
  const itemsToInsert = batches.map((batch, index) => ({
    session_id: sessionId,
    item_type: 'batch' as const,
    position: index,
    batch_id: batch.id,
  }));

  const { data: inserted, error } = await supabase
    .from('session_items')
    .insert(itemsToInsert)
    .select();

  if (error) throw error;

  return inserted ?? [];
}
```
**Call on session load:** In `AdminSession.tsx` after loading session, batches, questions.

### Pattern 3: Sequential Position Updates (Auto-Save)
**What:** Update item positions one-by-one in sequence, with optimistic UI updates.
**When to use:** Drag-and-drop reordering that persists to database immediately.
**Example:**
```typescript
// Source: Existing AdminSession.tsx handleReorderItems (lines 694-710)
async function handleReorderSessionItems(itemIds: string[]) {
  if (!session) return;

  // Optimistic update in Zustand store first
  const updates = itemIds.map((id, index) => ({ id, position: index }));
  useSessionStore.getState().updateSessionItemPositions(updates);

  // Then persist to database sequentially
  for (let index = 0; index < itemIds.length; index++) {
    const itemId = itemIds[index];

    if (itemId.startsWith('batch-')) {
      const batchItemId = itemId.replace('batch-', '');
      await supabase
        .from('session_items')
        .update({ position: index })
        .eq('id', batchItemId);
    } else if (itemId.startsWith('slide-')) {
      const slideItemId = itemId.replace('slide-', '');
      await supabase
        .from('session_items')
        .update({ position: index })
        .eq('id', slideItemId);
    }
  }
}
```
**Why sequential, not batch:** Supabase JS client lacks transaction support. Sequential ensures partial success on network issues.

### Pattern 4: Color-Coded Type Distinction
**What:** Use Tailwind background tints and type icons to visually distinguish item types.
**When to use:** Heterogeneous lists where users need quick visual recognition.
**Example:**
```typescript
// Source: Tailwind color system + existing card patterns
function SequenceItemCard({ item }: { item: ListItem }) {
  const colorClasses = item.type === 'batch'
    ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
    : 'bg-purple-50 border-purple-200 hover:border-purple-300';

  const icon = item.type === 'batch'
    ? <BatchIcon className="w-5 h-5 text-blue-600" />
    : <ImageIcon className="w-5 h-5 text-purple-600" />;

  return (
    <div className={`border rounded-lg p-4 ${colorClasses}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="text-gray-900 font-medium">
          {item.type === 'batch' ? item.batch.name : item.slide.caption}
        </span>
      </div>
    </div>
  );
}
```
**Accessibility:** Blue-50/purple-50 backgrounds with blue-600/purple-600 icons meet WCAG 4.5:1 contrast for text.

### Pattern 5: DragOverlay for Visual Feedback
**What:** Render a simplified drag preview that follows the cursor during drag.
**When to use:** Always with sortable lists — improves perceived drag responsiveness.
**Example:**
```typescript
// Source: @dnd-kit official patterns + existing TemplateEditor
const [activeId, setActiveId] = useState<string | null>(null);

function handleDragStart(event: DragStartEvent) {
  setActiveId(event.active.id as string);
}

function handleDragEnd(event: DragEndEvent) {
  setActiveId(null);
  // ... reorder logic
}

const activeItem = activeId
  ? interleavedItems.find(item => item.id === activeId)
  : null;

<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
  {/* ... SortableContext */}

  <DragOverlay>
    {activeItem && (
      <div className="bg-white border-2 border-indigo-500 rounded-lg p-4 shadow-lg opacity-90">
        {activeItem.type === 'batch' ? (
          <span>{activeItem.batch.name}</span>
        ) : (
          <span>{activeItem.slide.caption || 'Slide'}</span>
        )}
      </div>
    )}
  </DragOverlay>
</DndContext>
```
**Critical:** Do NOT render components with `useSortable` inside `DragOverlay` — creates ID collision.

### Anti-Patterns to Avoid
- **Conditionally rendering DragOverlay:** Breaks drop animation. Always mount it, conditionally render children.
- **Using batch.position after session_items backfill:** Once session_items exist, they are the source of truth for order. Batch.position becomes stale.
- **Updating both session_items.position AND batch.position:** Causes ambiguity and sync issues. session_items.position is authoritative.
- **Using debounce for drag auto-save:** Throttle is safer for periodic saves. But for drag-and-drop, immediate optimistic update + sequential save is best.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop ordering | Custom mouse event handlers | @dnd-kit | Handles touch, keyboard, accessibility, collision detection, animations |
| Array reordering on drop | Manual splice logic | arrayMove from @dnd-kit/sortable | Handles edge cases, optimized |
| Backfill detection | Migration with conditional logic | Client-side lazy check on load | Avoids migration complexity, no risk to existing sessions |
| Database transactions | Multiple RPC calls or batched updates | Sequential awaits | Supabase JS lacks transactions, sequential is clearest |
| Color palette generation | Custom color picker | Tailwind color scale (50-950) | WCAG-tested, consistent, designer-approved |
| Optimistic updates | Manual state rollback on error | Zustand immediate update + async persist | Simple, reliable, matches existing patterns |

**Key insight:** Drag-and-drop has many edge cases (touch devices, keyboard navigation, screen readers, collision bugs, animation timing). @dnd-kit solves all of these. The project already uses it successfully in two components — extending that pattern is far simpler than reimplementing.

## Common Pitfalls

### Pitfall 1: Position Ambiguity Between Tables
**What goes wrong:** After introducing session_items with its own position column, code continues to read/write batch.position, causing sync issues and incorrect ordering.

**Why it happens:** The existing `BatchList.tsx` component (line 289-316) builds an interleaved list by combining `batches` (with their `position` values) and unbatched `questions` (with their `position` values) and sorting by position. The `reorderQuestions` function in `session-store.ts` (line 77-85) and the `onReorderItems` callback in `BatchList` both assume positions are integers in a shared space.

Introducing a new `session_items` table with its own `position` column creates ambiguity: Does `batch.position` still matter? Do you write to both? What happens when a drag-and-drop in the unified sequence needs to update positions in `session_items` AND `batches`?

**How to avoid:**
1. **After backfill, session_items.position is authoritative.** Batch.position becomes legacy data.
2. **Do NOT update batch.position in reorder handlers.** Only update `session_items.position`.
3. **Fetch order from session_items, not batches.** Query `session_items` table for display order, join to batches by `batch_id`.

**Warning signs:**
- Reorder handler updates two tables (session_items and batches)
- Display order differs after reload vs. after drag
- Batches appear in wrong order after adding a slide

### Pitfall 2: Forgetting to Backfill Before First Use
**What goes wrong:** User opens a session that hasn't been backfilled yet, sequence list is empty despite having batches.

**Why it happens:** The lazy backfill pattern requires calling `ensureSessionItems()` on session load. If this step is forgotten or happens after rendering, the UI shows empty state even though batches exist.

**How to avoid:**
1. **Call backfill early in session load flow.** After fetching session, batches, and questions, immediately call `ensureSessionItems(sessionId)`.
2. **Show loading state during backfill.** Don't render SequenceManager until session_items are ready.
3. **Handle backfill errors gracefully.** If backfill fails, fall back to showing batches directly (graceful degradation).

**Warning signs:**
- Existing sessions show "No items yet" despite having batches
- Console error: "session_items not found"
- Sequence list is empty but BatchList (if still present) shows items

### Pitfall 3: DragOverlay ID Collision
**What goes wrong:** Dragging causes React warnings: "Duplicate draggable id detected" or drag behavior is glitchy.

**Why it happens:** Per @dnd-kit official docs: "A common mistake is to render the component that calls `useSortable` inside `DragOverlay`. This causes an `id` collision between the two components both calling `useDraggable` with the same `id`."

When you render `<BatchCard />` (which uses `useSortable`) inside `DragOverlay`, you create two active draggable elements with the same ID.

**How to avoid:**
1. **Create a separate presentational component for DragOverlay.** Example: `SequenceItemPreview` that takes item data but does NOT call `useSortable`.
2. **Render minimal content in DragOverlay.** Just a styled div with item name/icon, no interactive elements.
3. **Keep DragOverlay mounted at all times.** Conditionally unmounting prevents drop animations from working.

**Warning signs:**
- React console error about duplicate IDs
- Drag preview appears in wrong location
- Drop animation doesn't play

### Pitfall 4: Cascade Delete Confusion
**What goes wrong:** Deleting a batch removes its session_item row automatically, but position gaps remain, causing visual jumps in the sequence.

**Why it happens:** The `session_items` table has `ON DELETE CASCADE` for `batch_id` foreign key. When a batch is deleted, its session_item row is automatically removed by PostgreSQL. However, this doesn't renumber the remaining items' positions, leaving gaps (e.g., positions 0, 1, 3, 5 after deleting items at 2 and 4).

**How to avoid:**
1. **After deleting a batch, re-fetch session_items.** Let the UI rebuild from current database state.
2. **Alternatively, manually renumber positions.** After delete, update remaining items' positions to close gaps.
3. **Renumbering query:**
   ```sql
   -- After deleting item at position 2
   UPDATE session_items
   SET position = position - 1
   WHERE session_id = ? AND position > 2;
   ```

**Warning signs:**
- Gaps in position numbers (0, 1, 3, 5 instead of 0, 1, 2, 3)
- Items appear to jump positions after batch deletion
- Drag-and-drop produces unexpected order after deletions

### Pitfall 5: Creating Item Without Position
**What goes wrong:** New slides or batches are created but don't appear in the sequence, or appear in wrong position.

**Why it happens:** When creating a new session_item, if you don't calculate the next position correctly, it may overlap with an existing item or default to position 0, causing conflicts.

The existing `slide-api.ts` `createSlide` function (lines 24-59) demonstrates the correct pattern: fetch max position, add 1. However, if multiple items are created rapidly, this can race.

**How to avoid:**
1. **Determine position based on user intent:**
   - If user selected an item, insert after its position (selected.position + 1)
   - If nothing selected, append to end (max position + 1)
2. **Re-fetch sequence after create to ensure correctness.** The server's created position is authoritative.
3. **For rapid creates, use a counter in client state.** Track the "next position to use" and increment locally, then sync with server on next load.

**Warning signs:**
- New items don't appear in sequence list
- New items appear at the start instead of end
- Multiple new items have the same position

## Code Examples

Verified patterns from existing codebase and official documentation:

### Drag-and-Drop Handler with Type Detection
```typescript
// Source: Existing AdminSession.tsx handleReorderItems (lines 694-710)
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const activeId = active.id as string;
  const overId = over.id as string;

  // Find old and new positions
  const oldIndex = sortableIds.indexOf(activeId);
  const newIndex = sortableIds.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1) return;

  // Reorder the array
  const reordered = [...sortableIds];
  reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, activeId);

  // Persist to database
  await handleReorderSessionItems(reordered);
}
```

### Sensor Configuration for Touch and Keyboard
```typescript
// Source: Existing BatchList.tsx (lines 277-286)
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Prevents accidental drags, allows clicks
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

### Creating Session Item with Correct Position
```typescript
// Source: Existing slide-api.ts createSlide (lines 24-59)
async function createSessionItem(
  sessionId: string,
  itemType: 'batch' | 'slide',
  itemData: { batch_id?: string; slide_image_path?: string; slide_caption?: string }
): Promise<SessionItem> {
  // 1. Determine next position
  const { data: existingItems, error: fetchError } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;

  const nextPosition = existingItems && existingItems.length > 0
    ? existingItems[0].position + 1
    : 0;

  // 2. Insert new item
  const { data, error } = await supabase
    .from('session_items')
    .insert({
      session_id: sessionId,
      item_type: itemType,
      position: nextPosition,
      ...itemData,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
```

### Zustand Store Extension for Session Items
```typescript
// Source: Pattern from existing session-store.ts
interface SessionState {
  // ... existing fields
  sessionItems: SessionItem[];

  setSessionItems: (items: SessionItem[]) => void;
  addSessionItem: (item: SessionItem) => void;
  updateSessionItem: (id: string, updates: Partial<SessionItem>) => void;
  removeSessionItem: (id: string) => void;
  updateSessionItemPositions: (updates: { id: string; position: number }[]) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  // ... existing state
  sessionItems: [],

  setSessionItems: (items) =>
    set({ sessionItems: [...items].sort((a, b) => a.position - b.position) }),

  addSessionItem: (item) =>
    set((state) => ({
      sessionItems: [...state.sessionItems, item].sort((a, b) => a.position - b.position),
    })),

  updateSessionItem: (id, updates) =>
    set((state) => ({
      sessionItems: state.sessionItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  removeSessionItem: (id) =>
    set((state) => ({
      sessionItems: state.sessionItems.filter((item) => item.id !== id),
    })),

  updateSessionItemPositions: (updates) =>
    set((state) => ({
      sessionItems: state.sessionItems.map((item) => {
        const update = updates.find(u => u.id === item.id);
        return update ? { ...item, position: update.position } : item;
      }).sort((a, b) => a.position - b.position),
    })),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate batch and slide lists | Unified session_items sequence | Phase 16 (migration 030) | Single source of truth for presentation order |
| Batch.position as authoritative | session_items.position as authoritative | Phase 17 (this phase) | Clearer ownership, supports interleaving |
| Migration-based backfill | Lazy on-demand backfill | Modern pattern (2025+) | Safer, doesn't force immediate data transformation |
| Debounce for auto-save | Throttle or immediate optimistic | Best practice shift (2024+) | Better data safety, throttle saves periodically |

**Deprecated/outdated:**
- **React Beautiful DnD**: Unmaintained since 2020, replaced by @dnd-kit (better performance, TypeScript support, accessibility)
- **Lodash debounce/throttle**: Use custom React hooks with useCallback and useRef (simpler, no dependency)
- **PostgreSQL array columns for ordering**: Use integer position column (more flexible, better query performance)

## Open Questions

Things that couldn't be fully resolved:

1. **Should batch.position be deprecated or kept in sync?**
   - What we know: After session_items backfill, session_items.position is the authoritative order
   - What's unclear: Whether to keep batch.position updated for backward compatibility or let it become stale
   - Recommendation: Let batch.position become legacy data. Updating both creates sync burden and bugs. If future phases need batch ordering in non-presentation contexts, re-assess then.

2. **How to handle sessions with slides but no batches?**
   - What we know: Backfill currently creates session_items from batches only
   - What's unclear: If a session has slides created directly (Phase 16) but no batches, backfill may not create batch items
   - Recommendation: Extend backfill to create session_items from BOTH existing batches AND existing slides (query both tables). This ensures no data loss.

3. **Should deletes automatically renumber positions?**
   - What we know: CASCADE deletes work, but leave position gaps
   - What's unclear: Whether to automatically renumber on delete (adds complexity) or rely on UI re-fetch
   - Recommendation: For Phase 17, rely on re-fetch after delete (simpler). If performance becomes an issue, add renumbering in Phase 18+.

## Sources

### Primary (HIGH confidence)
- @dnd-kit official documentation: [Sortable preset](https://docs.dndkit.com/presets/sortable) — verified patterns for heterogeneous lists
- @dnd-kit official documentation: [DragOverlay](https://docs.dndkit.com/api-documentation/draggable/drag-overlay) — drop animation and styling
- Existing codebase: `src/components/BatchList.tsx` (lines 1-597) — proven heterogeneous list pattern
- Existing codebase: `src/pages/AdminSession.tsx` handleReorderItems (lines 694-710) — sequential position update pattern
- Existing codebase: `src/lib/slide-api.ts` (lines 1-162) — session_items CRUD operations
- Existing codebase: `supabase/migrations/20250210_030_session_items.sql` — table schema and constraints
- Supabase Docs: [Cascade Deletes](https://supabase.com/docs/guides/database/postgres/cascade-deletes) — ON DELETE CASCADE behavior
- Tailwind CSS Docs: [Colors](https://tailwindcss.com/docs/colors) — color scale and accessibility

### Secondary (MEDIUM confidence)
- [Material UI Color System](https://mui.com/material-ui/customization/color/) — verified WCAG contrast ratios for tints
- [PrimeReact Color Palette](https://primereact.org/colors/) — surface palette patterns for backgrounds
- [Stripe: Accessible Color Systems](https://stripe.com/blog/accessible-color-systems) — design system color approach
- [Medium: Optimistic Updates with React Query and Zustand](https://medium.com/@anshulkahar2211/building-lightning-fast-uis-implementing-optimistic-updates-with-react-query-and-zustand-cfb7f9e7cd82) — patterns for auto-save
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react) — debounce vs throttle guidance

### Secondary (MEDIUM confidence - WebSearch verified with official)
- [Puck: Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — ecosystem overview
- [DataCamp: SQL ON DELETE CASCADE](https://www.datacamp.com/tutorial/sql-on-delete-cascade) — comprehensive guide to cascade behavior

### Tertiary (LOW confidence - WebSearch only)
- Various Medium articles on throttle vs debounce — general patterns, not React-specific verification
- Stack Overflow discussions on @dnd-kit heterogeneous lists — anecdotal, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, versions verified
- Architecture: HIGH - Patterns verified from existing codebase (BatchList, AdminSession)
- Pitfalls: HIGH - Position ambiguity documented in existing planning docs, cascade behavior from Supabase docs
- Code examples: HIGH - All examples from existing codebase or official @dnd-kit docs
- Color palette: MEDIUM - Tailwind color values verified, specific tints chosen based on accessibility guidelines but not user-tested

**Research date:** 2026-02-10
**Valid until:** 30 days (stable ecosystem, no fast-moving libraries involved)
