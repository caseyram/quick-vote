# Phase 22: Template Foundation & Authoring - Research

**Researched:** 2026-02-12
**Domain:** React template editor with drag-and-drop, inline editing, route-based navigation, and edit/preview modes
**Confidence:** HIGH

## Summary

Phase 22 implements a dedicated template editor at `/templates/:id/edit` where admins build session content through inline editing of batches and slides. The project already uses React Router 7 and @dnd-kit for drag-and-drop, providing a solid foundation. The editor requires a sidebar + main area layout with drag-reorderable sequence items, inline question editing within batches, an edit/preview toggle, and a quick session workflow (one-off vs. template-based).

The technical stack is well-established: React Router 7 for nested routes with Outlet components, @dnd-kit for drag-and-drop (already v6.3.1), and yet-another-react-lightbox for slide image viewing. The main architectural challenges involve state management for complex inline editing (keeping form state close to components), keyboard navigation for inline edits, and clean separation between edit and preview modes.

**Primary recommendation:** Use React Router 7's nested route pattern with layout routes for the editor shell, keep inline editing state local to question components (avoid over-using global state), use @dnd-kit's existing SortableContext pattern for both sidebar items and questions within batches, and implement edit/preview toggle via route-based state or URL parameter to maintain deep-linking capability.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Editor layout & navigation**
- Full-page route (/templates/:id/edit) — dedicated workspace, not a modal
- Sidebar + main area layout: left sidebar shows sequence items, main area shows selected item details
- Sidebar items are draggable with reorder — shows type icon + title + summary (batch shows question count, slide shows thumbnail)
- Top toolbar spanning full width above both sidebar and main area
- Toolbar contains: back arrow, template name (editable inline), insert actions, global session settings, save button, edit/preview toggle
- Insert actions in toolbar: Add Batch, Add Slide, Upload Image — new items insert after the currently selected sidebar item (like inserting slides in a presentation app)
- Add items available from both toolbar (quick insert) and main area (contextual, with guidance)

**Inline editing experience**
- When a batch is selected in sidebar, main area shows questions as collapsed compact rows
- Click a question row to expand it in place — reveals all editable fields (question text, response type, options/labels, timer override)
- Questions within a batch are drag-reorderable via handles on collapsed rows
- "Add question" button at the bottom of the question list within a batch

**Edit/preview toggle**
- Toggle control lives in the top toolbar (segmented control or toggle button)
- Preview mode hides the sidebar — content takes over full area
- Preview steps through sequence items like a live session experience (next/prev navigation, one item at a time)
- Phase 22 preview shows formatted content rendered as it would appear live
- Phase 23 extends this with multi-view options (projection, control, participant simulation)

**Quick session flow**
- "Create New" opens blank template editor — admin builds content, then chooses "Start Session" (one-off) or "Save Template" (reusable)
- "New from Template" opens existing template in the editor for review/tweaking before launch (copy, original untouched)
- "Start Session" launches directly without creating a template — truly one-off, session data persists but no template saved
- Past sessions can be retroactively saved as templates via "Save as Template" button in the session results view

### Claude's Discretion

- Phase 22 preview rendering scope (formatted content read-only vs. basic flow walk-through)
- Exact toolbar icon/control design and grouping
- Loading states and transitions between edit/preview modes
- Slide thumbnail sizing in sidebar
- Lightbox implementation for slide images (AUTH-07)
- Timer duration input component design (AUTH-09)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 7.6.1 | Nested routing for `/templates/:id/edit` | Already in use; v7 has excellent support for nested routes with Outlet, layout routes, and data loaders |
| @dnd-kit/core | 6.3.1 | Drag-and-drop for sidebar items and questions | Already in use in TemplateEditor.tsx and SequenceManager.tsx; modern, accessible, performant |
| @dnd-kit/sortable | 10.0.0 | Sortable lists for sequence items and questions | Already in use; pairs with @dnd-kit/core for reordering |
| @dnd-kit/utilities | 3.2.2 | CSS transform utilities for drag animations | Already in use; provides CSS.Transform.toString() |
| zustand | 5.0.5 | State management for editor state | Already in use via useSessionStore; excellent for complex local state without Redux overhead |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yet-another-react-lightbox | latest | Lightbox for slide image viewing (AUTH-07) | For viewing full-size slide images; modern, small bundle, responsive images, TypeScript built-in |
| browser-image-compression | 2.0.2 | Image compression before upload | Already in use in ImageUploader.tsx; compresses to WebP with quality control |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yet-another-react-lightbox | react-image-lightbox | react-image-lightbox is deprecated; yet-another is actively maintained, smaller, more modern |
| Local state + zustand | React Hook Form | RHF adds complexity for simple inline editing; local state is sufficient for expand/collapse + edit fields |
| Route-based preview toggle | Context API state | Route-based enables deep-linking and browser history; Context would lose URL state |

