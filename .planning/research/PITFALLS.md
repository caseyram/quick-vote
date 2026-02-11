# Pitfalls: Presentation Mode, Image Storage, and Session Templates for QuickVote v1.3

**Domain:** Adding image uploads/storage, unified session sequencing, and template persistence to an existing real-time voting app
**Stack:** Vite + React 19 (TypeScript), Supabase (PostgreSQL + Realtime + Storage), Zustand, dnd-kit
**Researched:** 2026-02-10
**Overall confidence:** MEDIUM-HIGH (Supabase Storage pitfalls verified with official docs; sequencing pitfalls informed by codebase analysis; template migration pitfalls informed by existing localStorage code)

---

## Context

QuickVote v1.2 has a working real-time voting system with batches, drag-and-drop reordering, response templates (in Supabase), and session templates (in localStorage). v1.3 adds:

1. **Image slides** -- Upload images to Supabase Storage for full-screen admin projection between voting batches
2. **Unified session sequence** -- A single ordered list mixing slides and batches, drag-and-drop reorder
3. **Manual advance** -- Admin controls presentation flow through slides and batches
4. **Session templates in Supabase** -- Upgrade `TemplatePanel` from localStorage to database, save/load full session blueprints including slides and images
5. **JSON export with image URLs** -- Export includes image URLs (not binary); results data excludes images

This document covers pitfalls specific to ADDING these features to the existing system.

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamental feature failure.

---

### Pitfall 1: Orphaned Images Accumulate in Supabase Storage With No Cleanup Path

**Severity:** CRITICAL

**What goes wrong:** Admin uploads images for a session, then deletes images from slides, deletes entire slides, or deletes the session itself. The images remain in Supabase Storage because the application only deleted the database row (from `session_items` or wherever the image reference lives), not the Storage object. Over time, orphaned images consume storage quota and incur billing.

