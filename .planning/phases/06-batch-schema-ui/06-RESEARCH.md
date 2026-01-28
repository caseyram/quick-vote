# Phase 6: Batch Schema & UI - Research

**Researched:** 2026-01-28
**Domain:** React UI patterns, Supabase schema design, drag-and-drop interactions
**Confidence:** HIGH

## Summary

Phase 6 adds the ability for admins to create questions on-the-fly and organize them into named batches within a session. This research investigated three primary domains: (1) drag-and-drop libraries for question reordering within batches, (2) Supabase schema patterns for nullable foreign keys representing batch relationships, and (3) React UI patterns for inline expandable forms and accordion behavior.

The standard approach for React drag-and-drop in 2026 is **dnd-kit** with its sortable preset, which provides TypeScript-first hooks and excellent performance at ~10kb minified. For database schema, batches should be stored as a separate table with questions having an optional `batch_id` foreign key (nullable to preserve unbatched questions). UI patterns favor controlled components with inline expansion using CSS `max-height` transitions or the `react-collapsed` hook for accessibility.

**Primary recommendation:** Use `@dnd-kit/sortable` for question reordering, add a `batches` table with nullable `batch_id` foreign key on questions, and implement accordion behavior with controlled React state managing single-expanded-batch logic.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | Latest | Core drag-and-drop primitives | Modern, lightweight (~10kb), built for React hooks, no HTML5 DnD API dependencies |
| @dnd-kit/sortable | Latest | Sortable list preset | Optimized for vertical lists, provides `useSortable` hook and `arrayMove` utility |
| @dnd-kit/utilities | Latest | Helper utilities | CSS transforms, array manipulation (`arrayMove`) |
| Supabase Postgres | Current | Relational database | Existing project stack, supports nullable foreign keys with proper indexing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-collapsed | Latest (optional) | Accessible collapse/expand | If building custom accordion needs accessibility out-of-the-box |
| Immer | 10+ (optional) | Immutable nested state | If Zustand nested batch state becomes complex (current store is flat) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | React DnD | React DnD is older, heavier, less modern API; dnd-kit is preferred in 2026 |
| dnd-kit | Pragmatic Drag & Drop (Atlassian) | Framework-agnostic but less React-idiomatic; dnd-kit better for React apps |
| Custom accordion | Material-UI Accordion | MUI adds significant bundle size; custom is lighter for simple use case |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Database Schema

Add a `batches` table and modify `questions` table:

```sql
-- New batches table
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Batch',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add to questions table
ALTER TABLE questions
  ADD COLUMN batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;

-- Index foreign key (PostgreSQL does NOT auto-index FKs)
CREATE INDEX idx_questions_batch_id ON questions(batch_id);
CREATE INDEX idx_batches_session_id ON batches(session_id);
```

**Why nullable `batch_id`:** Preserves v1.0 live-push functionality where questions exist without batches. NULL means "unbatched."

**Why `ON DELETE SET NULL`:** When a batch is deleted, questions become unbatched (non-destructive default per CONTEXT.md).

**Why explicit indexes:** PostgreSQL does NOT automatically create indexes on foreign key columns. Without indexes, deleting batches or joining on `batch_id` requires sequential scans. Indexing is critical for performance.

### Pattern 1: Sortable List with dnd-kit

**What:** Vertical sortable list for reordering questions within a batch.

**When to use:** Any list that needs drag-and-drop reordering with visual feedback.

**Example:**
```typescript
// Source: https://docs.dndkit.com/presets/sortable
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function BatchQuestionList({ batchId, questions }: Props) {
  const [items, setItems] = useState(questions);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(q => q.id === active.id);
        const newIndex = items.findIndex(q => q.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // Then update positions in Supabase
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(q => q.id)} strategy={verticalListSortingStrategy}>
        {items.map(q => <SortableQuestionItem key={q.id} question={q} />)}
      </SortableContext>
    </DndContext>
  );
}

function SortableQuestionItem({ question }: { question: Question }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners} className="drag-handle">☰</div>
      {question.text}
    </div>
  );
}
```

### Pattern 2: Accordion with Single-Expanded State

**What:** Accordion where expanding one batch collapses others.

**When to use:** When users should focus on one batch at a time (per CONTEXT.md decision).

