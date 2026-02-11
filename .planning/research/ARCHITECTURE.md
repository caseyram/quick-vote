# Architecture Patterns

**Domain:** Real-time voting app -- Presentation Mode (v1.3)
**Researched:** 2026-02-10
**Confidence:** HIGH (based on full codebase analysis + Supabase official docs)

---

## Existing Architecture Summary

Before defining the v1.3 integration, here is the current system map:

### Current Database Schema

```
sessions (id, session_id, admin_token, title, status, reasons_enabled, test_mode, timer_expires_at, default_template_id, created_by, created_at)
  |
  +-- batches (id, session_id FK, name, position, status, created_at)
  |     |
  |     +-- questions (batch_id FK nullable -- ON DELETE SET NULL)
  |
  +-- questions (id, session_id FK, text, type, options JSONB, position, anonymous, status, template_id FK nullable, batch_id FK nullable, created_at)
  |     |
  |     +-- votes (id, question_id FK, session_id FK, participant_id, value, reason, display_name, locked_in, created_at, updated_at)
  |
  +-- response_templates (id, name UNIQUE, options JSONB, created_at, updated_at) -- global, not session-scoped
```

### Current Component Tree (admin flow)

```
AdminSession
  |-- BatchList (DndContext for interleaved batches + unbatched questions)
  |     |-- SortableBatchCard -> BatchCard (nested DndContext for intra-batch reorder)
  |     |-- SortableQuestionCard
  |     +-- QuestionForm
  |-- AdminControlBar (fixed bottom bar: status, timer, activate next, quick question, close voting)
  |-- SessionImportExport -> ImportSessionPanel
  |-- ResponseTemplatePanel -> TemplateEditor (response template CRUD)
  |-- TemplatePanel (localStorage question templates -- will be replaced)
  |-- ProgressDashboard (batch voting progress)
  |-- SessionResults (ended session results)
  +-- ActiveQuestionHero (projection-optimized question + chart display)
```

### Current Position/Ordering Model

Batches and unbatched questions share a unified `position` space. The `BatchList` component interleaves them:

```typescript
// From BatchList.tsx
type ListItem =
  | { type: 'batch'; batch: Batch; id: string; position: number }
  | { type: 'question'; question: Question; id: string; position: number };
```

The `handleReorderItems` function in AdminSession updates positions sequentially by parsing `batch-{id}` and `question-{id}` prefixed IDs. This is the exact pattern that `session_items` will formalize at the database level.

### Current Broadcast Events

The realtime channel `session:{sessionId}` multiplexes:
- `session_lobby`, `session_active`, `session_ended` -- session state transitions
- `question_activated`, `voting_closed`, `results_revealed` -- single question flow
- `batch_activated`, `batch_closed` -- batch flow

v1.3 does NOT add new broadcast events. Slides are admin-projection-only state (no participant notification needed). When the admin advances past a slide to a batch, the existing `batch_activated` broadcast fires.

---

## Recommended Architecture for v1.3

### Design Philosophy

The key insight: v1.3 adds a **presentation layer on top of the existing voting layer**. Slides are admin-projection-only; participants see no change. Session templates replace localStorage. The unified sequence formalizes what `BatchList` already does informally.

This means:
1. **session_items** is a database formalization of the existing `interleavedItems` pattern
2. **Slides** are a new item type in the sequence (admin-only display)
3. **Session templates** replace `TemplatePanel` localStorage with Supabase
4. **PresentationController** replaces `AdminControlBar`'s ad-hoc next-item logic with sequence-aware advancing

### Component Boundaries

