# Requirements: v1.3 Presentation Mode

**Milestone:** v1.3
**Created:** 2026-02-10
**Status:** Active

---

## Image Slides

- [ ] **IMG-01**: Admin can upload full-screen images to Supabase Storage with file type and size validation
- [ ] **IMG-02**: Admin can view uploaded images displayed full-screen on the admin projection with proper aspect ratio handling (object-contain)
- [ ] **IMG-03**: Admin can create, view, and delete image slides with automatic storage cleanup on deletion
- [ ] **IMG-04**: Admin can add an optional title/label to each slide for sequence management (admin-only, not projected)

## Unified Session Sequence

- [ ] **SEQ-01**: Admin can arrange slides and batches in a single ordered list (session_items) with drag-and-drop reordering
- [ ] **SEQ-02**: Admin can manually advance forward and backward through the sequence using keyboard (arrow keys, Space) and on-screen buttons
- [ ] **SEQ-03**: Participants see a waiting state ("Waiting for next question...") when admin is on a content slide
- [ ] **SEQ-04**: Smooth transition animations (fade/slide) play when advancing between sequence items

## Presenter View

- [ ] **PRES-01**: Admin can open a separate presentation window via an "Open Presentation" button that displays the clean projected view (full-screen current item, no controls)
- [ ] **PRES-02**: Admin control view shows sequence list, next/previous controls, preview of upcoming item, and QR toggle
- [ ] **PRES-03**: Presentation window syncs with admin control view via Supabase Realtime (supports cross-device operation)
- [ ] **PRES-04**: Admin can trigger QR code expand/collapse overlay on the presentation view from the control view
- [ ] **PRES-05**: Extended keyboard shortcuts in admin control view: Space (advance), Escape (exit presentation), B (black screen)
- [ ] **PRES-06**: Fullscreen API toggle in presentation view for one-click browser fullscreen

## Session Templates in Supabase

- [ ] **STPL-01**: Admin can save the current session structure (sequence, slides, batches, questions, response template assignments) as a named reusable template in Supabase
- [ ] **STPL-02**: Admin can load a saved session template into a new session, restoring full structure including image references
- [ ] **STPL-03**: Admin can list, rename, and delete saved session templates

## Export/Import Extension

- [ ] **EXP-01**: JSON session export includes slide image URLs and sequence order (backward-compatible with v1.2 exports)
- [ ] **EXP-02**: JSON import restores slides (referencing existing Storage URLs) and sequence order
- [ ] **EXP-03**: Session template references included in JSON export/import

## Presentation Polish

- [ ] **POL-01**: Slide preview thumbnails displayed next to slide items in the sequence editor
- [ ] **POL-02**: QR code overlay available on content slides in the presentation view for latecomers to join

---

## Future Requirements

Deferred to later milestones.

- **VID-01**: Video slide support (YouTube/Vimeo embeds)
- **TXT-01**: Rich text / heading slide content types
- **PVIS-01**: Participant-visible slides (image pushed to participant devices)
- **AUTO-01**: Auto-advance / timed slides
- **PPT-01**: PowerPoint / Google Slides import
- **CROP-01**: Image contain/cover toggle per slide
- **NOTE-01**: Admin speaker notes (dual-view pattern)
- **MULTI-01**: Multiple images per slide (carousel/grid)

## Out of Scope

| Feature | Reason |
|---------|--------|
| PowerPoint/Google Slides import | Massive complexity, tangential to core value. Upload as images instead. |
| Video slides | Playback complexity, autoplay policies. Image-only sufficient for v1.3. |
| Rich text editor on slides | Scope explosion. Text baked into uploaded images. |
| Participant-visible slides | Doubles rendering surface, complicates phone experience. Admin-projection only. |
| Slide templates/themes | Theming system is scope creep. Admin controls appearance via image itself. |
| Image editing/annotation | Out of scope. Admin uses external image editor. |
| Auto-advance / timed slides | Contradicts manual control model. Admin decides pace. |
| Binary image embedding in export | File size explosion (2MB image = 2.7MB base64). URLs only. |

## Traceability

| Requirement | Phase | Description |
|-------------|-------|-------------|
| IMG-01 | Phase 16 | Image upload to Supabase Storage |
| IMG-02 | Phase 16 | Full-screen image display on admin projection |
| IMG-03 | Phase 16 | Image slide CRUD with storage cleanup |
| IMG-04 | Phase 16 | Slide title/label for admin |
| SEQ-01 | Phase 17 | Unified sequence with drag-and-drop |
| SEQ-02 | Phase 18 | Manual advance with keyboard and buttons |
| SEQ-03 | Phase 18 | Participant waiting state during slides |
| SEQ-04 | Phase 18 | Transition animations between items |
| PRES-01 | Phase 19 | Separate presentation window |
| PRES-02 | Phase 19 | Admin control view with sequence controls |
| PRES-03 | Phase 19 | Cross-device sync via Supabase Realtime |
| PRES-04 | Phase 19 | QR code expand/collapse overlay control |
| PRES-05 | Phase 19 | Extended keyboard shortcuts |
| PRES-06 | Phase 19 | Fullscreen API toggle |
| STPL-01 | Phase 20 | Save session as template in Supabase |
| STPL-02 | Phase 20 | Load template into new session |
| STPL-03 | Phase 20 | Template CRUD (list, rename, delete) |
| EXP-01 | Phase 21 | Slides and sequence in JSON export |
| EXP-02 | Phase 21 | Import restores slides and sequence |
| EXP-03 | Phase 21 | Session templates in export/import |
| POL-01 | Phase 21 | Slide preview thumbnails in sequence editor |
| POL-02 | Phase 21 | QR code overlay on presentation slides |

**Coverage:**
- v1.3 requirements: 22 total
- Mapped to phases: 22/22
- Coverage: 100%

---
*Created: 2026-02-10*
*Updated: 2026-02-10 -- Traceability mapped to Phases 16-21*
