# Phase 7: Batch Activation - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can activate a batch so participants receive all questions at once for self-paced voting. Activation mirrors the existing live question push pattern but delivers multiple questions simultaneously. Participant navigation and completion experience is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Activation flow
- Activate button lives inside each BatchCard
- No confirmation required — single click activates immediately
- Empty batches cannot be activated (button disabled when batch has zero questions)
- Button style: icon + text ("▶ Activate") for clarity

### Active batch visibility
- Active batch indicated by accent/green border highlight around the card
- Inactive batches remain visually equal (not dimmed) when one is active
- Non-active batch Activate buttons disabled while another batch is active (must close current batch first)
- Active batch uses same "close voting" pattern as live questions — Activate button becomes close/end control

### Mode transition
- Exclusive modes: batch active = no live question pushing allowed
- Push Question buttons on individual questions disabled (grayed out with tooltip) while batch is active
- Cannot activate a batch while a live question is pushed — must close live question first
- No explicit mode labels — current state is implicit from active batch border or pushed question indicator

### Deactivation behavior
- Admin can close batch immediately (no waiting for participant completion)
- All submitted votes are preserved when batch closes (partial completion is fine)
- Batches are one-time only — cannot be re-activated after closing
- Closed batches appear grayed out/disabled in admin view

### Claude's Discretion
- Exact border color/styling for active state
- Tooltip text for disabled buttons
- Animation for activation/deactivation transitions
- Error handling for edge cases

</decisions>

<specifics>
## Specific Ideas

- "This should function similar to live questions. There's just more than 1 question. So the same close voting should be used for batch" — batch activation/deactivation mirrors the existing live push/close pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-batch-activation*
*Context gathered: 2026-01-28*