| Component | Responsibility | Status | Communicates With |
|-----------|---------------|--------|-------------------|
| `AdminSession` | Page-level orchestration, data loading, realtime setup | MODIFY | All children |
| `SequenceManager` | Drag-and-drop reordering of session_items (replaces BatchList's interleaving) | NEW | AdminSession, session_items table |
| `SlideEditor` | Create/edit image slides (upload + caption) | NEW | Supabase Storage, session_items table |
| `ImageUploader` | File picker + upload to Supabase Storage | NEW | Supabase Storage bucket |
| `PresentationController` | Sequence-aware advance/back controls (enhances AdminControlBar) | NEW (integrated into AdminControlBar) | AdminSession, session_items, broadcast channel |
| `SlideDisplay` | Full-screen image display for admin projection | NEW | PresentationController |
| `BatchList` | Batch/question management within a batch | MODIFY (reduced scope) | SequenceManager |
| `BatchCard` | Individual batch display with questions | KEEP | BatchList |
| `AdminControlBar` | Status bar + voting controls | MODIFY (delegate sequence navigation to PresentationController) | AdminSession |
| `SessionTemplatePanel` | Save/load session blueprints from Supabase (replaces TemplatePanel) | NEW (replaces TemplatePanel) | session_templates table |
| `SessionImportExport` | JSON export/import with image URL support | MODIFY | session-export.ts, session-import.ts |
| `ParticipantSession` | Participant experience (NO changes for slides) | MINIMAL CHANGE | Broadcast channel |

---

## Database Schema for New Tables

### session_items -- Unified Sequence Table

```sql
-- ============================================
-- Unified Session Sequence
-- ============================================
-- Replaces the implicit interleaving of batches and unbatched questions.
-- Each row represents one ordered element in the presentation sequence.

CREATE TABLE session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('batch', 'slide')),
  position INTEGER NOT NULL DEFAULT 0,

  -- Polymorphic reference: exactly one of these is non-null
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  -- Slide data (inline, not a separate table -- slides are simple)
  slide_image_path TEXT,        -- Storage path: {session_id}/{uuid}.{ext}
  slide_caption TEXT,           -- Optional caption displayed below image

  -- Constraints
  CONSTRAINT valid_batch_item CHECK (
    item_type != 'batch' OR (batch_id IS NOT NULL AND slide_image_path IS NULL)
  ),
  CONSTRAINT valid_slide_item CHECK (
    item_type != 'slide' OR (batch_id IS NULL AND slide_image_path IS NOT NULL)
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_items_session_id ON session_items(session_id);
CREATE INDEX idx_session_items_position ON session_items(session_id, position);

-- RLS (follows same pattern as batches, questions)
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session_items"
  ON session_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creator can insert session_items"
  ON session_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can update session_items"
  ON session_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can delete session_items"
  ON session_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

-- Realtime publication for live reordering
ALTER PUBLICATION supabase_realtime ADD TABLE session_items;
```

**Design decisions:**

1. **Inline slide data, not a separate slides table.** Slides have only two fields (image path, caption). A separate table would add a join with no benefit. The polymorphic CHECK constraints enforce data integrity.

2. **Batches referenced by FK, unbatched questions NOT in session_items.** Unbatched standalone questions (batch_id IS NULL) continue to work as they do today -- they belong to no batch and appear in the AdminSession question list. Only batches and slides get sequenced. This avoids migrating every existing question into session_items.

   **Rationale:** The current system already handles unbatched questions as standalone items. Forcing them into session_items would break backward compatibility and add complexity. The AdminControlBar's "Activate Next" already handles both batches and unbatched questions.

   **Alternative considered:** Including `item_type = 'question'` for standalone questions. Rejected because it would require migrating all existing sessions and duplicating the position field that already exists on questions.

3. **ON DELETE CASCADE for batch_id.** If a batch is deleted, its session_item entry is automatically removed. This is safe because batch deletion already handles questions (ON DELETE SET NULL on questions.batch_id).

### session_templates -- Supabase Session Templates

```sql
-- ============================================
-- Session Templates (replaces localStorage TemplatePanel)
-- ============================================
-- Stores reusable session blueprints: questions, batches, and slide references.
-- Global scope (like response_templates), not session-scoped.

CREATE TABLE session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Full session blueprint as JSONB (same structure as export JSON)
  blueprint JSONB NOT NULL,
  -- Preview metadata (denormalized for list display)
  question_count INTEGER NOT NULL DEFAULT 0,
  batch_count INTEGER NOT NULL DEFAULT 0,
  slide_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (per MEMORY.md: moddatetime not available)
CREATE OR REPLACE FUNCTION update_session_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_session_templates_updated_at
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE PROCEDURE update_session_templates_updated_at();

-- RLS (global access, same pattern as response_templates)
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session_templates"
  ON session_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create session_templates"
  ON session_templates FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update session_templates"
  ON session_templates FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete session_templates"
  ON session_templates FOR DELETE TO authenticated
  USING (true);
```

**Design decisions:**

1. **JSONB blueprint, not relational.** Session templates are snapshots, not live references. When loaded, the blueprint is materialized into real batches, questions, and session_items. Same principle as the existing JSON export/import. Using JSONB avoids a complex web of template-specific relational tables.

2. **Denormalized counts.** `question_count`, `batch_count`, `slide_count` are computed at save time and stored for fast list rendering. The alternative (parsing JSONB on every list render) is wasteful.

3. **Global scope with created_by tracking.** Matches response_templates pattern (global, not session-scoped). `created_by` is for future "my templates" filtering but all templates are readable by everyone.

4. **Name-based uniqueness.** Consistent with response_templates pattern. Enables name-based dedup on import.

---

## Supabase Storage Configuration

### Bucket: session-images

```
Bucket name: session-images
Public: YES
Allowed MIME types: image/png, image/jpeg, image/webp, image/gif
Max file size: 10MB
```

**Why public bucket:**
- Images are displayed on admin projection screen (no auth context in projected view)
- `getPublicUrl()` returns permanent, cacheable URLs -- no signed URL expiration to manage
- Upload/delete still require authentication (RLS enforced for write operations even on public buckets, per Supabase docs)
- Performance: public buckets use a different caching layer per Supabase docs

**File path convention:**
```
{session_id}/{uuid}.{ext}
```

Example: `abc123/550e8400-e29b-41d4-a716-446655440000.webp`

- Session ID prefix enables easy cleanup when session is deleted
- UUID filename prevents collisions and name conflicts
- Extension preserved for content-type inference

### Storage RLS Policies

Even on a public bucket, write operations need RLS:

```sql
-- Allow authenticated users to upload images to session-images bucket
-- Uses storage.foldername() to extract session_id from path
CREATE POLICY "Session creator can upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-images'
    AND EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = (storage.foldername(name))[1]
      AND sessions.created_by = (select auth.uid())
    )
  );

-- Allow session creator to delete their images
CREATE POLICY "Session creator can delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-images'
    AND EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = (storage.foldername(name))[1]
      AND sessions.created_by = (select auth.uid())
    )
  );
```

### Image Upload Data Flow

```
User selects file
  |
  v
ImageUploader component
  |-- Client-side validation (type, size < 10MB)
  |-- Generate UUID filename: crypto.randomUUID() + extension
  |-- supabase.storage.from('session-images').upload(path, file, { upsert: false })
  |
  v
Supabase Storage (session-images bucket)
  |-- Returns { data: { path } } on success
  |
  v
Get public URL
  |-- supabase.storage.from('session-images').getPublicUrl(path)
  |-- Returns permanent URL: https://{project}.supabase.co/storage/v1/object/public/session-images/{path}
  |
  v
Store in session_items
  |-- INSERT into session_items (session_id, item_type='slide', slide_image_path=path, slide_caption, position)
  |
  v
Admin projection displays image via public URL
```

### Image Display Pattern

```typescript
// Constructing display URL from stored path
function getSlideImageUrl(imagePath: string): string {
  const { data } = supabase.storage
    .from('session-images')
    .getPublicUrl(imagePath);
  return data.publicUrl;
}

// In SlideDisplay component
<img
  src={getSlideImageUrl(slide.slide_image_path)}
  alt={slide.slide_caption ?? 'Slide'}
  className="w-full h-full object-contain bg-white"
/>
```

### Image Cleanup

When a slide is deleted from session_items:
1. Delete the storage object: `supabase.storage.from('session-images').remove([imagePath])`
2. Delete the session_items row

When a session is deleted:
1. session_items CASCADE deletes automatically
2. Storage cleanup needs explicit logic: `supabase.storage.from('session-images').list(sessionId)` then `.remove(paths)`
3. This can be a client-side cleanup call triggered before or after session deletion

**Note on image transformations:** Supabase offers on-the-fly image resizing via `transform` option on `getPublicUrl`, but this requires Pro Plan. For the free tier, client-side resizing before upload is recommended. Consider using canvas-based resize to max 1920px width before upload to keep file sizes manageable for projection.

---

## Integration Points with Existing Components

### AdminSession (MODIFY -- significant)

**Current:** Loads session, questions, batches, votes. Manages realtime channel. Renders different views per session status (draft/lobby/active/ended).

**Changes:**
1. **Load session_items** alongside batches and questions on initial fetch
2. **Add session_items to realtime channel** (Postgres Changes listener for INSERT/UPDATE/DELETE)
3. **Track active sequence index** for presentation mode (new state: `activeItemIndex`)
4. **Pass session_items to SequenceManager** instead of passing raw batches+questions to BatchList for top-level ordering
5. **Render SlideDisplay** when active item is a slide (in the active/projection view)
6. **Replace TemplatePanel** with SessionTemplatePanel

New state additions to AdminSession:
```typescript
const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
```

### BatchList (MODIFY -- reduced scope)

**Current:** Interleaves batches and unbatched questions with DndContext for top-level reordering.

**Changes:**
- **Remove top-level interleaving.** SequenceManager handles the sequence. BatchList only manages questions within a single batch (or shows the standalone questions section).
- **Keep internal question reordering** (the nested DndContext for intra-batch drag-and-drop via BatchCard).
- Props simplification: no more `onReorderItems`, no more interleaved item type union.

### AdminControlBar (MODIFY)

**Current:** Fixed bottom bar with timer selection, quick question, activate next (batch or question), close voting, session transitions.

**Changes:**
- **Replace "Activate Next" with sequence-aware navigation.** The `nextItem` logic that currently builds from pending questions + batches is replaced by `sessionItems[activeItemIndex + 1]`.
- **Add Previous/Next arrows** for sequence navigation during presentation.
- **Show current item indicator** (e.g., "Slide 2 of 8" or "Batch: Customer Feedback").
- **Handle slide items:** When next item is a slide, display it (local state only, no broadcast). When next item is a batch, activate it (existing `batch_activated` broadcast).

### SessionImportExport (MODIFY)

**Current:** Exports/imports JSON with batches, questions, votes, templates.

**Changes:**
- **Export session_items ordering** (sequence structure)
- **Export slide references** as image URLs (not base64 per project requirements)
- **Import creates session_items** from sequence data
- **Import does NOT download images** from URLs (images may be unavailable; URLs are informational)

Export schema addition:
```typescript
// New optional field in SessionExportSchema
sequence: z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('batch'), batch_name: z.string(), position: z.number() }),
  z.object({ type: z.literal('slide'), image_url: z.string(), caption: z.string().nullable(), position: z.number() }),
])).optional()
```

### ParticipantSession (MINIMAL CHANGE)

**Current:** Responds to broadcast events (question_activated, batch_activated, etc.), shows voting UI.

**Changes:**
- **No changes needed for slides.** Slides are admin-projection only. Participants never see them.
- **No new broadcast events needed.** When admin advances past a slide to a batch, the existing `batch_activated` broadcast fires. When admin advances to a standalone question, the existing `question_activated` broadcast fires.
- The only change: participants may see slightly longer "waiting" periods between votes while the admin shows slides. This is already handled by the existing `waiting` view state.

### Zustand session-store (MODIFY)

**Current:** Manages session, questions, batches, voting state, realtime state.

**Additions:**
```typescript
// New state
sessionItems: SessionItem[];
activeItemIndex: number; // -1 = not presenting

// New actions
setSessionItems: (items: SessionItem[]) => void;
addSessionItem: (item: SessionItem) => void;
updateSessionItem: (id: string, updates: Partial<SessionItem>) => void;
removeSessionItem: (id: string) => void;
reorderSessionItems: (orderedIds: string[]) => void;
setActiveItemIndex: (index: number) => void;
```

### TypeScript Types (MODIFY database.ts)

```typescript
export type SessionItemType = 'batch' | 'slide';

export interface SessionItem {
  id: string;
  session_id: string;
  item_type: SessionItemType;
  position: number;
  batch_id: string | null;
  slide_image_path: string | null;
  slide_caption: string | null;
  created_at: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string | null;
  blueprint: SessionBlueprint;
  question_count: number;
  batch_count: number;
  slide_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionBlueprint {
  batches: Array<{
    name: string;
    position: number;
    questions: Array<{
      text: string;
      type: VoteType;
      options: string[] | null;
      anonymous: boolean;
      template_id: string | null; // template name, not UUID
    }>;
  }>;
  sequence: Array<
    | { type: 'batch'; batch_name: string; position: number }
    | { type: 'slide'; image_path: string; caption: string | null; position: number }
  >;
  templates?: Array<{ name: string; options: string[] }>;
}
```

---

## New Components Detail

### SequenceManager

**Purpose:** Visual drag-and-drop ordering of session items (batches and slides).

```
SequenceManager (replaces BatchList's top-level interleaving)
  |-- DndContext (top-level sequence reordering)
  |     |-- SortableSequenceItem (batch type) -> BatchCard collapsed view
  |     |-- SortableSequenceItem (slide type) -> SlideCard thumbnail + caption
  |     +-- DragOverlay
  |-- "Add Slide" button -> opens SlideEditor modal
  |-- "Add Batch" button -> creates batch + session_item
  +-- Standalone questions section (below sequence, for unbatched questions)
```

**Key behavior:**
- Replaces the top-level interleaving in BatchList
- When a batch session_item is expanded, it shows its BatchCard with question management
- When a slide is clicked, it opens SlideEditor for editing
- Drag-and-drop reorders `session_items.position` in database
- Standalone (unbatched) questions appear below the sequence in a separate "Standalone Questions" section

### SlideEditor

**Purpose:** Modal for creating/editing a slide.

```
SlideEditor (modal)
  |-- ImageUploader (file picker + preview)
  |-- Caption input (text field, optional)
  |-- Save / Delete buttons
```

**Follows existing modal pattern:** Uses the same mousedown+mouseup overlay close pattern as TemplateEditor (per MEMORY.md). Checks for unsaved changes before closing.

### ImageUploader

**Purpose:** Reusable file upload component for Supabase Storage.

```typescript
interface ImageUploaderProps {
  sessionId: string;
  currentImagePath?: string | null;
  onUploaded: (path: string) => void;
  onRemoved?: () => void;
}
```

**Behavior:**
1. File input accepts `image/png, image/jpeg, image/webp, image/gif`
2. Client-side validation: type check, size < 10MB
3. Optional client-side resize to max 1920px width (canvas-based, keeps aspect ratio)
4. Upload to `{sessionId}/{crypto.randomUUID()}.{ext}`
5. Show upload progress (loading state)
6. Display thumbnail preview after upload
7. Allow removal (deletes from storage, calls onRemoved)

### SlideDisplay

**Purpose:** Full-screen image display during presentation mode (active session view).

```typescript
interface SlideDisplayProps {
  imagePath: string;
  caption: string | null;
}
```

**Renders in the same viewport area as ActiveQuestionHero** -- they are mutually exclusive:
- When active item is a batch with an active question: show ActiveQuestionHero
- When active item is a batch (waiting/closed): show batch summary (existing behavior)
- When active item is a slide: show SlideDisplay
- Uses admin light theme (bg-white), full viewport height minus header and control bar

### SessionTemplatePanel

**Purpose:** Replaces TemplatePanel (localStorage) with Supabase-backed session templates.

```
SessionTemplatePanel
  |-- "Save Current Session as Template" (name input + save button)
  |-- Template list (name, counts, date)
  |     |-- Load button -> materializes blueprint into session
  |     |-- Delete button -> with confirmation
  +-- Empty state
```

**Follows existing patterns:**
- Same Zustand store pattern as template-store (new session-template-store)
- Same API module pattern as template-api (new session-template-api)
- Same UI layout as TemplatePanel (bg-white card in draft view)

---

## Presentation Mode Data Flow

### Admin Advancing Through Sequence

```
Admin clicks "Next" in AdminControlBar
  |
  v
Check sessionItems[activeItemIndex + 1]
  |
  +-- type === 'slide'
  |     |-- setActiveItemIndex(index + 1) -- local state only
  |     |-- SlideDisplay renders image from Supabase Storage public URL
  |     |-- NO broadcast to participants (admin-only)
  |     +-- Participants stay in current view (waiting, voting, etc.)
  |
  +-- type === 'batch'
        |-- setActiveItemIndex(index + 1) -- local state
        |-- handleActivateBatch(batch_id, timerDuration) -- existing logic
        |-- Broadcast: batch_activated -> participants enter BatchVotingCarousel
        +-- Admin sees ProgressDashboard (existing behavior)
```

### Participant Experience (unchanged)

```
Participant is on "waiting" screen
  |
  v
Receives batch_activated broadcast (same as today)
  |-- Fetches batch questions
  |-- Renders BatchVotingCarousel
  |-- Submits votes
  |-- Returns to waiting
  |
  v
(Admin may show slides between batches -- participant sees nothing, stays on "waiting")
  |
  v
Receives next batch_activated broadcast
  ... (repeat)
```

---

## Backward Compatibility

### Sessions Without session_items

Existing sessions created before v1.3 will have no session_items rows. The UI must handle this gracefully:

1. **Draft view:** If no session_items exist, show the current BatchList experience unchanged (batches and standalone questions interleaved by position, as today)
2. **Active view:** If no session_items exist, use the current AdminControlBar "Activate Next" logic (unchanged)
3. **Migration on demand:** When an admin first opens the SequenceManager on an existing session, auto-generate session_items from existing batches

```typescript
// Auto-migration: create session_items from existing batches
async function ensureSessionItems(sessionId: string, batches: Batch[]): Promise<SessionItem[]> {
  const { data: existing } = await supabase
    .from('session_items')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1);

  if (existing && existing.length > 0) {
    return fetchSessionItems(sessionId);
  }

  // Create session_items from batches (sorted by position)
  const items = batches
    .sort((a, b) => a.position - b.position)
    .map((batch, index) => ({
      session_id: sessionId,
      item_type: 'batch' as const,
      position: index,
      batch_id: batch.id,
    }));

  if (items.length > 0) {
    await supabase.from('session_items').insert(items);
  }

  return fetchSessionItems(sessionId);
}
```

### Export/Import Compatibility

New export format includes optional `sequence` field. Old exports without `sequence` are handled by backward-compatible import logic (same approach as the optional `templates` field added in v1.2).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Broadcasting Slides to Participants
**What:** Sending slide data to participant devices
**Why bad:** Wastes bandwidth, confuses participant UI, slides are admin-projection-only
**Instead:** Slides are purely local state on the admin. Participants remain in "waiting" view during slides.

### Anti-Pattern 2: Storing Images as Base64 in Database
**What:** Encoding images as base64 strings in the session_items table
**Why bad:** Bloats database, slow queries, breaks Supabase row size limits
**Instead:** Store file path in session_items, actual file in Supabase Storage bucket.

### Anti-Pattern 3: Separate Slides Table
**What:** Creating a dedicated `slides` table with its own RLS policies
**Why bad:** Over-normalized for 2 fields (image_path, caption). Adds a join to every sequence query.
**Instead:** Inline slide data in session_items with CHECK constraints for type safety.

### Anti-Pattern 4: Migrating Existing Questions into session_items
**What:** Adding `item_type = 'question'` to session_items for standalone questions
**Why bad:** Requires migrating all existing sessions, duplicates position logic, breaks backward compatibility
**Instead:** Standalone questions remain as-is. Only batches and slides are sequenced in session_items. The admin UI shows standalone questions in a separate section below the sequence.

### Anti-Pattern 5: Storing Full Image URLs in Database
**What:** Storing the complete Supabase Storage URL instead of the relative path
**Why bad:** URL structure may change (project migration, CDN changes). Path is the stable identifier.
**Instead:** Store only the relative path (`{session_id}/{uuid}.ext`). Construct URL at display time using `getPublicUrl()`.

### Anti-Pattern 6: Making session_templates Relational
**What:** Normalizing session templates into separate tables (template_batches, template_questions, template_slides)
**Why bad:** Enormous complexity for a snapshot feature. Templates are frozen-in-time blueprints.
**Instead:** JSONB blueprint field. Same pattern as the existing JSON export/import. Materialized into real rows on load.

---

## Patterns to Follow

### Pattern 1: Consistent RLS Policies
**What:** All new tables follow the same RLS pattern as batches and questions -- session creator check via subquery on sessions table.
**Where:** See session_items and session_templates RLS policies above. The `EXISTS (SELECT 1 FROM sessions WHERE ...)` pattern is used consistently.

### Pattern 2: Realtime Publication
**What:** New tables that need live updates are added to `supabase_realtime` publication.
**Applied to:** `session_items` (for sequence reordering during draft). NOT `session_templates` (no need for real-time template list updates -- loaded on demand).

### Pattern 3: Inline PL/pgSQL Triggers for updated_at
**What:** Use `CREATE OR REPLACE FUNCTION` + `CREATE TRIGGER` for auto-updating `updated_at` timestamps.
**Why:** moddatetime extension not available (per MEMORY.md).
**Applied to:** `session_templates` (has updated_at). Not needed for `session_items` (no updated_at -- position changes are full row updates).

### Pattern 4: Zustand Store + API Module Separation
**What:** State in Zustand store, async operations in separate `lib/` API module.
**Existing example from v1.2:**
- `stores/template-store.ts` -- state + synchronous actions
- `lib/template-api.ts` -- async CRUD functions that update store
**Applied to:** New `stores/session-template-store.ts` + `lib/session-template-api.ts`

### Pattern 5: Position-Based Ordering with DnD-Kit
**What:** Items have `position` integer column, DndContext handles reordering, positions updated in database.
**Existing example from v1.1:** BatchList `handleDragEnd` -> `onReorderItems` -> sequential position updates in AdminSession.
**Applied to:** SequenceManager for session_items reordering.

### Pattern 6: Modal Overlay with mousedown+mouseup Close
**What:** Modal close requires both mousedown AND mouseup on overlay to prevent text selection drift from closing the modal.
**Existing example:** TemplateEditor.tsx (per MEMORY.md).
**Applied to:** SlideEditor modal. Always check for unsaved changes before closing (confirm dialog).

---

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Database Foundation + Storage
**What:** Schema migration, Storage bucket, TypeScript types
**Dependencies:** None
**Rationale:** Everything else depends on the schema and storage being available
- Migration: session_items table (with CHECK constraints, RLS, indexes, realtime publication)
- Migration: session_templates table (with trigger, RLS)
- Supabase Storage bucket: session-images (created via Dashboard, set public, configure MIME types)
- Storage RLS policies (INSERT + DELETE for session creator)
- TypeScript types: SessionItem, SessionTemplate, SessionBlueprint in database.ts

### Phase 2: Image Upload + Slide CRUD
**What:** ImageUploader, SlideEditor, basic slide management
**Dependencies:** Phase 1 (storage bucket, session_items table)
**Rationale:** Slides are the core new content type. Must work before sequencing.
- ImageUploader component (upload, preview, remove, client-side resize)
- SlideEditor modal (create slide -> upload image + caption, edit, delete)
- Image cleanup on slide deletion (remove from storage + delete session_items row)
- Wire into AdminSession draft view (temporary: add slides below existing BatchList)

### Phase 3: Unified Sequence Management
**What:** SequenceManager replaces BatchList's top-level interleaving
**Dependencies:** Phase 2 (slides exist as items), Phase 1 (session_items table)
**Rationale:** The sequence UI brings slides and batches together
- SequenceManager component with DndContext for session_items
- session_items CRUD API (add batch item, add slide item, reorder, delete)
- BatchList scope reduction (remove top-level interleaving, keep intra-batch reorder)
- Auto-migration for existing sessions (ensureSessionItems)
- session-store additions (sessionItems state + actions)
- Standalone questions section (below sequence)

### Phase 4: Presentation Controller
**What:** Sequence-aware advancing during active session
**Dependencies:** Phase 3 (sequence exists and is ordered)
**Rationale:** This is the "play" mode for the sequence built in Phase 3
- AdminControlBar enhancement with sequence navigation (prev/next through items)
- SlideDisplay component for active view (full-screen image in projection area)
- Advance/back logic: slide = local state only, batch = existing broadcast
- Active item tracking (activeItemIndex in session-store)
- Backward compatibility: sessions without session_items use existing behavior

### Phase 5: Session Templates in Supabase
**What:** Replace localStorage TemplatePanel with Supabase session_templates
**Dependencies:** Phase 3 (sequences and slides can be included in templates)
**Rationale:** Templates snapshot the whole session including the sequence
- session-template-store.ts (Zustand store)
- session-template-api.ts (CRUD operations against session_templates table)
- SessionTemplatePanel component (save/load/delete)
- Save current session as template: serialize questions, batches, sequence, slide image paths into blueprint JSONB
- Load template into session: materialize blueprint into real rows (batches, questions, session_items)
- Handle image references in templates (store paths; images must already exist in storage)
- Remove old TemplatePanel component and question-templates.ts localStorage code

### Phase 6: Export/Import + Polish
**What:** Update JSON export to include sequence and image URLs
**Dependencies:** All previous phases
**Rationale:** Export must capture the complete state; polish is last
- Export schema update (add optional `sequence` field with image public URLs)
- Import schema update (backward compatible -- sequence field optional)
- Image URL handling in export (convert storage paths to public URLs, not base64)
- Session deletion cleanup: remove storage objects when session is deleted
- Edge cases testing across all flows
- Remove any remaining dead code from old patterns

---

## Scalability Considerations

| Concern | Current (50-100 users) | At 1,000 users | Notes |
|---------|------------------------|-----------------|-------|
| Image storage | Public bucket, direct URL | Same | Supabase CDN handles caching |
| Sequence size | 10-20 items typical | Same | No scalability concern |
| Template JSONB size | < 100KB typical | Same | Single session blueprint |
| Realtime session_items | Postgres Changes | Same | Low frequency updates (reorder only during draft) |
| Image upload concurrency | 1 admin at a time | Same | Single admin per session |

No scalability concerns for v1.3. The main performance consideration is image file size -- recommend client-side resize to 1920px max width before upload.

---

## Sources

- [Supabase Storage Buckets Documentation](https://supabase.com/docs/guides/storage/buckets/fundamentals) -- public vs private buckets, access control
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- RLS for storage.objects
- [Supabase JS SDK Storage Upload Reference](https://supabase.com/docs/reference/javascript/storage-from-upload) -- upload API, options, permissions
- [Supabase JS SDK createSignedUrl Reference](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) -- signed URLs vs public URLs
- [Supabase Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) -- resize/optimize (Pro Plan only)
- Existing codebase analysis: AdminSession.tsx, BatchList.tsx, AdminControlBar.tsx, ParticipantSession.tsx, session-store.ts, template-store.ts, template-api.ts, session-export.ts, session-import.ts, TemplatePanel.tsx, question-templates.ts, all 11 migration files, database.ts, App.tsx, use-realtime-channel.ts

---

*Researched: 2026-02-10*
*Valid for: QuickVote v1.3 Presentation Mode milestone*
