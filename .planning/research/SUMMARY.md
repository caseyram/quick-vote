# Project Research Summary

**Project:** QuickVote v1.3 - Presentation Mode
**Domain:** Real-time voting with image slides, unified session sequencing, Supabase Storage
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

QuickVote v1.3 adds a **presentation layer** on top of the existing voting system: image slides projected by the admin between voting batches, a unified drag-and-drop sequence mixing slides and batches, and session templates persisted in Supabase (replacing localStorage). The existing stack handles nearly everything -- the only new runtime dependency is `browser-image-compression` (~27KB gzipped) for client-side image resize before upload. Supabase Storage is already bundled in the existing `@supabase/supabase-js` SDK. The architecture formalizes what the codebase already does informally: `session_items` is a database-level version of `BatchList`'s in-memory interleaved item list, and slides are inlined directly into that table (two extra columns, no separate join table needed).

The recommended approach is to build in six phases following strict dependency order: database schema and Storage bucket first, then image upload mechanics, then the unified sequence UI (replacing BatchList's top-level interleaving), then the presentation controller for live advancing, then session templates in Supabase, and finally export/import extension with polish. This order prevents rework because each phase produces artifacts consumed by the next. Slides cannot exist without Storage; the sequence cannot display slides without the upload pipeline; presentation mode cannot advance without the sequence; and templates cannot serialize sessions without slides and sequences being complete.

The top risks are **orphaned Storage files** (Supabase has no cascade delete from database rows to Storage objects -- every delete path must explicitly call the Storage API), **Storage RLS blocking uploads with cryptic 403 errors** (policies on `storage.objects` are separate from table RLS and must be configured explicitly), and **position conflicts** between the new `session_items.position` and the existing `batch.position` / `question.position` columns (the unified sequence table must be the single source of truth for display order). A secondary risk is CDN cache serving stale images after replacement -- mitigated by using unique file paths per upload and never reusing Storage paths. All critical pitfalls have concrete prevention strategies that must be built into the first phase, not retrofitted.

## Key Findings

### Recommended Stack

Zero new runtime dependencies beyond the existing stack for core functionality. One recommended addition for image optimization.

**Core technologies (existing, no changes):**
- **@supabase/supabase-js 2.93.2**: Database, Auth, Realtime, and now Storage -- the Storage SDK is already bundled, no separate install needed
- **Motion (framer-motion) v12**: Slide transition animations between sequence items (AnimatePresence for enter/exit)
- **@dnd-kit/core + @dnd-kit/sortable**: Sequence drag-and-drop reordering, extending existing BatchList patterns
- **Zod**: Export/import schema validation extended with optional slide and sequence fields
- **Zustand**: Session store extended with `sessionItems[]` and `activeItemIndex` state

**New dependency (one package):**
- **browser-image-compression 2.0.2** (~27KB gzipped): Client-side image compression via Web Worker. Promise-based API fits existing async/await patterns. Compresses 3-10MB camera photos to 300KB-1MB targeting 1920px max dimension. Critical for staying within Supabase free tier (1GB storage) and for fast uploads on venue Wi-Fi.

**Explicitly rejected:** react-dropzone (overkill), sharp/jimp (server-side), react-image-crop (no cropping needed), uppy/filepond (heavy upload widgets), blurhash (no public gallery), any lightbox library (CSS handles full-screen display).

See [STACK.md](./STACK.md) for full rationale, API examples, and Supabase Storage configuration details.

### Expected Features

**Must have (table stakes):**
- Unified ordered sequence of slides + batches (every competitor uses single-deck mental model)
- Image upload to Supabase Storage with public URLs
- Full-screen image display on admin projection screen
- Drag-and-drop sequence reordering (extending existing dnd-kit patterns)
- Admin manual advance with keyboard navigation (arrow keys, on-screen buttons)
- Participant waiting state during slide display ("Waiting for next question...")
- Session templates saved in Supabase (save/load full session blueprints with slides)
- JSON export extension including slide image URLs and sequence order (backward-compatible)

**Should have (differentiators):**
- Fullscreen API toggle (one-click browser fullscreen for projection)
- Slide transition animations (fade/slide between items using Motion)
- Slide preview thumbnails in sequence management
- Extended keyboard shortcuts (Space, Escape, B for black screen)
- QR code overlay on content slides for latecomers

**Defer (v2+):**
- PowerPoint/Google Slides import (massive scope, tangential to core value)
- Video slides (playback complexity, autoplay policies)
- Rich text or heading slide types (scope creep -- image-only is sufficient)
- Participant-visible slides (doubles rendering surface, complicates phone UX)
- Auto-advance / timed slides (contradicts admin-controlled flow)
- Image editing/annotation (out of scope, use external tools)

See [FEATURES.md](./FEATURES.md) for competitor analysis matrix and complexity estimates.

### Architecture Approach

v1.3 adds a presentation layer on top of the existing voting layer. The key architectural decision is **inlining slide data into `session_items`** rather than creating a separate slides table -- slides have only two fields (image path, caption), so a separate table would add a join with no benefit. `session_items` formalizes the interleaving pattern already implemented in `BatchList.tsx` at the database level. Participants see no change -- slides are admin-projection-only state. Session templates use a JSONB `blueprint` column (same principle as JSON export/import), not a relational template schema.

**Major components (new and modified):**
1. **SequenceManager** (NEW) -- Drag-and-drop ordering of `session_items`, replaces BatchList's top-level interleaving
2. **ImageUploader** (NEW) -- File picker, client-side compression, upload to Supabase Storage
3. **SlideEditor** (NEW) -- Modal for creating/editing slides (image + caption), follows TemplateEditor patterns
4. **SlideDisplay** (NEW) -- Full-screen image display during active presentation, renders in same viewport area as ActiveQuestionHero
5. **PresentationController** (NEW, integrated into AdminControlBar) -- Sequence-aware advance/back with slide = local state only, batch = existing broadcast
6. **SessionTemplatePanel** (NEW, replaces TemplatePanel) -- Save/load session blueprints from Supabase
7. **AdminSession** (MODIFY) -- Loads session_items, tracks active sequence index, renders SlideDisplay when active item is slide
8. **BatchList** (MODIFY) -- Reduced scope: removed top-level interleaving (handled by SequenceManager), keeps intra-batch question reorder
9. **SessionImportExport** (MODIFY) -- Extended schema with optional slide URLs and sequence order

**Key architectural decisions:**
- `session_items` is the single source of truth for display ordering (not `batch.position`)
- Slide data is inlined in `session_items` (no separate slides table)
- Slide navigation does NOT broadcast to participants (admin-only state)
- `session_items` should NOT be added to Supabase Realtime publication (use Broadcast for advance events instead)
- Session templates use JSONB blueprint (not relational normalization)
- Store relative Storage paths in database, construct full URLs at display time

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full schema, component boundaries, data flow diagrams, and anti-patterns.

### Critical Pitfalls

1. **Orphaned Storage files** (CRITICAL) -- Supabase has no cascade from database rows to Storage objects. Every delete path (slide removal, session deletion) must explicitly call `supabase.storage.from().remove()`. Use session-scoped paths (`{session_id}/{uuid}.ext`) for batch cleanup. Ignoring this leaks storage quota permanently.

2. **Storage RLS blocks uploads with cryptic 403** (CRITICAL) -- Policies on `storage.objects` are completely separate from table RLS. Must create explicit INSERT/DELETE policies for the slides bucket before any client upload code. Test with the anon key (not service role or dashboard), because anonymous auth users are `authenticated` role, not `anon` role.

3. **Position conflicts between session_items and existing batch/question positions** (CRITICAL) -- `session_items.position` must be the single source of truth for sequence ordering. Do not maintain two independent position systems. Existing `batch.position` should be derived from or superseded by `session_items.position`.

4. **CDN cache serves stale images after replacement** (CRITICAL) -- Never reuse Storage paths. Generate a unique `{uuid}.{ext}` filename for every upload. If replacing an image, upload to a new path and delete the old one. Add cache-bust query parameter as fallback for projection display.

5. **Drag-and-drop with mixed item types breaks DnD context** (MODERATE) -- Adding `slide-{id}` items to the existing `batch-{id}` / `question-{id}` DnD system requires extending ID prefix patterns, DragOverlay rendering, and nested context isolation. Must prototype early -- highest-risk UI work in v1.3.

See [PITFALLS.md](./PITFALLS.md) for 17 total pitfalls with detailed prevention strategies and phase-specific warnings.

## Implications for Roadmap

Based on research, suggested six-phase structure:

### Phase 1: Database Schema + Storage Bucket

**Rationale:** Everything downstream depends on the schema and Storage being configured. This phase has zero UI work and can be validated independently with SQL queries and Storage API calls.
**Delivers:** `session_items` table with CHECK constraints, `session_templates` table with JSONB blueprint and updated_at trigger, Supabase Storage bucket (`session-images` or `session-slides`) with public access and RLS policies, TypeScript types for `SessionItem`, `SessionTemplate`, `SessionBlueprint`.
**Addresses:** Unified sequence data model, session template persistence infrastructure
**Avoids:** Pitfall 2 (RLS blocking uploads), Pitfall 3 (position conflicts -- by establishing session_items as single source of truth from day one), Pitfall 15 (realtime overhead -- by NOT adding session_items to realtime publication)

### Phase 2: Image Upload + Slide CRUD

**Rationale:** Slides are the core new content type. The upload pipeline (compression, validation, Storage upload, cleanup) must work before sequencing or presentation can use slides.
**Delivers:** ImageUploader component, SlideEditor modal, client-side compression and validation, image cleanup on delete, temporary integration into AdminSession draft view.
**Addresses:** Image upload to Storage, file validation (type/size/content), image slide CRUD
**Avoids:** Pitfall 1 (orphaned images -- cleanup built in from day one), Pitfall 4 (CDN cache -- unique paths per upload), Pitfall 5 (no validation -- client-side type/size/content checks), Pitfall 9 (upload timeout -- compression before upload), Pitfall 10 (MIME bypass -- Image() content check)
**Uses:** browser-image-compression, Supabase Storage API, nanoid for filenames

### Phase 3: Unified Sequence Management

**Rationale:** The sequence UI brings slides and batches together into a single drag-and-drop list. Depends on slides existing (Phase 2) and session_items table (Phase 1).
**Delivers:** SequenceManager component replacing BatchList's top-level interleaving, session_items CRUD API, auto-migration for existing sessions (backfill session_items from batches), session-store extensions.
**Addresses:** Unified sequence model, drag-and-drop reordering, standalone questions section
**Avoids:** Pitfall 3 (position conflicts -- BatchList scope reduced, SequenceManager owns ordering), Pitfall 7 (mixed DnD types -- extend existing ID prefix pattern), Pitfall 13 (position gaps -- sequential integer compaction on reorder)

### Phase 4: Presentation Controller

**Rationale:** This is the "play" mode for the sequence built in Phase 3. Admin advances through slides and batches during a live session.
**Delivers:** Sequence-aware navigation in AdminControlBar, SlideDisplay component, keyboard navigation (arrows, Space, Escape), backward compatibility for sessions without session_items.
**Addresses:** Manual advance through sequence, full-screen image projection, keyboard shortcuts, participant waiting state during slides
**Avoids:** Pitfall 4 (stale cached images -- preload with cache-bust), Pitfall 11 (aspect ratios -- object-contain in fixed container), Pitfall 16 (channel overhead -- single Broadcast event per advance, not per-slide data)

### Phase 5: Session Templates in Supabase

**Rationale:** Templates snapshot the complete session including the sequence. Must come after slides and sequences are fully implemented so templates can serialize them.
**Delivers:** SessionTemplatePanel replacing TemplatePanel, Zustand store + API module for session templates, save/load/delete with JSONB blueprints, one-time localStorage migration.
**Addresses:** Session templates in Supabase, localStorage-to-database migration, image reference handling in templates
**Avoids:** Pitfall 6 (migration data loss -- one-time migration with fallback and backup), Pitfall 12 (stale image URLs in templates -- validate on load, provide re-upload option), Pitfall 14 (dead localStorage code -- remove after migration verified)

### Phase 6: Export/Import Extension + Polish

**Rationale:** Export must capture complete state. Polish and edge cases come last after all features work.
**Delivers:** Extended JSON export with optional `sequence` field and slide image URLs, backward-compatible import for v1.2 exports, session deletion Storage cleanup, transition animations, fullscreen API toggle.
**Addresses:** JSON export extension, backward compatibility, image URL handling in exports, visual polish
**Avoids:** Pitfall 8 (cross-instance URLs -- document limitation, graceful fallback for missing images), Pitfall 17 (schema breaking change -- optional fields, schema version field)

### Phase Ordering Rationale

- **Schema before upload:** Storage bucket and RLS policies must exist before any client upload code runs. TypeScript types must exist before any component code.
- **Upload before sequence:** Slides must be creatable before they can be placed in a sequence. Image cleanup patterns must be proven before sequence deletion can rely on them.
- **Sequence before presentation:** The presentation controller navigates a sequence that must already exist and be orderable.
- **Templates after sequence:** Templates serialize sessions including sequences and slides. They cannot be complete without those features.
- **Export last:** Export captures all data. Every feature must be finalized before the export schema can be frozen.
- **Phase 3 is the riskiest:** DnD with mixed item types plus replacing BatchList's top-level interleaving is the highest-complexity UI work. Budget extra time.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (Image Upload):** Client-side compression settings need tuning (quality vs. size tradeoffs). browser-image-compression WebP output behavior across browsers. Whether to use TUS resumable uploads for files over 2MB.
- **Phase 3 (Unified Sequence):** The BatchList refactor is complex -- existing tests (BatchList.test.tsx, AdminSession.test.tsx) may need significant updates. The auto-migration logic (backfill session_items from existing batches) needs careful design to avoid breaking existing sessions.
- **Phase 5 (Session Templates):** Image lifecycle in templates is a design decision that needs resolution -- do template images get copied to a separate Storage path, or do they reference session images (which may be deleted)?

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Schema + Storage):** Well-documented Supabase patterns. SQL is provided in ARCHITECTURE.md and STACK.md. Manual apply via Dashboard SQL Editor per MEMORY.md.
- **Phase 4 (Presentation Controller):** Standard keyboard event handling, CSS full-screen layout, simple state machine (advance index, render appropriate component). Existing Broadcast patterns cover the advance event.
- **Phase 6 (Export/Import):** Existing export/import code already handles optional fields (templates field added in v1.2). Extension is additive.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via official Supabase Storage docs, browser-image-compression npm/GitHub, and existing codebase analysis. Zero ambiguity on what to install. |
| Features | MEDIUM-HIGH | Competitor analysis covers 7 tools (Mentimeter, Kahoot, Slido, AhaSlides, Poll Everywhere, SlideLizard, Canva). Feature scope is deliberately narrow (image-only slides, admin-projection-only). |
| Architecture | HIGH | Based on full codebase analysis of 11 migration files, all major components, and existing patterns. Schema SQL and component boundaries are concrete, not speculative. |
| Pitfalls | HIGH | 4 critical pitfalls verified against Supabase official docs and GitHub discussions with linked sources. Integration pitfalls verified by direct codebase analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **Inline slides vs. separate slides table:** STACK.md proposes a separate `slides` table while ARCHITECTURE.md proposes inlining slide data into `session_items`. The ARCHITECTURE.md approach (inline) is recommended because slides have only two fields. **Resolve during Phase 1 schema design** -- the choice affects every downstream component.

