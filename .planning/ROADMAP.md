# Roadmap: QuickVote

## Milestones

- ✅ **v1.0 MVP** - Phases 1-5 (shipped 2026-01-28)
- ✅ **v1.1 Batch Questions & Polish** - Phases 6-10 + 09.1 (shipped 2026-01-29)
- ✅ **v1.2 Response Templates** - Phases 11-15 (shipped 2026-02-10)
- 🚧 **v1.3 Presentation Mode** - Phases 16-21 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) - SHIPPED 2026-01-28</summary>

See `.planning/milestones/` for archived details.

</details>

<details>
<summary>✅ v1.1 Batch Questions & Polish (Phases 6-10 + 09.1) - SHIPPED 2026-01-29</summary>

See `.planning/milestones/` for archived details.

</details>

<details>
<summary>✅ v1.2 Response Templates (Phases 11-15) - SHIPPED 2026-02-10</summary>

See `.planning/milestones/` for archived details.

</details>

### 🚧 v1.3 Presentation Mode (In Progress)

**Milestone Goal:** Transform sessions into guided presentations with image slides, unified sequencing, a dedicated presenter view, and reusable session templates stored in Supabase.

**Phase Numbering:**
- Integer phases (16, 17, ...): Planned milestone work
- Decimal phases (17.1, 17.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 16: Image Slides** - DB schema, Storage bucket, image upload pipeline, and slide CRUD
- [x] **Phase 17: Unified Sequence** - Single ordered list of slides and batches with drag-and-drop
- [ ] **Phase 18: Presentation Controller** - Live session advancing through the sequence with keyboard and buttons
- [ ] **Phase 19: Presenter View** - Separate projection window synced via Realtime with admin controls
- [ ] **Phase 20: Session Templates** - Save, load, and manage full session blueprints in Supabase
- [ ] **Phase 21: Export/Import + Polish** - Extended JSON export/import with slides, thumbnails, and QR overlay

## Phase Details

### Phase 16: Image Slides
**Goal**: Admin can upload images to Supabase Storage and manage them as slide content for projection
**Depends on**: Phase 15 (v1.2 complete)
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04
**Success Criteria** (what must be TRUE):
  1. Admin can select an image file, see it compressed client-side, and have it uploaded to Supabase Storage with validation rejecting non-image files and oversized uploads
  2. Admin can view an uploaded image displayed full-screen on the admin projection area with correct aspect ratio (no cropping, no distortion)
  3. Admin can create a slide, view it in a list, and delete it with the underlying Storage file automatically removed
  4. Admin can add and edit an optional title/label on each slide that appears in the admin management UI (not on projected display)
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md -- Database schema, Storage bucket, RLS policies, TypeScript types, slide-api module
- [x] 16-02-PLAN.md -- Image upload pipeline with client-side compression and slide CRUD UI

### Phase 17: Unified Sequence
**Goal**: Admin can arrange slides and batches in a single ordered list that defines the session flow
**Depends on**: Phase 16
**Requirements**: SEQ-01
**Success Criteria** (what must be TRUE):
  1. Admin sees slides and batches in a single ordered list (session_items) on the session edit view
  2. Admin can drag-and-drop to reorder slides and batches within the unified sequence, with order persisted to database
  3. Existing sessions without session_items are automatically backfilled from their current batch ordering (no data loss on upgrade)
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md -- sequence-api CRUD + backfill, session store extension, AdminSession load wiring
- [x] 17-02-PLAN.md -- SequenceManager UI with drag-and-drop reordering, AdminSession integration

### Phase 18: Presentation Controller
**Goal**: Admin can advance through the unified sequence during a live session, projecting slides and activating batches in order
**Depends on**: Phase 17
**Requirements**: SEQ-02, SEQ-03, SEQ-04
**Success Criteria** (what must be TRUE):
  1. Admin can advance forward and backward through the sequence using on-screen Next/Previous buttons and keyboard shortcuts (arrow keys, Space)
  2. When the active sequence item is a slide, the admin projection area displays the image full-screen; when it is a batch, voting activates normally
  3. Participants see a "Waiting for next question..." state when the admin is on a content slide (no image pushed to participant devices)
  4. Smooth fade/slide transition animations play when advancing between sequence items
**Plans**: TBD

Plans:
- [ ] 18-01: Presentation state machine and admin navigation controls
- [ ] 18-02: SlideDisplay projection, participant waiting state, transition animations

### Phase 19: Presenter View
**Goal**: Admin can operate the session from a control view while a separate presentation window shows the clean projected output, synced across devices via Realtime
**Depends on**: Phase 18
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, PRES-06
**Success Criteria** (what must be TRUE):
  1. Admin can click "Open Presentation" to launch a separate browser window showing only the projected content (full-screen current item, no admin controls)
  2. Admin control view shows the sequence list, next/previous navigation, a preview of the upcoming item, and a QR code toggle
  3. Presentation window stays in sync with admin control view via Supabase Realtime, including when admin and presentation are on different devices
  4. Admin can expand/collapse a QR code overlay on the presentation window from the control view, for latecomers to join
  5. Admin can use extended keyboard shortcuts (Space to advance, Escape to exit presentation, B for black screen) and toggle browser fullscreen in the presentation window
**Plans**: TBD

Plans:
- [ ] 19-01: Presentation window launch, control/projection view split
- [ ] 19-02: Realtime sync, QR overlay control, keyboard shortcuts, fullscreen API

### Phase 20: Session Templates
**Goal**: Admin can save a complete session structure as a reusable template in Supabase and load it into new sessions
**Depends on**: Phase 19 (full session structure must be established)
**Requirements**: STPL-01, STPL-02, STPL-03
**Success Criteria** (what must be TRUE):
  1. Admin can save the current session (sequence order, slides with image references, batches, questions, response template assignments) as a named template stored in Supabase
  2. Admin can load a saved template into a new session, restoring the full structure including slide image references and sequence order
  3. Admin can list all saved session templates, rename them, and delete them (with confirmation)
**Plans**: TBD

Plans:
- [ ] 20-01: session_templates table, blueprint serialization, Zustand store
- [ ] 20-02: SessionTemplatePanel UI with save, load, rename, delete

### Phase 21: Export/Import + Polish
**Goal**: JSON export/import captures the complete session including slides and sequence, with visual polish for the sequence editor and presentation view
**Depends on**: Phase 20
**Requirements**: EXP-01, EXP-02, EXP-03, POL-01, POL-02
**Success Criteria** (what must be TRUE):
  1. JSON export includes slide image URLs and sequence order, and remains backward-compatible with v1.2 exports (new fields are optional)
  2. JSON import restores slides (referencing existing Storage URLs) and sequence order, gracefully handling missing images
  3. Session template references are preserved through JSON export/import round-trips
  4. Slide preview thumbnails appear next to slide items in the sequence editor for at-a-glance identification
  5. QR code overlay is available on content slides in the presentation view so latecomers can join mid-session
**Plans**: TBD

Plans:
- [ ] 21-01: Export/import schema extension with slides, sequence, and templates
- [ ] 21-02: Slide thumbnails in sequence editor and QR overlay on presentation slides

## Progress

**Execution Order:**
Phases execute in numeric order: 16 → 17 → 18 → 19 → 20 → 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 16. Image Slides | v1.3 | 2/2 | ✓ Complete | 2026-02-10 |
| 17. Unified Sequence | v1.3 | 2/2 | ✓ Complete | 2026-02-11 |
| 18. Presentation Controller | v1.3 | 0/2 | Not started | - |
| 19. Presenter View | v1.3 | 0/2 | Not started | - |
| 20. Session Templates | v1.3 | 0/2 | Not started | - |
| 21. Export/Import + Polish | v1.3 | 0/2 | Not started | - |

---
*Created: 2026-02-10*
*Milestone: v1.3 Presentation Mode*