**Why it happens:** Supabase Storage objects exist independently from database rows. Deleting a row from `storage.objects` via SQL does NOT delete the actual file from S3 -- you must use the Storage API (`supabase.storage.from('bucket').remove([path])`). This is explicitly called out in [Supabase's discussions](https://github.com/orgs/supabase/discussions/34254): deleting via SQL leaves orphaned S3 objects that continue consuming storage and billing.

The existing codebase uses `ON DELETE CASCADE` for questions and batches (see `20250101_001_schema.sql`), so deleting a session cascades to its children. But no equivalent cascade exists for Storage objects -- there is no built-in mechanism to automatically delete Storage files when a database row is removed.

**Consequences:**
- Storage quota consumed by files no one can see
- Billing increases over time with no visible benefit
- No way to identify which files are orphaned without cross-referencing database
- Admin confusion when storage dashboard shows more usage than expected

**Warning signs (how to detect early):**
- Supabase Storage dashboard shows growing file count that does not match active session image count
- After deleting sessions, storage usage does not decrease
- Storage listing shows files in paths for sessions that no longer exist

**Prevention:**
1. **Delete Storage objects BEFORE or alongside database rows:** When deleting a slide, call `supabase.storage.from('slides').remove([imagePath])` before or in the same operation as deleting the database row. If the Storage delete fails, either retry or log for manual cleanup -- do not silently proceed.
2. **Session-scoped storage paths:** Store images at paths like `{session_id}/{uuid}.{ext}`. When an entire session is deleted, list all objects under `{session_id}/` and batch-delete them. This makes cleanup a single `list()` + `remove()` operation.
3. **Application-level cascade on session delete:** The existing session delete flow (in `AdminList.tsx` or wherever sessions are deleted) must be extended to include a Storage cleanup step. Consider a helper function: `deleteSessionWithImages(sessionId)`.
4. **Never use SQL DELETE on `storage.objects`:** Always route through the Storage API. This is a hard rule from Supabase's architecture.
5. **Periodic cleanup job (defense in depth):** A scheduled function or manual admin action that lists all Storage paths, cross-references with the database, and removes orphans. Not essential for v1.3 launch but valuable for long-term hygiene.

**Phase to address:** Image upload phase (the very first phase that introduces Storage). Must be designed into the upload/delete flow from day one, not retrofitted.

**Confidence:** HIGH -- verified with [Supabase Storage deletion docs](https://supabase.com/docs/guides/storage/management/delete-objects) and [orphaned files discussion](https://github.com/orgs/supabase/discussions/34254).

---

### Pitfall 2: Storage RLS Policies Block Uploads With Cryptic Errors

**Severity:** CRITICAL

**What goes wrong:** Admin attempts to upload an image and gets a generic error (often a 403 or "new row violates row-level security policy"). The upload form appears to work but the image never appears. Developers spend hours debugging client code when the issue is a missing or misconfigured RLS policy on `storage.objects`.

**Why it happens:** Supabase Storage enforces RLS on the `storage.objects` table. By default, Storage does not allow any uploads without explicit RLS policies. The existing codebase uses anonymous auth (`supabase.auth.signInAnonymously()` implied by the anon key pattern in `supabase.ts`), so the uploading user is "authenticated" but anonymous. RLS policies must grant INSERT permission to `authenticated` role on the correct bucket.

The existing RLS patterns in the codebase (see `20250101_001_schema.sql`) grant broad access to `authenticated` users. But Storage RLS is a separate concern -- policies on `sessions`, `questions`, etc. do NOT apply to `storage.objects`. You need dedicated Storage policies.

Additionally, the Supabase SQL Editor runs as the `postgres` role, bypassing RLS entirely. So testing uploads from the SQL Editor or dashboard may succeed while client uploads fail.

**Consequences:**
- Upload feature appears broken in production but works in development (if using service role key)
- Error messages are unhelpful ("RLS policy violation" with no detail about which policy)
- Time wasted debugging client code when the fix is a single SQL policy

**Warning signs:**
- Uploads work in Supabase dashboard but fail from the app
- 403 errors or "row-level security" errors in browser console during upload
- Upload succeeds with service role key but fails with anon key

**Prevention:**
1. **Create explicit Storage RLS policies in the migration:** Do not rely on manual dashboard configuration. Include policies in the same migration that creates the bucket:
   ```sql
   -- Allow authenticated users to upload to slides bucket
   CREATE POLICY "Authenticated users can upload slides"
     ON storage.objects FOR INSERT TO authenticated
     WITH CHECK (bucket_id = 'slides');

   -- Allow anyone to read public slides
   CREATE POLICY "Public read access for slides"
     ON storage.objects FOR SELECT TO authenticated
     USING (bucket_id = 'slides');

   -- Allow authenticated users to delete their uploads
   CREATE POLICY "Authenticated users can delete slides"
     ON storage.objects FOR DELETE TO authenticated
     USING (bucket_id = 'slides');
   ```
2. **Test with the anon key, not service role:** Always test uploads from the client SDK using the same auth flow the app uses. Never test with the service role key or SQL Editor for RLS validation.
3. **Use a public bucket for slides** (since images are displayed on projection and in exports): This avoids signed URL complexity. Public buckets still enforce RLS for uploads/deletes but allow unauthenticated reads.
4. **Remember: bucket-level settings AND RLS both apply.** Even with permissive RLS, the bucket configuration itself can block operations. Verify both.
5. **Note from MEMORY.md:** Migrations must be applied manually via Supabase Dashboard SQL Editor because `supabase db push` fails on this instance. Ensure the Storage policy migration is tested in the same manual workflow.

**Phase to address:** Image upload phase. RLS policies must be the first thing configured before any client-side upload code is written.

**Confidence:** HIGH -- verified with [Supabase Storage Access Control docs](https://supabase.com/docs/guides/storage/security/access-control) and [multiple community reports](https://github.com/orgs/supabase/discussions/38700).

---

### Pitfall 3: Unified Sequence Table Creates Position Conflicts With Existing Batch/Question Positions

**Severity:** CRITICAL

**What goes wrong:** v1.3 introduces a `session_items` table (or similar) to unify slides and batches into a single ordered sequence. But the existing system already uses `position` columns on both `batches` and `questions` tables for ordering. If the new unified position system conflicts with or duplicates the existing position semantics, drag-and-drop reorder breaks, items appear in wrong order, or the BatchList component (which relies on `batch.position` and `question.position` interleaving) renders incorrectly.

**Why it happens:** The existing `BatchList.tsx` component (line 289-316) builds an interleaved list by combining `batches` (with their `position` values) and unbatched `questions` (with their `position` values) and sorting by position. The `reorderQuestions` function in `session-store.ts` (line 77-85) and the `onReorderItems` callback in `BatchList` both assume positions are integers in a shared space.

Introducing a new `session_items` table with its own `position` column creates ambiguity: Does `batch.position` still matter? Do you write to both? What happens when a drag-and-drop in the unified sequence needs to update positions in `session_items` AND `batches`?

**Consequences:**
- Batches appear in different order in the new sequence view vs the existing BatchList
- Drag-and-drop reorder updates one position column but not the other
- Import/export uses batch position values that no longer correspond to display order
- Existing tests (BatchList.test.tsx, AdminSession.test.tsx) fail because position semantics changed

**Warning signs:**
- Items appear in different order after adding unified sequencing
- Reordering in the sequence view does not persist after page refresh
- Existing batch reorder tests fail
- Import creates batches with positions that conflict with session_items positions

**Prevention:**
1. **session_items as the single source of truth for ordering:** The `session_items` table should be the authoritative position source for display order. The `position` column on `batches` should be derived from or replaced by `session_items.position`. Do NOT maintain two independent position systems.
2. **Migration strategy for existing data:** When adding `session_items`, backfill it from existing `batches` (and unbatched questions if they remain). This is a data migration, not just a schema migration.
3. **Update BatchList to read from session_items:** The interleaving logic in `BatchList.tsx` (line 289-316) currently builds its list from `batches` and `questions`. This must be updated to read from the unified sequence. Consider whether `BatchList` should be replaced entirely by a new `SequenceList` component.
4. **Deprecate or derive batch.position:** Either remove `batch.position` (breaking change) or make it a derived value that is kept in sync. The latter is more complex and error-prone -- prefer the former.
5. **Keep question.position scoped to within-batch ordering:** Questions within a batch still need relative ordering, but the batch's position in the overall session sequence should come from `session_items`. This is a clear separation: `session_items.position` = global sequence, `question.position` = within-batch order.

**Phase to address:** Schema design phase, before any UI work on the unified sequence. This is an architectural decision that affects every downstream component.

**Confidence:** HIGH -- based on direct codebase analysis of `BatchList.tsx`, `session-store.ts`, and the existing migration schemas.

---

### Pitfall 4: CDN Cache Serves Stale or Deleted Images After Updates

**Severity:** CRITICAL

**What goes wrong:** Admin uploads an image to a slide, previews it (works), then replaces it with a different image at the same path. The old image continues to display for up to 60 seconds (or longer, depending on browser cache). Worse: admin deletes a slide image, but the public URL still serves the old image from CDN cache. On the projection screen during a live presentation, the wrong image appears.

**Why it happens:** All Supabase Storage assets are served through a CDN. When a file is updated or deleted, the CDN cache takes up to 60 seconds to propagate globally. Additionally, browsers cache images aggressively based on URL. If you upload to the same path (e.g., `session123/slide1.jpg`), both CDN and browser may serve the stale version.

This is explicitly documented: [Supabase warns against overwriting files](https://supabase.com/docs/guides/storage/uploads/standard-uploads) because the CDN takes time to propagate changes. The [Smart CDN discussion](https://github.com/orgs/supabase/discussions/5737) confirms this is a known pain point.

**Consequences:**
- During a live presentation, replaced images show the old version
- Deleted images still appear on projection for up to a minute
- Admin sees correct image on upload but stale image when revisiting the page
- Difficult to debug because behavior is intermittent (depends on CDN propagation timing)

**Warning signs:**
- Image appears correct immediately after upload but wrong after page refresh
- Deleted images still load from their public URL
- Different users see different versions of the same image
- Admin reports "wrong image showing" during presentation

**Prevention:**
1. **Use unique file paths for every upload -- never reuse paths:** Generate a unique filename per upload: `{session_id}/{uuid}.{ext}`. When replacing an image, upload to a NEW path and delete the old one. This ensures the CDN URL is always fresh.
2. **Cache-busting query parameter as fallback:** When displaying images, append a timestamp or version: `imageUrl + '?t=' + updatedAt`. This forces browsers to bypass their cache even if the CDN path is the same.
3. **Set short browser cache duration on uploads:** Use the `cacheControl` option when uploading: `{ cacheControl: '300' }` (5 minutes) rather than the default (which can be much longer). This limits how long browsers hold stale versions.
4. **Preload images before projection:** When admin advances to a slide, preload the image with a cache-bust parameter. Show a brief loading state rather than risking a stale image on the projection screen.
5. **Design the UI to show upload timestamp:** Display when the image was last uploaded so admin can verify they are seeing the latest version.

**Phase to address:** Image upload phase. The filename strategy (unique paths vs reusable paths) must be decided before building the upload UI.

**Confidence:** HIGH -- verified with [Supabase CDN docs](https://supabase.com/docs/guides/storage/cdn/fundamentals) and [Smart CDN docs](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

---

## Moderate Pitfalls

Mistakes that cause significant delays, poor UX, or technical debt.

---

### Pitfall 5: File Upload Accepts Anything -- No Client-Side or Server-Side Validation

**Severity:** MODERATE

**What goes wrong:** Admin selects a non-image file (PDF, .exe, HTML with embedded scripts), an oversized image (20MB raw camera photo), or a corrupt file. The upload either fails with a cryptic error, succeeds but displays as a broken image on projection, or in the worst case, stores potentially malicious content.

**Why it happens:** Supabase Storage's MIME type validation checks the filename extension, NOT the actual file contents. A file named `malware.jpg` with non-image content would pass Supabase's check. The existing codebase's import validation (in `session-import.ts`) is thorough (Zod schemas, size limits, extension checks), but there is no image upload code yet -- this validation must be built from scratch.

**Consequences:**
- Broken images on projection during a live session (no fallback)
- Large files consume storage quota unnecessarily
- Upload latency surprises (5MB over slow connection = long wait with no progress)
- Potential for stored XSS if SVG files are allowed and served inline

**Warning signs:**
- Admin reports "image doesn't show" after upload
- Upload takes unexpectedly long (large file, no progress indicator)
- Storage usage spikes (oversized files accumulating)
- Supabase reports 413 errors for files exceeding limits

**Prevention:**
1. **Client-side validation before upload:**
   - **File type:** Accept only `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Use `<input accept="image/jpeg,image/png,image/webp,image/gif">` AND validate `file.type` in JavaScript (the `accept` attribute is merely a hint, not enforcement).
   - **File size:** Reject files over 5MB with a clear message: "Image must be under 5MB. Your file is 12.3MB." The 5MB limit keeps uploads within Supabase's standard upload sweet spot (under 6MB, no resumable upload needed).
   - **Actual content check:** Load the file into an `Image()` element and verify it renders. If `onload` fires, it is a valid image. If `onerror` fires, reject it. This catches renamed non-image files.
2. **Bucket-level restrictions:** Configure the Supabase bucket with `allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']` and `fileSizeLimit: 5242880` (5MB). This provides server-side enforcement even if client validation is bypassed.
3. **Explicitly exclude SVG:** SVG files can contain embedded JavaScript. Do not include `image/svg+xml` in allowed types.
4. **Upload progress indicator:** Show upload progress for files over 1MB. Use the `onUploadProgress` callback or a resumable upload with TUS for larger files.
5. **Fallback for projection:** If an image fails to load on the projection screen, show a branded placeholder (session title, slide number) rather than a broken image icon.

**Phase to address:** Image upload phase. Validation must be implemented alongside the upload UI.

**Confidence:** HIGH -- verified with [Supabase MIME type issue](https://github.com/supabase/storage/issues/639) confirming filename-only validation.

---

### Pitfall 6: Session Template Migration Loses Existing localStorage Data

**Severity:** MODERATE

**What goes wrong:** v1.3 upgrades `TemplatePanel` from localStorage to Supabase database. Existing users who have saved session templates in localStorage find them gone after the upgrade. The old templates are not migrated to the database, and the localStorage key (`quickvote_templates`) is either ignored or cleared.

**Why it happens:** The existing `question-templates.ts` reads/writes to `localStorage.getItem('quickvote_templates')`. A database migration creates a new `session_templates` table in Supabase. But no code bridges the two -- the old localStorage data just sits there unread while the new UI reads from an empty database table.

The existing code (lines 99-120 of `question-templates.ts`) already has backwards compatibility handling (adding missing `batches` arrays, default positions), showing that the data format has evolved. A migration to database needs the same level of care.

**Consequences:**
- Users lose session templates they may have been accumulating since v1.0
- No error or warning -- templates simply do not appear in the new UI
- Users may not realize templates are gone until they need one
- If localStorage is cleared later (browser cleanup), the data is permanently lost

**Warning signs:**
- After deploying v1.3, template list is empty despite user having saved templates
- User reports "my templates disappeared"
- localStorage still contains `quickvote_templates` key but the app ignores it

**Prevention:**
1. **One-time migration on first load:** When the new template system initializes, check if `localStorage.getItem('quickvote_templates')` exists. If it does, parse the templates and upsert them into the database. Mark migration as complete with a flag: `localStorage.setItem('quickvote_templates_migrated', 'true')`.
2. **Preserve localStorage as backup during transition:** Do not delete the localStorage data during migration. Only clear it after confirming the database write succeeded AND the user has had time to verify. Consider keeping it for one release cycle.
3. **Handle migration failures gracefully:** If the database write fails (network issue, RLS problem), fall back to showing localStorage templates with a banner: "Templates will sync to cloud when connection is restored."
4. **Data format transformation:** The localStorage format (`SavedTemplate` with `batchIndex` references) differs from what the database schema will likely use (foreign keys to batches). The migration must transform between formats, not just copy raw JSON.
5. **Idempotent migration:** The migration function must be safe to run multiple times (e.g., user refreshes during migration). Use upsert semantics (name-based dedup, similar to the existing `upsertTemplates` pattern in `session-import.ts` lines 223-289).

**Phase to address:** Session template phase. The migration must be implemented at the same time as the new database-backed template system, not as an afterthought.

**Confidence:** HIGH -- based on direct analysis of `question-templates.ts` localStorage code.

---

### Pitfall 7: Drag-and-Drop With Mixed Item Types (Slides + Batches) Breaks DnD Context

**Severity:** MODERATE

**What goes wrong:** The unified sequence view mixes two types of draggable items: image slides and voting batches. When the user drags a slide over a batch (or vice versa), the drop target calculation is wrong, items jump to unexpected positions, or the drag overlay shows the wrong content. Worse: the existing nested DnD context pattern (BatchList has its own DndContext for within-batch question reordering) conflicts with the new top-level sequence DndContext.

**Why it happens:** The current `BatchList.tsx` already deals with complex DnD: it uses a top-level `DndContext` with `SortableContext` for reordering batches and unbatched questions, plus each expanded `BatchCard` has its own nested `DndContext` for reordering questions within the batch (line 452-482 shows expanded batches are rendered outside the sortable context to avoid conflicts). Adding image slides as a new item type into this existing system multiplies the complexity.

Specifically:
- The existing code uses `useId()` to generate unique DnD context IDs (line 275) to prevent conflicts between nested contexts
- Items are prefixed to avoid ID collisions: `batch-{id}`, `question-{id}`, `batch-item-{id}` (line 347-349)
- The `handleDragStart` and `handleDragEnd` functions filter by ID prefix to ignore events from nested contexts

Adding `slide-{id}` items to this system requires updating all of these patterns.

**Consequences:**
- Dragging a slide into a batch position (or vice versa) causes a crash or wrong reorder
- Nested DnD contexts fire conflicting events
- Drag overlay shows batch content when dragging a slide
- Items sometimes "snap" to wrong positions after drop

**Warning signs:**
- Drag operations feel "jerky" or items teleport
- Console errors from dnd-kit about conflicting contexts
- Items reorder correctly when dropping on same-type items but incorrectly on different-type items
- Expanded batch reorder breaks after adding slides to the sequence

**Prevention:**
1. **Extend the existing ID prefix pattern:** Add `slide-{id}` as a new prefix. Update `handleDragStart` and `handleDragEnd` to handle all three types. Update the `ListItem` type union (currently `batch` | `question`, add `slide`).
2. **Validate drop targets by type:** A slide should be droppable between any items in the sequence, but not INTO a batch (which would make no sense). Use dnd-kit's collision detection or `onDragOver` to constrain valid drop zones.
3. **Test the nested context interaction explicitly:** Add slides to a sequence that has expanded batches (with active inner DnD), and verify that dragging a slide does not trigger the inner batch's DnD handler. The existing `batch-item-` prefix filtering (line 347-349) provides the pattern -- extend it.
4. **Consider flattening to a single DndContext:** If the complexity of nested contexts becomes unmanageable, consider moving to a single DndContext with droppable zones. This is a larger refactor but eliminates context interaction bugs entirely.
5. **DragOverlay for each type:** The existing `DragOverlay` (line 548-562) renders different content for batch vs question. Add a slide case that shows a thumbnail.

**Phase to address:** Unified sequence UI phase. Must be prototyped early because DnD complexity is the highest-risk UI work in v1.3.

**Confidence:** HIGH -- based on direct analysis of `BatchList.tsx` DnD implementation.

---

### Pitfall 8: Export/Import With Image URLs Breaks Across Supabase Instances

**Severity:** MODERATE

**What goes wrong:** Admin exports a session that includes slides with image URLs pointing to `https://abcproject.supabase.co/storage/v1/object/public/slides/session123/img.jpg`. A colleague imports this JSON on a different Supabase project (or the same project after the bucket is recreated). The image URLs return 404 because the images do not exist on the target instance's Storage.

The existing export system already handles this kind of portability for templates (using name-based dedup instead of UUIDs -- see `session-export.ts` line 157). But images are fundamentally different from templates: templates are small data that can be embedded in JSON, while images are large binary assets that can only be referenced by URL.

**Consequences:**
- Imported sessions have broken slide images
- No error during import (URLs are just strings, validation passes)
- Admin discovers broken images only when presenting
- No mechanism to re-upload images for imported sessions

**Warning signs:**
- Imported session shows slide placeholders or broken images
- Image URLs in exported JSON point to a specific Supabase project URL
- No image files exist in the target instance's Storage

**Prevention:**
1. **Document the limitation explicitly:** Image URLs in exports are references, not embedded content. Exports are portable for questions/batches/templates but NOT for images. Make this clear in the export UI: "Note: Image slides reference URLs on this server. Images will need to be re-uploaded after importing on a different instance."
2. **Graceful fallback for missing images:** When a slide's image URL returns an error (404, network failure), show a placeholder with the slide's title/label and a "Re-upload image" button. Never show a broken image icon on the projection screen.
3. **Consider optional base64 embedding for small exports:** For sessions with few, small images (under 1MB total), offer an "Include images" checkbox on export that base64-encodes images into the JSON. This trades file size for portability. For larger image sets, this is impractical.
4. **Image URL validation on import:** When importing a session with image URLs, attempt to fetch each URL (HEAD request). If any fail, warn: "3 of 5 slide images could not be loaded. You may need to re-upload them."
5. **Relative paths in export, absolute on render:** Store image references as relative paths (`{session_id}/{filename}`) in the export, not full URLs. On render, construct the full URL from the current Supabase project URL. This makes exports instance-agnostic IF the same images are uploaded to the target.

**Phase to address:** Export/import update phase. Must be designed alongside the export schema changes that add slide support.

**Confidence:** MEDIUM -- the tradeoff between portability and practicality is a design decision, not a clear-cut bug to prevent. But broken images during a live presentation is a severe UX failure.

---

### Pitfall 9: Image Upload Size Causes Timeout on Slow Connections

**Severity:** MODERATE

**What goes wrong:** Admin is at a venue with limited wifi (common for conference/meeting presentations). They try to upload a 4MB image and the upload times out or takes 30+ seconds with no progress feedback. The UI appears frozen. Admin clicks "upload" again, creating a duplicate. Or they give up and present without slides.

**Why it happens:** Supabase's standard upload is a single HTTP request. For a 4MB file on a 1Mbps connection, that is 32+ seconds. The existing codebase has no upload progress indicators (there are no file uploads in v1.2). The standard `supabase.storage.upload()` does not provide progress callbacks -- only TUS resumable uploads support progress tracking.

**Consequences:**
- Uploads fail silently on slow connections
- No progress feedback creates anxiety and duplicate upload attempts
- Admin may not prepare slides in advance if upload is unreliable
- Venue wifi limitations are common and unpredictable

**Warning signs:**
- Upload button stays in "uploading" state for extended periods
- Network tab shows large pending request
- Admin clicks upload multiple times (duplicate images)
- Upload succeeds locally but fails at venue

**Prevention:**
1. **Client-side image compression before upload:** Use a library like `browser-image-compression` to resize images to projection resolution (1920x1080 max) and compress to JPEG quality 85. A 4MB camera photo becomes 200-400KB. This single optimization eliminates most upload speed issues.
2. **Progress indicator for uploads:** Even without TUS, show an indeterminate progress bar during upload. If the upload takes more than 3 seconds, show elapsed time.
3. **Disable upload button during upload:** Prevent duplicate submissions with a loading state.
4. **Encourage pre-session preparation:** The UI should encourage uploading images before going to the venue. Consider a "Session Preparation" checklist or a clear "offline-ready" indicator once all images are uploaded.
5. **Retry with exponential backoff:** If upload fails, offer automatic retry (up to 3 times) before showing an error. Many transient network failures resolve on retry.
6. **Consider TUS resumable upload for files over 2MB:** Supabase supports TUS protocol for resumable uploads. If a large upload is interrupted, it can resume from where it stopped. This is more complex but eliminates the "start over" problem.

**Phase to address:** Image upload phase. Compression should be implemented in the upload flow from the start.

**Confidence:** MEDIUM-HIGH -- upload latency on venue wifi is a real-world constraint for presentation software, though compression largely mitigates it.

---

### Pitfall 10: Supabase Storage MIME Type Validation Only Checks Filename, Not Content

**Severity:** MODERATE

**What goes wrong:** Supabase's bucket `allowedMimeTypes` configuration and its upload MIME handling rely on the filename extension, not actual file content inspection. A file named `presentation.jpg` that is actually a ZIP file or HTML document would pass Supabase's server-side check. While the bucket restriction helps, it is not a security boundary.

**Why it happens:** This is a known behavior documented in [Supabase Storage issue #639](https://github.com/supabase/storage/issues/639). The MIME type is derived from the filename, not from magic bytes or content inspection.

**Consequences:**
- Non-image files could be stored if client-side validation is bypassed
- SVG files (if allowed) could contain malicious scripts served from your domain
- False sense of security from bucket-level restrictions

**Prevention:**
1. **Client-side content validation:** As described in Pitfall 5, load files into `new Image()` to verify they are actually renderable images before uploading.
2. **Do not rely solely on bucket `allowedMimeTypes`:** Treat it as defense-in-depth, not primary validation.
3. **Exclude SVG from allowed types:** SVG can contain `<script>` tags and is a known XSS vector when served from the same origin.
4. **Set Content-Disposition headers:** For public buckets, ensure files are served with `Content-Disposition: inline` only for verified image types. This is less critical for display-only slides but good practice.

**Phase to address:** Image upload phase, alongside other file validation.

**Confidence:** HIGH -- verified with [Supabase Storage MIME type issue](https://github.com/supabase/storage/issues/639).

---

## Minor Pitfalls

Mistakes that cause annoyance or minor rework but are fixable.

---

### Pitfall 11: Image Aspect Ratios Cause Layout Shifts on Projection Screen

**Severity:** MINOR

**What goes wrong:** Admin uploads images with varying aspect ratios (portrait phone photos, ultra-wide screenshots, square social media images). The projection screen layout shifts or crops images unexpectedly. Some images appear stretched, others have large black bars. During a presentation, this looks unprofessional.

**Prevention:**
1. **Fixed container with `object-contain`:** Display images in a fixed 16:9 container using `object-fit: contain`. Images maintain their aspect ratio with letterboxing. Choose a projection-friendly background color (dark gray or match admin theme).
2. **Upload preview showing projection appearance:** When uploading, show a preview of how the image will look on the projection screen (at 16:9 aspect ratio). This lets admin crop or replace before the session.
3. **Consider Supabase Image Transformations:** Supabase offers server-side image resizing (Pro plan). Resizing to fit projection dimensions reduces bandwidth and ensures consistent display. However, this is a paid feature -- verify plan compatibility.
4. **Recommend dimensions in upload UI:** Display a hint: "Best results with 1920x1080 or 16:9 images."

**Phase to address:** Image display/projection phase.

**Confidence:** HIGH -- aspect ratio handling is a standard image display concern.

---

### Pitfall 12: Session Template Includes Stale Image URLs That Point to Deleted Files

**Severity:** MINOR

**What goes wrong:** Admin creates a session with slides, saves it as a session template, then deletes the original session (which deletes the images per Pitfall 1's cleanup). Later, they load the template to create a new session -- but the slide image URLs in the template point to files that no longer exist.

**Prevention:**
1. **Copy images when saving session template:** When saving a session as a template, copy the referenced images to a `templates/` Storage path that is not tied to any session. This ensures template images survive session deletion.
2. **Alternatively, validate on template load:** When loading a session template, check if referenced images exist (HEAD requests). For any missing images, show "Image not found -- upload a replacement."
3. **Template image lifecycle:** Template images should have their own lifecycle, independent of session images. Delete template images only when the template itself is deleted.

**Phase to address:** Session template phase, specifically when integrating slides into templates.

**Confidence:** MEDIUM -- depends on whether session templates should be fully self-contained or reference external assets.

---

### Pitfall 13: Position Gaps Accumulate After Many Reorder Operations

**Severity:** MINOR

**What goes wrong:** After many drag-and-drop reorder operations in the unified sequence, position values become sparse (e.g., 0, 5, 12, 47, 103) or develop large gaps. While this does not affect correctness (the ORDER BY still works), it makes debugging harder, position-dependent logic fragile, and could theoretically overflow integer limits after extreme use.

**Why it happens:** The existing reorder logic in `session-store.ts` (line 77-85) reassigns positions as sequential integers (0, 1, 2...) on each reorder. But if the database is the source of truth and multiple reorder operations create gaps (e.g., from deletion without re-compacting), positions drift.

**Prevention:**
1. **Compact positions on reorder:** When saving a reorder, assign positions as sequential integers (0, 1, 2...) rather than inserting between existing values. The existing `reorderQuestions` pattern does this correctly -- extend it to `session_items`.
2. **Consider fractional indexing for single-item moves:** For frequent single-item drag operations, [fractional indexing](https://yasoob.me/posts/how-to-efficiently-reorder-or-rerank-items-in-database/) allows moving one item without updating all others. For a session with 5-20 items and infrequent reorder, this is overkill -- sequential integers with full rewrite are fine.
3. **Periodic compaction:** If using fractional indexing, add a compaction step that renumbers all positions to clean integers. Run this on session load or after N reorder operations.

**Phase to address:** Unified sequence phase. For v1.3's scale (5-20 items per session), sequential integer rewrite on every reorder is the simplest and most correct approach.

**Confidence:** HIGH -- the existing codebase already uses the sequential rewrite pattern, so extending it is low-risk.

---

### Pitfall 14: TemplatePanel localStorage Code Left Behind After Migration

**Severity:** MINOR

**What goes wrong:** After migrating session templates to Supabase, the old localStorage-based `TemplatePanel.tsx` and `question-templates.ts` code remains in the codebase. It is not actively used but is still imported in `AdminSession.tsx` (line 20). Future developers encounter two template systems and do not know which is canonical.

**Prevention:**
1. **Remove old code after migration is verified:** Once the database-backed template system is confirmed working and localStorage migration is complete, delete `question-templates.ts` and the old `TemplatePanel.tsx` (not to be confused with `ResponseTemplatePanel.tsx`, which is the v1.2 response template system -- a different concern).
2. **Remove the import in AdminSession.tsx:** Line 20 imports `TemplatePanel`. Replace with the new database-backed component.
3. **Clean up localStorage key:** After confirming migration, add code to remove the `quickvote_templates` key from localStorage to prevent confusion.
4. **Do not leave dead imports:** The existing codebase is clean about this (no unused imports visible), so maintain that standard.

**Phase to address:** Session template phase, as a cleanup step after migration.

**Confidence:** HIGH -- straightforward code hygiene.

---

### Pitfall 15: Realtime Subscription Overhead From Adding session_items to Publication

**Severity:** MINOR

**What goes wrong:** If `session_items` is added to `supabase_realtime` publication (as `response_templates` was in `20250209_010_response_templates.sql` line 66), every reorder operation broadcasts position changes to all connected clients. For a session with 20 items, a single drag-and-drop generates 20 UPDATE events on the realtime channel. This creates unnecessary traffic and potential UI flicker.

**Prevention:**
1. **Do NOT add session_items to realtime publication:** Sequence ordering changes are admin-only and do not affect participants. Participants see the current active slide/batch, not the full sequence. There is no need for realtime position sync.
2. **Use Broadcast for the advance event:** When the admin advances to the next slide/batch, broadcast the current item ID via the existing Broadcast channel (already used for `setActiveQuestionId`, `setActiveBatchId`). This is a single targeted message, not 20 row-change events.
3. **Admin-only sequence state:** The sequence order is only relevant in the admin view. Store it in Zustand on the admin client, refreshing from database on load. No realtime subscription needed.

**Phase to address:** Schema design phase, when deciding what tables need realtime publication.

**Confidence:** HIGH -- the existing architecture already uses Broadcast for admin-to-participant state sync (not Postgres Changes for everything).

---

## Integration-Specific Pitfalls

Pitfalls that specifically arise from the interaction between new v1.3 features and the existing v1.2 system.

---

### Pitfall 16: Single Multiplexed Channel Becomes Overloaded With Slide Navigation Events

**Severity:** MODERATE

**What goes wrong:** The existing system uses a single Supabase Realtime channel per session (from `use-realtime-channel.ts`) that multiplexes Broadcast, Presence, and Postgres Changes. Adding slide navigation events (advance to next slide, go back, current slide state) to this channel increases message volume. With 50-100 participants each receiving every advance event, plus presence updates, plus vote change events, the channel approaches Supabase's per-channel message limits.

**Prevention:**
1. **Slide advance is a single Broadcast message:** Advancing to the next item should be a single Broadcast event (e.g., `{ type: 'advance', itemId: '...', itemType: 'slide' | 'batch' }`). This is lightweight and already within the established pattern.
2. **Do NOT broadcast image data:** Only broadcast the slide/item ID. Participants do not need the image (it is admin-projection only). The only participant-visible effect of a slide is "waiting for host" (unchanged from current behavior between batches).
3. **Monitor channel message volume:** If adding significant new event types, test with 50+ simulated participants to verify the channel handles the load. The existing system handles batch activation this way -- slide advance should be comparable.

**Phase to address:** Slide navigation/advance phase.

**Confidence:** MEDIUM -- the single-channel architecture has worked for v1.0-v1.2, and slide advance events are low-volume. Risk is low unless the implementation accidentally broadcasts to all clients on every admin preview action (not just advance).

---

### Pitfall 17: Export Schema Breaking Change -- v1.2 Exports Cannot Be Imported After v1.3 Changes

**Severity:** MODERATE

**What goes wrong:** v1.3 modifies the export schema to include slides and session sequence information. If the import logic is not backwards-compatible, v1.2 exports (which have no `slides` or `session_items` fields) fail to import. Conversely, v1.3 exports imported into a v1.2 instance lose slide information silently.

The existing import code (`session-import.ts`) already handles backwards compatibility: the `templates` field is `z.array(TemplateImportSchema).optional()` (line 36), allowing old exports without templates to import. The same pattern must be followed for slides.

**Prevention:**
1. **Make new fields optional in the import schema:** `slides: z.array(SlideImportSchema).optional()` and `sequence: z.array(SequenceItemSchema).optional()`. This allows v1.2 exports to import without slides.
2. **Reconstruct sequence from batches if missing:** If importing a v1.2 export (no `sequence` field), construct the sequence from batches in their position order. This maintains the existing behavior.
3. **Include schema version in exports:** Add `"version": 2` (or `"format_version": 2`) to v1.3 exports. This allows future import code to detect and handle different schema versions. The current export has no version field -- this is a good time to add it.
4. **Add round-trip tests:** Automated tests that export from v1.3, import into v1.3, and also import a v1.2 export fixture into v1.3. Verify fidelity in both directions.

**Phase to address:** Export/import update phase.

**Confidence:** HIGH -- the existing codebase already demonstrates the correct pattern (optional fields with Zod). Extending it is straightforward but must be intentional.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfalls | Mitigation |
|-------------|----------------|------------|
| Schema design (session_items, Storage bucket) | Pitfall 3 (position conflicts), Pitfall 15 (realtime overhead) | session_items as single position authority; do not add to realtime publication |
| Image upload & Storage setup | Pitfalls 1 (orphaned images), 2 (RLS blocks uploads), 4 (CDN cache), 5 (no validation), 9 (upload timeout), 10 (MIME bypass) | Unique file paths, explicit RLS policies, client-side compression and validation, session-scoped paths for cleanup |
| Unified sequence UI | Pitfalls 3 (position conflicts), 7 (DnD with mixed types), 13 (position gaps) | Single position authority, extend existing DnD ID prefix pattern, sequential integer compaction |
| Session templates (localStorage to DB) | Pitfalls 6 (migration data loss), 12 (stale image URLs in templates), 14 (dead code) | One-time migration with fallback, copy images on template save, clean up old code |
| Export/import with images | Pitfalls 8 (cross-instance URLs), 17 (schema breaking change) | Graceful fallback for missing images, optional fields in import schema, schema version |
| Slide navigation/projection | Pitfalls 4 (stale cached images), 11 (aspect ratios), 16 (channel overhead) | Unique paths, cache-bust params, object-contain display, lightweight Broadcast events |

---

## Checklist for v1.3 Development

Before starting each phase, verify:

- [ ] Supabase Storage bucket created with `allowedMimeTypes` and `fileSizeLimit` set
- [ ] RLS policies on `storage.objects` for the slides bucket tested with anon key
- [ ] Image upload uses unique file paths (`{session_id}/{uuid}.{ext}`)
- [ ] Image deletion uses Storage API (not SQL), invoked on slide delete and session delete
- [ ] `session_items` table is the single source of truth for sequence order (not `batch.position`)
- [ ] Existing `BatchList` DnD patterns extended (not replaced) for mixed item types
- [ ] Client-side image validation: type, size, and content check before upload
- [ ] Client-side image compression before upload (max 1920x1080, JPEG quality 85)
- [ ] localStorage session templates migrated to database on first load
- [ ] Old `question-templates.ts` code removed after migration verified
- [ ] Export schema uses optional fields for slides (backwards compatible with v1.2)
- [ ] Image URLs in exports validated on import (HEAD request check)
- [ ] Cache-busting strategy for projection screen images
- [ ] Slide advance uses Broadcast (not Postgres Changes)
- [ ] `session_items` NOT added to realtime publication
- [ ] Round-trip export/import test includes v1.2 fixture

---

## Sources

- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- RLS policies on storage.objects
- [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) -- public vs private, configuration
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) -- file size limits, upsert behavior, CDN warning
- [Supabase CDN Fundamentals](https://supabase.com/docs/guides/storage/cdn/fundamentals) -- caching behavior
- [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn) -- cache invalidation timing
- [Supabase Storage Delete Objects](https://supabase.com/docs/guides/storage/management/delete-objects) -- proper deletion via API
- [Orphaned Storage Objects Discussion](https://github.com/orgs/supabase/discussions/34254) -- SQL delete does not remove S3 files
- [Storage CDN Cache Busting Discussion](https://github.com/orgs/supabase/discussions/5737) -- reused paths serve stale content
- [MIME Type Validation Issue](https://github.com/supabase/storage/issues/639) -- filename-only check, not content inspection
- [RLS Error on Storage INSERT Discussion](https://github.com/orgs/supabase/discussions/38700) -- anon role policy issues
- [Supabase Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) -- server-side resize (Pro plan)
- [Efficient Database Reordering](https://yasoob.me/posts/how-to-efficiently-reorder-or-rerank-items-in-database/) -- fractional indexing, LexoRank, gap buffer approaches
- [Basedash: Re-Ordering at Database Level](https://www.basedash.com/blog/implementing-re-ordering-at-the-database-level-our-experience) -- drag-and-drop position pitfalls
- QuickVote v1.2 codebase analysis: `BatchList.tsx`, `session-store.ts`, `question-templates.ts`, `session-export.ts`, `session-import.ts`, `use-realtime-channel.ts`, `supabase.ts`, migration files

---

**Note:** Confidence levels reflect synthesis of official Supabase documentation, community discussions, and direct codebase analysis. Pitfalls related to existing patterns (DnD, export/import, position ordering) have HIGH confidence from code review. Supabase Storage pitfalls have HIGH confidence from official docs. Cross-instance portability (Pitfall 8) is MEDIUM because the design tradeoff is contextual.
