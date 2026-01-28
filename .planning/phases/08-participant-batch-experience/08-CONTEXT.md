# Phase 8: Participant Batch Experience - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Participants can navigate, answer, review, and submit batch questions at their own pace. This covers the entire self-paced voting experience from receiving batch questions to final submission. Admin progress monitoring and results polish are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Navigation UI
- Buttons only navigation (no swipe gestures)
- Fixed footer with Next/Prev buttons at bottom of screen
- Text counter progress indicator ("Question 3 of 10")
- Linear navigation only — must go through questions in sequence, no jumping

### Answer Persistence
- Votes save immediately on answer (same as live mode)
- Participants can change their answer anytime until final submit
- Selected option stays highlighted (no toast, no checkmark)
- Returning to a question shows pre-selected state, can tap to change

### Review & Submit Flow
- No review screen — submit button on last question only
- Partial submission allowed (can submit with unanswered questions)
- Submit replaces Next button when on final question
- Instant completion — no confirmation dialog

### Completion Feedback
- Subtle animation (quick check/pulse) when answering each question
- Final completion matches live mode style ("Waiting for results")
- Participant stays on waiting screen after submitting
- No re-entry — once submitted, batch is locked for that participant

### Claude's Discretion
- Exact animation timing and style
- Keyboard shortcut implementation (arrow keys for desktop)
- How to handle edge cases (empty batches, network errors)
- Visual styling of disabled Prev button on first question

</decisions>

<specifics>
## Specific Ideas

- Match the existing live mode waiting screen for consistency
- Keep the "immersive and tactile" feel from PROJECT.md — subtle animations help
- Linear flow keeps it simple and predictable for participants

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-participant-batch-experience*
*Context gathered: 2026-01-28*