**Installation:**
```bash
npm install yet-another-react-lightbox
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── pages/
│   └── TemplateEditor.tsx           # Main editor page at /templates/:id/edit
├── components/
│   ├── editor/
│   │   ├── EditorToolbar.tsx        # Top toolbar with back, name, insert, settings, save, toggle
│   │   ├── EditorSidebar.tsx        # Left sidebar with sequence items
│   │   ├── EditorMainArea.tsx       # Right area showing selected item details
│   │   ├── SidebarSequenceItem.tsx  # Draggable sidebar item (batch or slide)
│   │   ├── BatchEditor.tsx          # Batch detail view with question list
│   │   ├── QuestionRow.tsx          # Collapsed/expanded question with inline edit
│   │   ├── SlideEditor.tsx          # Slide detail view with image + caption
│   │   ├── PreviewMode.tsx          # Preview with next/prev navigation
│   │   └── SegmentedControl.tsx     # Edit/Preview toggle (reusable)
│   └── shared/
│       ├── DurationInput.tsx        # Timer duration input (AUTH-09)
│       └── SlideLightbox.tsx        # Image lightbox wrapper (AUTH-07)
└── stores/
    └── template-editor-store.ts     # Editor state (selected item, edit mode, etc.)
```

### Pattern 1: Nested Route with Layout

**What:** Use React Router 7's nested routes with a layout route for the editor shell, then render editor content via Outlet

**When to use:** Full-page dedicated editors with persistent layout (toolbar, sidebar) and dynamic main area

**Example:**
```typescript
// App.tsx routes
<Route path="/templates/:id/edit" element={<TemplateEditorLayout />}>
  <Route index element={<EditorMainArea />} />
</Route>

// TemplateEditorLayout.tsx
import { Outlet } from 'react-router';

export default function TemplateEditorLayout() {
  return (
    <div className="flex flex-col h-screen">
      <EditorToolbar />
      <div className="flex-1 flex overflow-hidden">
        <EditorSidebar />
        <Outlet /> {/* EditorMainArea or PreviewMode */}
      </div>
    </div>
  );
}
```