**Example:**
```typescript
// Controlled component pattern
function BatchList({ batches }: Props) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  return (
    <div>
      {batches.map(batch => (
        <BatchCard
          key={batch.id}
          batch={batch}
          isExpanded={expandedBatchId === batch.id}
          onToggle={() => setExpandedBatchId(prev => prev === batch.id ? null : batch.id)}
        />
      ))}
    </div>
  );
}

function BatchCard({ batch, isExpanded, onToggle }: Props) {
  return (
    <div className="border rounded-lg">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <h3>{batch.name}</h3>
        <p className="text-sm text-gray-500">{batch.questions.length} questions</p>
      </button>
      {isExpanded && (
        <div className="p-4 border-t">
          {/* Expanded content: questions list, drag-drop, add question form */}
        </div>
      )}
    </div>
  );
}
```

### Pattern 3: Inline Form Expansion

**What:** Form appears inline within parent component when triggered.

**When to use:** Creating questions within batches, creating new batches inline.

**Example:**
```typescript
function BatchCard({ batch }: Props) {
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  return (
    <div>
      {/* Existing questions */}
      {batch.questions.map(q => <QuestionItem key={q.id} question={q} />)}

      {/* Inline form toggle */}
      {!showAddQuestion ? (
        <button onClick={() => setShowAddQuestion(true)}>+ Add Question</button>
      ) : (
        <QuestionForm
          batchId={batch.id}
          onSaved={() => setShowAddQuestion(false)}
          onCancel={() => setShowAddQuestion(false)}
        />
      )}
    </div>
  );
}
```

### Pattern 4: Zustand Nested State Updates

**What:** Update nested batch/question state immutably in Zustand store.

**When to use:** Managing batches array with nested questions.

**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs/guides/updating-state
interface BatchState {
  batches: Batch[];
  addBatch: (batch: Batch) => void;
  updateBatch: (id: string, updates: Partial<Batch>) => void;
  addQuestionToBatch: (batchId: string, question: Question) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  batches: [],

  addBatch: (batch) => set((state) => ({
    batches: [...state.batches, batch]
  })),

  updateBatch: (id, updates) => set((state) => ({
    batches: state.batches.map(b => b.id === id ? { ...b, ...updates } : b)
  })),

