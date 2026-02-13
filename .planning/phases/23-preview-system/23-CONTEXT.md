# Phase 23: Preview System - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing simple content preview (Edit/Preview toggle) with a full session preview that shows what the live experience looks like from all three audiences: projection screen, admin controls, and participant voting. This is a session simulation, not a content review.

</domain>

<decisions>
## Implementation Decisions

### Visual fidelity
- Styled approximation — purpose-built preview components that mimic look & feel, not actual live components rendered in sandbox
- All light theme — keep everything light since preview lives within the editor context (don't use dark participant theme)
- No device frame around participant view — just render at phone-like proportions
- Show sample data — pre-populated fake votes, participant counts, and results to give a feel for the live experience

### View layout
- Full-page overlay — preview takes over the entire page like a modal, with a close button to return to editor
- Side-by-side — all 3 views visible simultaneously (projection, control, participant)
- Each panel has a text label header ("Projection View", "Admin Controls", "Participant View")
- Replaces existing Edit/Preview toggle — one preview experience, not two separate ones

### Mock interactions
- Control view navigation is interactive — clicking next/prev advances all 3 views simultaneously
- Show mock vote results for each question (fake distribution bars/percentages)
- Projection view animates transitions between items (crossfade, matching live behavior)

### Preview navigation
- Full keyboard support — arrow keys navigate, Escape closes, matching live presentation shortcuts
- Allow starting at both beginning and currently selected item (e.g., "Preview from here" and "Preview all")
- Entry point replaces the current Preview segment in the Edit/Preview segmented control

### Claude's Discretion
- View panel proportions (equal thirds vs weighted)
- Participant voting interactivity level (clickable no-op vs static mockup)
- Mock data generation approach (hardcoded vs randomized)
- Exact transition animation style

</decisions>

<specifics>
## Specific Ideas

- The existing simple preview (Phase 22 PreviewMode component) should be replaced entirely — users don't need two different preview modes
- "Preview from here" should start at the currently selected sidebar item; the main "Preview" toggle starts from the beginning
- All three views should stay synchronized when navigating — advancing in the control view updates projection and participant simultaneously

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-preview-system*
*Context gathered: 2026-02-12*
