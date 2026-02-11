# Technology Stack: v1.3 Presentation Mode

**Project:** QuickVote v1.3
**Researched:** 2026-02-10
**Scope:** Stack additions for image slides, Supabase Storage, and session templates in Supabase

## Existing Stack (Validated, No Changes Needed)

| Technology | Installed Version | Role |
|------------|-------------------|------|
| @supabase/supabase-js | 2.93.2 | Database, Auth, Realtime -- and now Storage |
| React 19 | ^19.0.0 | UI framework |
| Zustand | ^5.0.5 | State management |
| Motion (framer-motion) | ^12.29.2 | Animations (slide transitions) |
| Zod | ^3.24.4 | Schema validation (export/import) |
| Tailwind CSS v4 | ^4.1.18 | Styling |
| nanoid | ^5.1.5 | ID generation (for storage paths) |
| Vitest | ^3.2.4 | Testing |

---

## New Capabilities Required (Zero New Runtime Dependencies for Core Features)

### 1. Supabase Storage (Already Bundled -- No Install)

**No new package needed.** The `@supabase/supabase-js` v2.93.2 already includes the full Storage SDK. The `storage-js` sub-package was merged into the supabase-js monorepo. Access via the existing client:

```typescript
import { supabase } from './lib/supabase'; // existing client, no changes

// Upload
const { data, error } = await supabase.storage
  .from('session-slides')
  .upload(`${sessionId}/${filename}`, file, {
    cacheControl: '31536000',    // 1 year -- slides are immutable once uploaded
    contentType: file.type,
    upsert: false,               // reject duplicates (use unique nanoid filenames)
  });

// Public URL (for public bucket -- no auth needed to view)
const { data: { publicUrl } } = supabase.storage
  .from('session-slides')
  .getPublicUrl(`${sessionId}/${filename}`);

// Delete multiple files
const { error } = await supabase.storage
  .from('session-slides')
  .remove([`${sessionId}/${file1}`, `${sessionId}/${file2}`]);

// List files in a session folder
const { data, error } = await supabase.storage
  .from('session-slides')
  .list(sessionId, {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  });
```

**RLS requirements for Storage operations:**

| Operation | Required permission on `storage.objects` |
|-----------|------------------------------------------|
| Upload | INSERT |
| Upload with upsert | INSERT + SELECT + UPDATE |
| Download/Read | SELECT |
| Delete | SELECT + DELETE |
| List | SELECT |