  // Nested update: add question to specific batch
  addQuestionToBatch: (batchId, question) => set((state) => ({
    batches: state.batches.map(b =>
      b.id === batchId
        ? { ...b, questions: [...b.questions, question] }
        : b
    )
  }))
}));
```

### Anti-Patterns to Avoid

- **Anti-pattern:** Storing batch_id in client state only, not in database
  - **Why bad:** Refreshing page loses batch assignments
  - **Do instead:** Persist batch_id in questions table immediately

- **Anti-pattern:** Not indexing foreign key columns
  - **Why bad:** Deleting batches triggers sequential scans of questions table
  - **Do instead:** Always create indexes on foreign key columns in PostgreSQL

- **Anti-pattern:** Using HTML5 drag-drop API directly
  - **Why bad:** Browser inconsistencies, accessibility issues, touch support requires polyfills
  - **Do instead:** Use dnd-kit which abstracts these problems

- **Anti-pattern:** Deep nesting batches in Zustand without Immer
  - **Why bad:** Manual spread operators are error-prone for deep updates
  - **Do instead:** Keep state flat or use Immer for complex nesting

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mouse event handlers | @dnd-kit/sortable | Touch support, keyboard navigation, screen readers, collision detection, visual feedback |
| Text truncation with ellipsis | JavaScript character counting | CSS `line-clamp` | Responsive, handles font changes, browser-optimized, no JS needed |
| Accordion collapse animation | Manual height calculation | CSS `max-height` transition or `react-collapsed` | Handles dynamic content height, accessibility attrs (aria-expanded), smoother animations |
| Array reordering logic | Manual splice/slice | `arrayMove` from @dnd-kit/utilities | Handles edge cases, optimized, tested |
| Nullable FK cascade behavior | Manual cleanup queries | `ON DELETE SET NULL` | Atomic, guaranteed consistency, database-level enforcement |

**Key insight:** UI interactions like drag-and-drop have many edge cases (touch vs mouse, keyboard navigation, screen readers, momentum scrolling). Mature libraries have solved these; custom implementations often miss accessibility or mobile support.

## Common Pitfalls

### Pitfall 1: Forgetting to Index Foreign Keys in PostgreSQL

**What goes wrong:** Deleting a batch or running queries with joins on `batch_id` becomes slow as table grows. On a million-row questions table, deleting a batch without an index requires scanning all rows.

**Why it happens:** Developers assume PostgreSQL auto-indexes foreign keys (like some databases do). PostgreSQL does NOT.

**How to avoid:** Always create explicit indexes on foreign key columns immediately after adding the constraint.

**Warning signs:** Slow delete operations on parent table, slow joins in query plans, `Seq Scan` in EXPLAIN output for FK lookups.

### Pitfall 2: Breaking Accordion State When Items Update

**What goes wrong:** User expands a batch, then a question is added via realtime. The accordion collapses unexpectedly because component re-renders with new data.

**Why it happens:** Expanded state is keyed by batch ID, but parent component re-renders reset local state if not properly managed.

**How to avoid:**
- Lift accordion state to parent component (persist across batch updates)
- Use stable IDs, not array indexes, for expanded tracking
- Test that realtime updates don't collapse expanded sections

**Warning signs:** Users complain accordion "jumps" or closes while they're adding questions.

### Pitfall 3: Drag Handle Not Activating Drag

**What goes wrong:** User tries to drag by the handle icon, but nothing happens or entire card drags.

**Why it happens:** Drag listeners (`{...listeners}`) applied to wrong element, or event bubbling interferes.

**How to avoid:**
- Apply `{...listeners}` specifically to handle element, NOT entire card
- Use `event.stopPropagation()` if handle is nested inside clickable card
- Test on both mouse and touch devices

**Warning signs:** Dragging works when clicking anywhere, but not the handle; or handle click triggers card click instead.

### Pitfall 4: Position Field Drift After Concurrent Edits

**What goes wrong:** Two admins reorder questions simultaneously. Positions conflict, questions appear in wrong order or duplicate positions.

**Why it happens:** Client calculates new positions (0, 1, 2...) and writes them, but another client does same concurrently with stale data.

**How to avoid:**
- Use fractional positions (1, 2, 3) or lexicographic ordering instead of sequential integers
- OR: server-side position recalculation after each reorder
- OR: optimistic locking with version field

**Warning signs:** Question order differs between admin views, positions have duplicates after reordering.

### Pitfall 5: Unbatched Questions Disappearing from View

**What goes wrong:** After implementing batches, unbatched questions (batch_id = NULL) don't appear in UI because query only fetches batched questions.

**Why it happens:** Developer forgets to handle NULL case in query or UI logic.

**How to avoid:**
- Explicitly query for `batch_id IS NULL` to get unbatched questions
- Render unbatched questions alongside batches in creation order
- Test with mix of batched and unbatched questions

**Warning signs:** Old questions from v1.0 vanish after v1.1 deployment.

## Code Examples

Verified patterns from official sources:

### Installing and Using dnd-kit Sortable

```typescript
// Installation
// npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

// Source: https://docs.dndkit.com/presets/sortable
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableList({ items }) {
  const [activeItems, setActiveItems] = useState(items);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setActiveItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={activeItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {activeItems.map(item => <SortableItem key={item.id} id={item.id} />)}
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Item content */}
    </div>
  );
}
```

### CSS Text Truncation with Ellipsis

```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp */

/* Single-line truncation */
.truncate-single {
  width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Multi-line truncation (3 lines) */
.truncate-multi {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

### Supabase Schema Migration

```sql
-- Source: https://supabase.com/docs/guides/database/tables
-- Create batches table
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Batch',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_batches_session
    FOREIGN KEY (session_id)
    REFERENCES sessions(session_id)
    ON DELETE CASCADE
);

-- Add batch_id to questions
ALTER TABLE questions
  ADD COLUMN batch_id UUID,
  ADD CONSTRAINT fk_questions_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE SET NULL;

-- CRITICAL: Index foreign keys (PostgreSQL doesn't auto-index)
CREATE INDEX idx_questions_batch_id ON questions(batch_id);
CREATE INDEX idx_batches_session_id ON batches(session_id);
```

### Inline Form Pattern

```typescript
// Controlled form expansion pattern
function BatchSection({ batch }: { batch: Batch }) {
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <h3>{batch.name}</h3>

      {/* Existing questions */}
      <ul>
        {batch.questions.map(q => <li key={q.id}>{q.text}</li>)}
      </ul>

      {/* Conditional inline form */}
      {isAddingQuestion ? (
        <QuestionForm
          batchId={batch.id}
          onSaved={() => setIsAddingQuestion(false)}
          onCancel={() => setIsAddingQuestion(false)}
        />
      ) : (
        <button onClick={() => setIsAddingQuestion(true)}>
          + Add Question
        </button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React DnD (HTML5 backend) | dnd-kit | ~2021-2022 | Lighter bundle, better mobile/touch, hooks-first API |
| Custom drag handlers | dnd-kit with sensors | 2022+ | Accessibility, keyboard nav, touch/pointer abstraction |
| -webkit-line-clamp (vendor prefix only) | Standard `line-clamp` property | 2024-2025 | Broader browser support, no vendor prefix needed in 2026 |
| Manual FK cascade cleanup | `ON DELETE SET NULL` / `CASCADE` | Always standard | Less code, atomic consistency, database guarantees |

**Deprecated/outdated:**
- **react-beautiful-dnd**: No longer actively maintained; dnd-kit is successor
- **Manual height animations with JS**: CSS transitions with `max-height` or `react-collapsed` are smoother and more accessible

## Open Questions

Things that couldn't be fully resolved:

1. **Should batches and unbatched questions share position field, or separate numbering?**
   - What we know: CONTEXT.md says "interleaved by creation order"
   - What's unclear: Whether to use `created_at` timestamp or unified `position` field
   - Recommendation: Use separate `position` fields on batches and questions, then merge/sort by `created_at` in client for "interleaved by creation" view. Allows explicit reordering within batches while preserving creation-order interleaving.

2. **How to handle batch creation with first question in single transaction?**
   - What we know: UX wants "+ New Batch" to expand inline with name field + question area
   - What's unclear: Create empty batch first, or wait until first question saved?
   - Recommendation: Create batch immediately with default name, allow renaming inline. Prevents orphaned empty batches by having "+ Add Question" always present. If user navigates away, empty batch exists but doesn't hurt.

3. **Realtime updates for batch operations: broadcast or Postgres Changes?**
   - What we know: v1.0 uses Postgres Changes for questions
   - What's unclear: Batch CRUD should follow same pattern or use broadcast?
   - Recommendation: Use Postgres Changes for consistency. Filter: `filter: 'session_id=eq.${sessionId}'` on batches table. Performance is acceptable for admin-only operations (low volume).

## Sources

### Primary (HIGH confidence)
- dnd-kit documentation: https://docs.dndkit.com/presets/sortable
- dnd-kit GitHub: https://github.com/clauderic/dnd-kit
- MDN line-clamp: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp
- Supabase Database Migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Zustand Updating State: https://zustand.docs.pmnd.rs/guides/updating-state

### Secondary (MEDIUM confidence)
- PostgreSQL Foreign Key Indexing: https://www.cybertec-postgresql.com/en/index-your-foreign-key/
- React Hook Form Validation: https://www.react-hook-form.com/api/useformstate/errormessage/
- CSS-Tricks line-clamp: https://css-tricks.com/almanac/properties/l/line-clamp/
- Supabase Performance Advisors: https://supabase.com/docs/guides/database/database-advisors

### Tertiary (LOW confidence)
- Top React Drag-Drop Libraries 2026: https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react (WebSearch, marketing content)
- React Collapse Patterns: https://blog.logrocket.com/create-collapsible-react-components-react-collapsed/ (WebSearch, tutorial)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dnd-kit is well-documented, actively maintained, official docs verify features
- Architecture: HIGH - Database patterns verified via Supabase docs and PostgreSQL best practices
- Pitfalls: MEDIUM - Derived from general PostgreSQL and React best practices, not all specific to this exact use case
- Realtime performance: MEDIUM - Supabase docs confirm patterns but specific scale limits depend on instance size

**Research date:** 2026-01-28
**Valid until:** ~60 days (libraries stable, but check for dnd-kit updates)

**Key assumptions verified:**
- ✅ dnd-kit supports TypeScript (confirmed via CodeSandbox examples)
- ✅ PostgreSQL does NOT auto-index foreign keys (confirmed Supabase docs, PostgreSQL docs)
- ✅ CSS line-clamp has broad browser support in 2026 (confirmed MDN compat data)
- ✅ Zustand handles nested updates with spread operators (confirmed official docs)
- ✅ Supabase Postgres Changes support filters (confirmed realtime docs)
