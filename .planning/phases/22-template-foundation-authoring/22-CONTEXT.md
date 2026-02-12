# Phase 22: Template Foundation & Authoring - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Dedicated template editor where admins build session content (questions, batches, slides, sequence) with inline editing, edit/preview toggle, and the ability to launch sessions directly or save as reusable templates. Preview system extensions (multi-view projection/control/participant simulation) are Phase 23.

</domain>

<decisions>
## Implementation Decisions

### Editor layout & navigation
- Full-page route (/templates/:id/edit) — dedicated workspace, not a modal
- Sidebar + main area layout: left sidebar shows sequence items, main area shows selected item details
- Sidebar items are draggable with reorder — shows type icon + title + summary (batch shows question count, slide shows thumbnail)
- Top toolbar spanning full width above both sidebar and main area
- Toolbar contains: back arrow, template name (editable inline), insert actions, global session settings, save button, edit/preview toggle
- Insert actions in toolbar: Add Batch, Add Slide, Upload Image — new items insert after the currently selected sidebar item (like inserting slides in a presentation app)
- Add items available from both toolbar (quick insert) and main area (contextual, with guidance)

### Inline editing experience
- When a batch is selected in sidebar, main area shows questions as collapsed compact rows
- Click a question row to expand it in place — reveals all editable fields (question text, response type, options/labels, timer override)
- Questions within a batch are drag-reorderable via handles on collapsed rows
- "Add question" button at the bottom of the question list within a batch

### Edit/preview toggle
- Toggle control lives in the top toolbar (segmented control or toggle button)
- Preview mode hides the sidebar — content takes over full area
- Preview steps through sequence items like a live session experience (next/prev navigation, one item at a time)
- Phase 22 preview shows formatted content rendered as it would appear live
- Phase 23 extends this with multi-view options (projection, control, participant simulation)

### Quick session flow
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

</decisions>

<specifics>
## Specific Ideas

- Toolbar inspired by presentation apps (PowerPoint, Google Slides) — centralized insert and settings controls to reduce scrolling
- Insert-after-selected pattern like adding slides in presentation software
- Preview should feel like stepping through a live session, not just viewing static content
- Current template editing is scroll-heavy — this redesign should eliminate most of that scrolling

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-template-foundation-authoring*
*Context gathered: 2026-02-12*