**Confidence:** HIGH
**Sources:** [Supabase Storage Upload API](https://supabase.com/docs/reference/javascript/storage-from-upload), [storage-js GitHub (deprecated repo, merged into supabase-js)](https://github.com/supabase/storage-js)

---

### 2. Image Upload and Preview in React (Native Browser APIs -- No Install)

**No library needed.** Use native `<input type="file" accept="image/*">` and `URL.createObjectURL()` for preview. This is a well-established pattern requiring zero dependencies.

```typescript
// File selection
<input
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }}
/>

// Preview with URL.createObjectURL
const [previewUrl, setPreviewUrl] = useState<string | null>(null);

function handleFile(file: File) {
  if (previewUrl) URL.revokeObjectURL(previewUrl); // prevent memory leak
  setPreviewUrl(URL.createObjectURL(file));
}

// Cleanup on unmount
useEffect(() => {
  return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
}, [previewUrl]);
```

**Confidence:** HIGH (standard browser API)

---

### 3. Full-Screen Slide Display (CSS + Existing Motion -- No Install)

Full-screen slide display on admin projection screen uses CSS `object-fit: contain` within a viewport-filling container. Motion (already installed) handles enter/exit transitions between slides and batches.

```tsx
<motion.div
  className="fixed inset-0 bg-black flex items-center justify-center"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  <img
    src={publicUrl}
    alt={slide.label ?? ''}
    className="max-w-full max-h-full object-contain"
  />
</motion.div>
```

**Confidence:** HIGH (CSS standard, existing Motion library)

---

## Recommended New Dependency: Client-Side Image Compression

### browser-image-compression v2.0.2

| Property | Value |
|----------|-------|
| Package | `browser-image-compression` |
| Version | 2.0.2 (latest stable) |
| Weekly downloads | ~486K |
| TypeScript | Built-in type definitions (no @types needed) |
| Bundle impact | ~27KB gzipped |
| Web Worker | Yes, non-blocking compression by default |

**Why this is needed:** Images from phones and cameras are typically 3-10MB. The use case specifies 1-5MB inputs with 5-20 images per session. Without compression:
- 20 images at 5MB = 100MB storage per session (blows through 1 GB free limit in 10 sessions)
- Slow uploads on conference/venue Wi-Fi
- Slow page loads when cycling through slides

With compression (targeting 1MB max, 1920px max dimension):
- 20 images at ~300KB-1MB = 6-20MB per session
- 5-10x faster uploads
- Fast display even on constrained networks

**API (promise-based, fits existing async/await patterns):**

```typescript
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,              // Target max 1MB output
  maxWidthOrHeight: 1920,    // Scale down to fit 1920px max dimension
  useWebWorker: true,         // Non-blocking (runs off main thread)
  fileType: 'image/webp',     // Convert to WebP for better compression ratio
  initialQuality: 0.85,       // Start at 85% JPEG/WebP quality
  preserveExif: false,         // Strip metadata (reduce size, prevent privacy leaks)
};

const compressedFile = await imageCompression(imageFile, options);
// compressedFile is a standard File object -- pass directly to supabase.storage.upload()
```

**Full option list:**

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `maxSizeMB` | number | Infinity | Iteratively compress until file < this size |
| `maxWidthOrHeight` | number | undefined | Scale down proportionally |
| `useWebWorker` | boolean | true | Offload to Web Worker thread |
| `fileType` | string | (original) | Output format (e.g., 'image/webp') |
| `initialQuality` | number | 1.0 | Starting quality (0-1) |
| `preserveExif` | boolean | false | Keep EXIF metadata in output |
| `signal` | AbortSignal | undefined | Cancel compression |
| `onProgress` | function | undefined | Progress callback (0-100) |
| `maxIteration` | number | 10 | Max compression iterations |
| `alwaysKeepResolution` | boolean | false | Quality-only compression (no resize) |

**Confidence:** HIGH
**Sources:** [GitHub README](https://github.com/Donaldcwl/browser-image-compression), [npm](https://www.npmjs.com/package/browser-image-compression)

### Alternatives Considered

| Criterion | browser-image-compression | compressorjs | Native Canvas API |
|-----------|---------------------------|--------------|-------------------|
| API style | Promise (async/await) | Callback | Imperative |
| Web Worker | Yes (default) | No | No |
| maxSizeMB (guaranteed output) | Yes (iterative) | No (quality only) | No |
| TypeScript | Built-in | Built-in | N/A |
| Weekly downloads | ~486K | ~213K | N/A |
| Bundle | ~27KB gzip | ~16KB gzip | 0KB |
| WebP conversion | Yes | Limited | Browser-dependent |

**Verdict: Use `browser-image-compression`** because:
1. Promise-based API fits the existing codebase (all Supabase calls are async/await)
2. Web Worker prevents UI jank while compressing 5MB images
3. `maxSizeMB` guarantees output size -- critical for predictable storage budgets
4. WebP conversion support gives best compression ratio

**Source:** [npm-compare: browser-image-compression vs compressorjs](https://npm-compare.com/browser-image-compression,compressorjs)

---

## Supabase Storage Configuration

### Bucket: `session-slides`

| Property | Value | Rationale |
|----------|-------|-----------|
| Name | `session-slides` | Descriptive, matches table naming conventions |
| Type | PUBLIC | Images served via CDN URL; no signed URL refresh needed |
| File size limit | 5 MB | Enforced before client compression catches it |
| Allowed MIME types | image/jpeg, image/png, image/webp, image/gif | Standard web image formats |

**Why PUBLIC bucket:**
- Slides display on admin's projected screen -- needs fast, cacheable URLs
- No sensitive data in presentation slides
- Public URLs have no expiration (no token refresh logic)
- Better CDN cache hit ratio than private buckets
- RLS still enforces who can upload/delete -- only reads bypass auth

**Public URL format:**
```
https://{project_id}.supabase.co/storage/v1/object/public/session-slides/{session_id}/{filename}
```

### Bucket Creation

**Via Supabase Dashboard SQL Editor (primary method per MEMORY.md):**

```sql
-- Create the storage bucket
-- NOTE: SQL INSERT only supports id, name, public columns reliably.
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-slides', 'session-slides', true)
ON CONFLICT (id) DO NOTHING;
```

Then set `file_size_limit` (5MB = 5242880 bytes) and `allowed_mime_types` via the **Dashboard Storage settings UI**. The SQL `storage.buckets` table schema does not reliably expose these columns for direct INSERT.

**Confidence:** MEDIUM for SQL bucket creation (documented but file_size_limit columns poorly documented in SQL); HIGH for Dashboard approach

### Storage RLS Policies

The app uses anonymous auth (`signInAnonymously()`), which grants the `authenticated` Postgres role -- the same role used for all existing RLS policies. Anonymous auth users are NOT the `anon` role.

```sql
-- ============================================
-- Storage RLS for session-slides bucket
-- ============================================

-- Anyone authenticated can view slides (public bucket handles unauthenticated reads)
CREATE POLICY "Anyone can view session slides"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-slides');

-- Session creators can upload slides
-- Folder structure: session-slides/{session_id}/{filename}
-- Verify user owns the session via sessions.created_by
CREATE POLICY "Session creators can upload slides"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'session-slides'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.session_id = (storage.foldername(name))[1]
    AND sessions.created_by = (SELECT auth.uid())
  )
);

-- Session creators can delete their slides
CREATE POLICY "Session creators can delete slides"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'session-slides'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.session_id = (storage.foldername(name))[1]
    AND sessions.created_by = (SELECT auth.uid())
  )
);
```

**Key design:** File paths follow `{session_id}/{nanoid}.{ext}` pattern. `storage.foldername(name)[1]` extracts the session_id from the path, verified against the sessions table. This reuses the existing ownership model without new auth columns.

**Confidence:** HIGH
**Sources:** [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control), [Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions)

### Image Transformations: NOT Available (Free Plan)

Supabase Storage offers server-side image transformations (resize, quality, format) via `transform` option in `getPublicUrl()`. These require **Pro Plan ($25/month)**.

**Decision: Do NOT rely on Supabase image transformations.** Instead:
1. Compress client-side before upload using `browser-image-compression`
2. Serve the pre-compressed image directly from CDN
3. Use CSS `object-fit: contain` for display scaling

The stored image IS the display image. No server-side processing pipeline needed.

**Confidence:** HIGH
**Source:** [Supabase Image Transformations usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations)

### Free Plan Storage Limits

| Limit | Value | Impact on QuickVote |
|-------|-------|---------------------|
| Total storage | 1 GB | ~50-150 sessions (depends on compression) |
| Max file size per upload | 50 MB | Well above our 5 MB bucket limit |
| Storage egress | 2 GB/month | ~200-600 full-session slide loads/month |
| Auto-pause | 7 days inactivity | Not a concern for actively used sessions |

**Concern:** 1 GB total is tight for sustained use. With compression targeting ~500KB per image and ~10 images per session, each session uses ~5 MB, giving ~200 sessions. Recommend building a cleanup mechanism for ended sessions (delete storage files after export or after N days).

**Source:** [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing), [Supabase File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)

---

## Database Schema Additions

### New Tables

```sql
-- ============================================
-- Slides: individual image references
-- ============================================
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,        -- e.g., '{session_id}/{nanoid}.webp'
  public_url TEXT NOT NULL,          -- Full CDN URL for display and export
  label TEXT,                        -- Optional slide caption/title
  original_filename TEXT,            -- Admin UI display (e.g., "team-photo.jpg")
  file_size_bytes INTEGER,           -- Track per-session storage usage
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slides_session_id ON slides(session_id);

-- ============================================
-- Session items: unified sequence of slides + batches
-- ============================================
CREATE TABLE session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('slide', 'batch')),
  slide_id UUID REFERENCES slides(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce exactly one reference per item type
  CONSTRAINT item_type_ref CHECK (
    (item_type = 'slide' AND slide_id IS NOT NULL AND batch_id IS NULL) OR
    (item_type = 'batch' AND batch_id IS NOT NULL AND slide_id IS NULL)
  )
);

CREATE INDEX idx_session_items_session_id ON session_items(session_id);
CREATE INDEX idx_session_items_position ON session_items(session_id, position);

-- ============================================
-- Session templates: replaces localStorage TemplatePanel
-- ============================================
CREATE TABLE session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  template_data JSONB NOT NULL,      -- Full session structure (batches, questions, slides)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, created_by)           -- Unique per user (anon users each get own namespace)
);

CREATE INDEX idx_session_templates_created_by ON session_templates(created_by);
```

**Design notes:**
- `slides.public_url` is denormalized (could be derived from storage_path) but enables fast reads and simple JSON export without URL construction at query time
- `session_items` is a polymorphic ordering table with CHECK constraint enforcing referential integrity
- `session_templates.template_data` uses JSONB for flexible schema -- same approach as existing `response_templates.options`
- CASCADE delete on session_id means cleaning up a session removes all slides, items, and orphaned storage references

### Updated_at Trigger

Per MEMORY.md (moddatetime extension not available):

```sql
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
```

### RLS Policies for New Tables

Follow existing patterns from `response_templates` (migration 010) and `sessions` (migration 001):

```sql
-- Slides RLS
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slides"
  ON slides FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creators can insert slides"
  ON slides FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = slides.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Session creators can delete slides"
  ON slides FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = slides.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

-- Session items RLS (mirrors slides pattern)
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session items"
  ON session_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creators can manage session items"
  ON session_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

-- Session templates RLS (per-user)
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own templates"
  ON session_templates FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can create own templates"
  ON session_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can update own templates"
  ON session_templates FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete own templates"
  ON session_templates FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));
```

### Realtime Publication

```sql
-- Add new tables to realtime for live updates during session
ALTER PUBLICATION supabase_realtime ADD TABLE slides;
ALTER PUBLICATION supabase_realtime ADD TABLE session_items;
-- session_templates do NOT need realtime (admin-only, single-user interaction)
```

---

## What NOT to Add

| Library | Why NOT |
|---------|---------|
| `@supabase/storage-js` | Already bundled in `@supabase/supabase-js` v2.x -- installing separately would duplicate code |
| `react-dropzone` | Overkill for single-file image upload; native `<input type="file">` with accept attribute suffices |
| `react-image-crop` | No cropping requirement -- slides display full-screen as-is |
| `sharp` / `jimp` | Server-side image processing -- not applicable, we compress client-side |
| `blurhash` / `plaiceholder` | Blur-up placeholder images -- unnecessary for admin-only projection (no public gallery) |
| `next/image` / `@vercel/image` | Next.js optimization -- not applicable to Vite + React |
| `lightbox` libraries | Slides display full-screen natively via CSS, no lightbox interaction needed |
| `uppy` / `filepond` | Heavy upload widget libraries -- our upload UX is simple (pick file, compress, upload) |
| `uuid` | Already using `nanoid` for unique ID generation (file naming) |
| `react-beautiful-dnd` | Already using `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop reordering |

---

## Installation Summary

```bash
# Single new production dependency
npm install browser-image-compression@^2.0.2
```

**Total new runtime dependencies:** 1 package (~27KB gzipped)
**Total new dev dependencies:** 0

No changes to existing packages. No version bumps needed.

---

## Integration Points with Existing Code

### Supabase Client (`src/lib/supabase.ts`)
No changes needed. The existing `supabase` client export supports `supabase.storage.from()` calls out of the box.

### Zustand Stores
Two approaches (recommend option A for simplicity):
- **Option A:** Extend `session-store.ts` with `slides: Slide[]` and `sessionItems: SessionItem[]` arrays (keeps all session data in one store)
- **Option B:** Create `slide-store.ts` following existing `template-store.ts` pattern (if the store becomes too large)

### Zod Validation (`src/lib/session-export.ts`, `src/lib/session-import.ts`)
Extend existing export/import schemas to include slides:
```typescript
// In export schema
const SlideExportSchema = z.object({
  public_url: z.string().url(),
  label: z.string().nullable(),
  position: z.number(),
});
```
JSON export includes image URLs (not binary data), keeping exports lightweight.

### Testing (`src/test/mocks/supabase.ts`)
Add `storage` mock alongside existing table mocks:
```typescript
storage: {
  from: vi.fn().mockReturnValue({
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
  }),
}
```
`browser-image-compression` can be mocked as a pass-through: `vi.fn().mockResolvedValue(inputFile)`.

### File Path Convention
```
session-slides/{session_id}/{nanoid(10)}.{ext}
```
- `session_id` as top-level folder enables per-session listing and batch cleanup
- `nanoid(10)` prevents filename collisions and strips PII from original filenames
- Extension matches compressed output (typically `.webp` after conversion)

---

## Session Template Migration (localStorage to Supabase)

### Current State
- `src/lib/question-templates.ts` reads/writes `localStorage` key `quickvote_templates`
- `src/components/TemplatePanel.tsx` manages save/load/delete via localStorage functions
- Templates store: `{ name, questions: QuestionTemplate[], batches: BatchTemplate[], createdAt }`

### Target State
- `session_templates` table in Supabase with per-user ownership
- Same JSONB payload structure (for backwards compatibility during migration)
- `TemplatePanel.tsx` switches from localStorage calls to Supabase API calls
- Optional: one-time migration of existing localStorage templates on first load

### Migration Strategy
1. Add `session_templates` table and RLS policies
2. Create `src/lib/session-template-api.ts` (following `template-api.ts` pattern)
3. Update `TemplatePanel.tsx` to use Supabase API instead of localStorage
4. Add one-time localStorage-to-Supabase migration in `TemplatePanel` or a utility
5. After migration period, remove localStorage code

---

## Sources

- [Supabase Storage Upload API](https://supabase.com/docs/reference/javascript/storage-from-upload)
- [Supabase Storage getPublicUrl](https://supabase.com/docs/reference/javascript/storage-from-getpublicurl)
- [Supabase Storage remove](https://supabase.com/docs/reference/javascript/storage-from-remove)
- [Supabase Storage list](https://supabase.com/docs/reference/javascript/storage-from-list)
- [Supabase Storage Bucket Fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Creating Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions)
- [Supabase Serving Downloads](https://supabase.com/docs/guides/storage/serving/downloads)
- [Supabase Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) (Pro Plan only)
- [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing)
- [Supabase File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [storage-js GitHub (deprecated, merged into supabase-js)](https://github.com/supabase/storage-js)
- [browser-image-compression GitHub](https://github.com/Donaldcwl/browser-image-compression)
- [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression)
- [npm-compare: browser-image-compression vs compressorjs](https://npm-compare.com/browser-image-compression,compressorjs)
- [Supabase Storage tradeoffs: public vs signedURL](https://github.com/orgs/supabase/discussions/6458)
- [Supabase Anonymous Auth and RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
