# Phase 24: Presentation Polish - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Seamless slide transitions, branded backgrounds, and batch cover images for the projection experience. Covers PRES-01 through PRES-06. Does not add new presentation features or change session flow — polishes existing projection and voting views.

</domain>

<decisions>
## Implementation Decisions

### Transition feel
- Directional slide animation: slide in from right for next, slide in from left for previous
- No visible gap between images during transition
- ~400ms duration (medium speed)
- Transitions apply to ALL sequence item changes (slide-to-slide, slide-to-batch, batch-to-slide, etc.)
- Same slide animation style regardless of item type — consistent feel throughout

### Background color
- Full color picker (wheel/slider + hex input) in the template editor toolbar
- Default color: dark blue/gray
- Applies to projection view only — participant view stays default
- Live preview in template editor — color changes reflected in real time
- Color persists in template blueprint

### Batch cover images
- Admin can pick from existing slides in the sequence OR upload a new image specifically for the batch
- Placement of cover image control: Claude's discretion (based on existing batch editing UI)
- Cover image displays full-screen on projection while participants answer questions (like a slide)
- Cover image transitions away (slide/fade out) when results are ready to show — clean separation

### Contrast handling
- Auto light/dark text switching based on background luminance — no manual text color picker
- Result bars/charts adapt their colors to ensure contrast against the chosen background
- Participant view is not affected — contrast handling only applies to projection

### Claude's Discretion
- Cover image control placement within the batch editing UI
- Exact curated default dark blue/gray hex value
- Luminance threshold for light/dark text switching
- Chart color adaptation algorithm
- Loading/transition states during slide animations

</decisions>

<specifics>
## Specific Ideas

- Transitions should feel like a presentation deck (think Keynote/PowerPoint directional slides), not a web page
- No visible gap between images — the outgoing and incoming content should overlap during transition
- Cover image during voting = full-screen like a slide, giving the presentation a branded feel even during interactive moments
- Preview in template editor should reflect background color changes in real time so admin knows exactly what it will look like

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-presentation-polish*
*Context gathered: 2026-02-13*
