# Phase 18: Presentation Controller - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can advance through the unified sequence during a live session, projecting slides and activating batches in order. Navigation controls, slide projection display, participant waiting state, and transition animations. Presenter View (separate window) is Phase 19 — this phase covers the admin-side controls and projection within the existing admin session view.

</domain>

<decisions>
## Implementation Decisions

### Navigation controls
- Controls live in the SequenceManager sidebar panel (Next/Previous buttons + keyboard shortcuts)
- Controls hide when a controller window (Phase 19) is connected
- Progress indicated by highlighting the active item in the sequence list — no counter
- Next button disabled on the last item (no wrap-around)
- Clicking any item in the sequence list jumps directly to it (out-of-order navigation allowed)
- Keyboard: arrow keys and Space to advance

### Slide projection
- Slide images display using `object-fit: contain` (letterbox, no cropping)
- Letterbox background color: dark gray (#1a1a1a)
- Image only in projection area — no title overlay (title visible in sidebar list only)
- Batch items use existing batch/voting UI unchanged — no title card

### Participant waiting state
- Simple text message: "Waiting for next question..." centered on screen
- No animation, no session name, no branding — minimal
- Same waiting state for all participants regardless of when they joined (including latecomers)

### Transition animations
- Slide-to-slide: horizontal slide animation (forward = left, back = right)
- Any transition involving a batch: crossfade
- Duration: ~350ms (medium, smooth but not slow)

### Claude's Discretion
- Exact easing curve for animations
- Keyboard shortcut edge cases (e.g., holding keys, repeat rate)
- How batch activation integrates with the existing voting flow
- Active item highlight styling in the sidebar

</decisions>

<specifics>
## Specific Ideas

- Navigation should feel like a presentation tool (PowerPoint/Keynote advancing) — click-to-jump plus sequential controls
- The conditional hide of controls when Phase 19 controller connects means this phase should design controls as a composable unit

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-presentation-controller*
*Context gathered: 2026-02-11*