- **Storage bucket naming:** STACK.md uses `session-slides`, ARCHITECTURE.md uses `session-images`. Pick one name during Phase 1 and use it consistently. Recommend `session-slides` (more specific to purpose).

- **Session template scope (global vs. per-user):** STACK.md proposes per-user templates with `UNIQUE(name, created_by)`, while ARCHITECTURE.md proposes global templates with `name UNIQUE` (matching response_templates pattern). The existing response_templates are global. **Decide during Phase 5 planning** -- per-user is more correct for anonymous auth but global is simpler and matches existing patterns.

- **Free tier Storage limits:** 1GB total storage is tight for sustained use. With compression (~500KB/image, ~10 images/session), each session uses ~5MB, giving ~200 sessions. A cleanup mechanism for ended sessions should be designed during Phase 2 (image upload), even if implementation is deferred.

- **session_items Realtime subscription:** ARCHITECTURE.md adds session_items to realtime publication, while PITFALLS.md warns against it (generates N UPDATE events per reorder). The PITFALLS.md recommendation is correct -- **do NOT add session_items to realtime publication**. Use Broadcast for advance events instead.

## Sources

### Primary (HIGH confidence)
- [Supabase Storage Upload API](https://supabase.com/docs/reference/javascript/storage-from-upload) -- upload, getPublicUrl, remove, list
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- RLS for storage.objects, storage.foldername() helper
- [Supabase Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals) -- caching behavior, cache invalidation
- [Supabase Storage Bucket Configuration](https://supabase.com/docs/guides/storage/buckets/fundamentals) -- public vs private, MIME types, size limits
- [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) -- API, options, Web Worker support
- [Supabase Orphaned Files Discussion](https://github.com/orgs/supabase/discussions/34254) -- SQL DELETE does not remove S3 files
- [Supabase MIME Validation Issue](https://github.com/supabase/storage/issues/639) -- filename-only check

### Secondary (MEDIUM confidence)
- [Mentimeter Presentation Mode](https://help.mentimeter.com/en/articles/410899-how-the-presentation-mode-affects-your-presentation) -- unified deck, keyboard navigation
- [Kahoot Slides](https://support.kahoot.com/hc/en-us/articles/29644015543315-How-to-use-Kahoot-slides) -- image/video slides between questions
- [Supabase Storage CDN Cache Discussion](https://github.com/orgs/supabase/discussions/5737) -- stale content on path reuse
- [Efficient Database Reordering](https://yasoob.me/posts/how-to-efficiently-reorder-or-rerank-items-in-database/) -- position management patterns
- [Aha Engineering: Fullscreen API with React](https://www.aha.io/engineering/articles/using-the-fullscreen-api-with-react) -- implementation patterns

### Project Context
- QuickVote v1.0-v1.2 codebase: AdminSession.tsx, BatchList.tsx, AdminControlBar.tsx, session-store.ts, template-store.ts, template-api.ts, question-templates.ts, session-export.ts, session-import.ts, TemplatePanel.tsx, database.ts, all 11 migration files
- MEMORY.md constraints: moddatetime unavailable, manual SQL migration via Dashboard, admin light theme, mousedown+mouseup overlay close pattern

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