**Source:** [React Router - Nested Routes with Outlet](https://reactrouter.com/7.9.5/start/framework/routing)

### Pattern 2: Inline Editing with Local State

**What:** Toggle between view and edit modes using local component state, auto-focus inputs on expand, handle keyboard events (Escape/Enter)

**When to use:** Inline editable fields (question rows, template name) where edit state is specific to one component

**Example:**
```typescript
// QuestionRow.tsx
function QuestionRow({ question, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on expand
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsExpanded(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsExpanded(false);
    }
  };

  return (
    <div onClick={() => setIsExpanded(true)}>
      {isExpanded ? (
        <input
          ref={inputRef}
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsExpanded(false)}
        />
      ) : (
        <span>{question.text}</span>
      )}
    </div>
  );
}
```

**Source:** [LogRocket - Build inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/)

### Pattern 3: Nested DndContext for Questions Within Batches

**What:** Nest a second SortableContext inside a batch to enable drag-reordering questions independently of sidebar items

**When to use:** Multi-level drag-and-drop where each level has independent reorder logic (sidebar items vs. questions within batch)

**Example:**
```typescript
// EditorSidebar.tsx (outer level)
<DndContext onDragEnd={handleSidebarReorder}>
  <SortableContext items={sidebarItemIds} strategy={verticalListSortingStrategy}>
    {items.map(item => <SidebarSequenceItem key={item.id} item={item} />)}
  </SortableContext>
</DndContext>

// BatchEditor.tsx (inner level)
<DndContext onDragEnd={handleQuestionReorder}>
  <SortableContext items={questionIds} strategy={verticalListSortingStrategy}>
    {questions.map(q => <QuestionRow key={q.id} question={q} />)}
  </SortableContext>
</DndContext>
```

**Source:** [Medium - React dnd-kit tree-list drag and drop](https://medium.com/@wangfupeng1988/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-f54f84b1b605), [dnd-kit docs - Sortable](https://docs.dndkit.com/presets/sortable)

**Key insight:** Nest SortableContext within the same parent DndContext. Each SortableContext manages its own list independently. Cross-level dragging requires custom logic (not needed for this phase).

### Pattern 4: Edit/Preview Toggle via URL Parameter

**What:** Use URL search params (e.g., `/templates/:id/edit?mode=preview`) to control edit vs. preview mode, enabling deep-linking and browser history

**When to use:** Mode toggles where users should be able to bookmark/share the specific mode, or use browser back/forward

**Example:**
```typescript
// EditorToolbar.tsx
import { useSearchParams } from 'react-router';

function EditorToolbar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'edit';

  const toggleMode = () => {
    const newMode = mode === 'edit' ? 'preview' : 'edit';
    setSearchParams({ mode: newMode });
  };

  return (
    <SegmentedControl
      value={mode}
      onChange={toggleMode}
      options={[
        { value: 'edit', label: 'Edit' },
        { value: 'preview', label: 'Preview' },
      ]}
    />
  );
}

// TemplateEditorLayout.tsx
function TemplateEditorLayout() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'edit';

  return (
    <div className="flex">
      {mode === 'edit' && <EditorSidebar />}
      <Outlet context={{ mode }} />
    </div>
  );
}
```

**Alternative:** Use route-based separation (`/templates/:id/edit` vs. `/templates/:id/preview`) if modes are very different experiences

### Anti-Patterns to Avoid

- **Over-using global state:** Don't put inline edit state (isExpanded, input values) in zustand store. Keep it local to the component editing the field. Only global state: selected sidebar item, template data, save status. ([Source](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/))

- **Treating all inputs identically for keyboard:** Standard inputs exit on Enter, but textareas should allow Enter for new lines and only exit on Escape/Tab/blur. ([Source](https://blog.logrocket.com/build-inline-editable-ui-react/))

- **Forgetting auto-focus on inline edit:** When expanding a question row, input should auto-focus. Use `useRef` + `useEffect` to focus on mount. ([Source](https://blog.logrocket.com/build-inline-editable-ui-react/))

- **Missing keyboard shortcuts:** Expandable rows can't be navigated with Tab without custom Tab key monitoring. For MVP, click-to-expand is acceptable; Tab navigation is enhancement. ([Source](https://blog.logrocket.com/build-inline-editable-ui-react/))

- **Deriving state with useEffect:** Calculate derived state (e.g., question count for batch summary) directly in render, not via useEffect. Reduces unnecessary re-renders. ([Source](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/))

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image lightbox | Custom modal with zoom/pan | yet-another-react-lightbox | Handles preloading, responsive images, keyboard navigation, touch gestures, accessibility, browser inconsistencies |
| Drag-and-drop | Custom mouse/touch handlers | @dnd-kit | Already in use; handles pointer sensors, keyboard sensors, collision detection, accessibility, mobile touch, variable item sizes |
| Duration/timer input | Basic text input with manual parsing | Headless duration input pattern | Proper validation, flexible units (h:m:s or free-form), auto-formatting, prevents invalid states |
| Segmented control | Custom button group styling | Pre-built component (Chakra UI, Radix, or custom based on examples) | Keyboard navigation, ARIA roles, focus management, consistent styling |

**Key insight:** The editor involves complex interaction patterns (drag, inline edit, keyboard shortcuts). Using battle-tested libraries prevents edge cases (mobile touch drag failing, keyboard accessibility gaps, focus trap issues).

## Common Pitfalls

### Pitfall 1: State Synchronization Between Edit and Save

**What goes wrong:** User edits question text inline, but changes aren't reflected in sidebar summary until save. Or changes are lost when switching between items.

**Why it happens:** Inline edits update local state, but sidebar reads from global template state. Updates aren't synced until explicit save.

**How to avoid:** Use controlled components backed by zustand template state. Inline edits immediately update the global template state (optimistic updates). Debounce API saves to avoid excessive network calls, but UI updates are instant.

**Warning signs:** Sidebar question count doesn't update when adding questions; batch name in sidebar doesn't match batch name in main area.

### Pitfall 2: Drag-and-Drop with Expanded Questions

**What goes wrong:** Dragging a question while it's expanded can cause UI glitches (drag preview shows expanded state, input loses focus, form values reset).

**Why it happens:** DndContext clones the dragged element, creating duplicate refs. Focus/state is tied to the original element, not the overlay.

**How to avoid:** Collapse all questions before enabling drag. Add drag handle that only appears on collapsed rows. Alternatively, auto-collapse on drag start via `onDragStart` callback.

**Warning signs:** Typing in an expanded question input, then dragging causes input value to disappear; drag overlay shows input instead of collapsed summary.

**Example:**
```typescript
// QuestionRow.tsx
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
} = useSortable({ id: question.id });

// Only show drag handle when collapsed
return (
  <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
    {!isExpanded && (
      <div {...attributes} {...listeners} className="cursor-grab">
        {/* Drag icon */}
      </div>
    )}
    {/* Rest of question row */}
  </div>
);
```

### Pitfall 3: Preview Mode Rendering Different Data Than Live Session

**What goes wrong:** Preview mode shows slides/questions in the editor, but live session view has different styling/layout, causing "looks fine in preview but broken live" bugs.

**Why it happens:** Preview mode duplicates components instead of reusing actual session components.

**How to avoid:** Preview mode should render the same `<BatchVotingCarousel>`, `<SlideDisplay>`, etc. components used in live session. Wrap them in a read-only context to disable voting interactions.

**Warning signs:** Preview shows different fonts, spacing, or image sizes than live session; batch timer doesn't appear in preview but does in session.

**Example:**
```typescript
// PreviewMode.tsx
<SessionContext.Provider value={{ isPreview: true }}>
  {currentItem.type === 'batch' ? (
    <BatchVotingCarousel batch={batch} questions={questions} />
  ) : (
    <SlideDisplay imagePath={currentItem.slide_image_path} caption={currentItem.slide_caption} />
  )}
</SessionContext.Provider>

// BatchVotingCarousel.tsx
const { isPreview } = useContext(SessionContext);
// Disable vote buttons if isPreview
```

### Pitfall 4: Missing Unsaved Changes Warning

**What goes wrong:** User edits template, clicks back arrow, loses all changes without warning.

**Why it happens:** No dirty state tracking or beforeunload listener.

**How to avoid:** Track "dirty" state (has unsaved changes) in zustand store. Show confirmation dialog on navigation attempts if dirty. Add `beforeunload` listener to warn on browser close/refresh.

**Warning signs:** Users complain about losing work; no visual indicator of unsaved changes (e.g., asterisk in title, save button disabled/enabled state).

**Example:**
```typescript
// template-editor-store.ts
interface EditorState {
  isDirty: boolean;
  markDirty: () => void;
  markClean: () => void;
}

// EditorToolbar.tsx
const { isDirty, markClean } = useEditorStore();

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);

const handleSave = async () => {
  await saveTemplate();
  markClean();
};
```

### Pitfall 5: Insert After Selected Item When Nothing Selected

**What goes wrong:** Clicking "Add Batch" in toolbar when no sidebar item is selected causes error or unexpected behavior (adds to wrong position).

**Why it happens:** "Insert after selected" logic assumes something is selected.

**How to avoid:** Define default behavior: if nothing selected, insert at end. Or auto-select first item on mount. Or disable insert buttons when nothing selected.

**Warning signs:** Console errors when clicking insert buttons; new items appear at random positions.

**Example:**
```typescript
// EditorToolbar.tsx
const { selectedItemId, items } = useEditorStore();

const insertBatch = () => {
  const insertIndex = selectedItemId
    ? items.findIndex(item => item.id === selectedItemId) + 1
    : items.length; // Default: end of list

  // Create and insert batch at insertIndex
};
```

## Code Examples

Verified patterns from official sources and current codebase:

### Using Outlet for Nested Routes (React Router 7)

```typescript
// Source: https://reactrouter.com/7.9.5/start/framework/routing
import { Outlet } from 'react-router';

export default function TemplateEditorLayout() {
  return (
    <div className="flex h-screen">
      <EditorSidebar />
      <div className="flex-1">
        <Outlet /> {/* Renders EditorMainArea or PreviewMode */}
      </div>
    </div>
  );
}
```

### Nested DndContext for Multi-Level Drag (from current codebase)

```typescript
// Source: src/components/TemplateEditor.tsx (existing pattern)
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, value }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {/* Drag handle icon */}
      </div>
      <span>{value}</span>
    </div>
  );
}

function SortableList({ items, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => <SortableItem key={item.id} id={item.id} value={item.name} />)}
      </SortableContext>
    </DndContext>
  );
}
```

### Yet Another React Lightbox Basic Usage

```typescript
// Source: https://yet-another-react-lightbox.com/
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

function SlideEditor({ slide }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <img
        src={slide.image_path}
        alt={slide.caption || 'Slide'}
        onClick={() => setLightboxOpen(true)}
        className="cursor-pointer hover:opacity-80"
      />

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={[{ src: slide.image_path }]}
      />
    </>
  );
}
```

### Inline Edit with Auto-Focus and Keyboard Handling

```typescript
// Source: https://blog.logrocket.com/build-inline-editable-ui-react/
import { useState, useRef, useEffect } from 'react';

function InlineEditField({ value, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); // Select all text for easy replacement
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div onClick={() => setIsEditing(true)}>
      {isEditing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="border-2 border-blue-500 px-2 py-1"
        />
      ) : (
        <span className="cursor-pointer hover:bg-gray-100 px-2 py-1">{value}</span>
      )}
    </div>
  );
}
```

### Image Upload with Compression (from current codebase)

```typescript
// Source: src/components/ImageUploader.tsx
import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { uploadSlideImage } from '../lib/slide-api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function handleFileSelect(file: File, sessionId: string) {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  // Compress
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp' as const,
    initialQuality: 0.85,
    preserveExif: false,
  };

  const compressed = await imageCompression(file, options);

  // Upload
  const imagePath = await uploadSlideImage(sessionId, compressed);
  return imagePath;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Hook Form for all forms | Local state for simple inline edits | 2024-2025 | RHF adds bundle size and complexity for simple expand/collapse edits; use local state for inline editing, RHF for complex multi-step forms |
| Modal-based editors | Full-page routes with nested layouts | React Router v6+ (2021) | Modals lose URL state and browser history; full-page routes enable deep-linking, bookmarking, back/forward navigation |
| react-beautiful-dnd | @dnd-kit | 2021-2022 | react-beautiful-dnd unmaintained; @dnd-kit is actively maintained, smaller bundle, better touch support |
| react-image-lightbox | yet-another-react-lightbox | 2023 | react-image-lightbox deprecated; yet-another is modern, responsive images, smaller, plugin-based |
| Context API for all global state | Zustand for shared state | 2023-2024 | Context causes re-renders for all consumers on any change; Zustand selectors prevent unnecessary re-renders |

**Deprecated/outdated:**
- **react-beautiful-dnd**: Unmaintained since 2021. Use @dnd-kit (already in project).
- **react-image-lightbox**: Deprecated in favor of yet-another-react-lightbox.
- **Simple React Lightbox**: Deprecated (mentioned in search results).

## Open Questions

1. **Timer duration input: free-form text vs. structured h:m:s fields?**
   - What we know: User decision says "free-form input" for batch timer duration (AUTH-09). Existing codebase has no duration input component.
   - What's unclear: Does "free-form" mean a single text input accepting formats like "90s", "1m 30s", "1.5m", or just a number input for seconds?
   - Recommendation: Start with simple number input for seconds with helper text ("Duration in seconds"). Can enhance to parse "1m 30s" format later if users request it. Libraries like react-time-duration-input exist but may be overkill.

2. **Edit/preview toggle: route-based or state-based?**
   - What we know: Toggle lives in toolbar. Preview hides sidebar and shows next/prev navigation.
   - What's unclear: Should preview be a URL param (`?mode=preview`), a separate route (`/templates/:id/preview`), or just local state?
   - Recommendation: Use URL search param (`?mode=preview`) to enable deep-linking and browser back/forward, but keep it on the same route to maintain editor context (selected item, unsaved changes).

3. **Sidebar selected item persistence: URL or state?**
   - What we know: Sidebar shows sequence items, main area shows selected item details.
   - What's unclear: Should selected item be in URL (`/templates/:id/edit/:itemId`) or just local state?
   - Recommendation: Use URL path for selected item (`/templates/:id/edit/:itemId`) to enable deep-linking to specific batches/slides. Fallback to first item if no itemId in URL.

4. **Preview mode: render real session components or simplified read-only versions?**
   - What we know: Preview should "feel like stepping through a live session" but Phase 22 scope is "formatted content rendered as it would appear live" (not full simulation).
   - What's unclear: Does this mean reusing `<BatchVotingCarousel>` and `<SlideDisplay>` components from live session, or creating simplified preview-only components?
   - Recommendation: Reuse actual session components wrapped in a "preview context" that disables interactions (voting, timer). This ensures preview matches live session exactly, preventing styling drift.

## Sources

### Primary (HIGH confidence)

- **React Router Official Docs** - [Nested Routes with Outlet](https://reactrouter.com/7.9.5/start/framework/routing) - Verified nested route patterns, layout routes, Outlet component usage
- **@dnd-kit Official Docs** - [Sortable preset](https://docs.dndkit.com/presets/sortable) - Verified sortable patterns, sensor configuration, collision detection
- **Yet Another React Lightbox** - [Official site](https://yet-another-react-lightbox.com/) - Installation, basic usage, plugin architecture
- **Current codebase** - `src/components/TemplateEditor.tsx`, `src/components/SequenceManager.tsx`, `src/components/ImageUploader.tsx` - Existing patterns for drag-and-drop, image upload, sortable lists

### Secondary (MEDIUM confidence)

- [LogRocket - Build inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/) - Inline editing patterns, keyboard handling, auto-focus, common pitfalls (verified against React best practices)
- [Medium - React dnd-kit tree-list drag and drop](https://medium.com/@wangfupeng1988/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-f54f84b1b605) - Nested DndContext pattern (cross-referenced with dnd-kit docs)
- [C-Sharp Corner - State Management in React 2026](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/) - State management best practices, local vs. global state (verified against React community consensus)

### Tertiary (LOW confidence)

- [React Router 7 Nested Routes Tutorial](https://www.robinwieruch.de/react-router-nested-routes/) - Tutorial examples (not official docs, but cross-verified with official patterns)
- [npm - react-time-duration-input](https://www.npmjs.com/package/react-time-duration-input) - Duration input library (not evaluated in depth, flagged for validation if free-form input needs parsing)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already in use except yet-another-react-lightbox (which is well-documented, modern, small bundle)
- Architecture: **HIGH** - React Router 7 nested routes and @dnd-kit patterns are proven and already used in codebase
- Pitfalls: **MEDIUM-HIGH** - Inline editing pitfalls verified via LogRocket article and React best practices; drag-and-drop pitfalls inferred from dnd-kit docs and community patterns
- Preview mode scope: **MEDIUM** - Open question on whether to reuse session components or create preview-only versions; recommendation is to reuse

**Research date:** 2026-02-12
**Valid until:** 30 days (2026-03-14) - Stack is stable (React Router v7, @dnd-kit, zustand), no fast-moving APIs
