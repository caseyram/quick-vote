# Phase 13: Consistent Rendering - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Template-linked questions display identically for participants — same option order, same colors, same button layout. All MC questions (template or not) use the same color system; templates guarantee order consistency across questions. Admin preview is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Color mapping strategy
- One global palette — all templates and non-template questions use the same position-based color sequence
- Position determines color: option at index 0 always gets color 1, index 1 gets color 2, etc.
- No per-template or per-option-text color assignment
- Claude's discretion on the specific approach (fixed-by-position vs configurable)

### Layout & sizing rules
- Keep current participant layout approach — don't change the layout paradigm, just ensure consistency
- Template order is the source of truth for display order (overrides any per-question order)
- Similar but flexible sizing — same general layout for same template, but can adapt to screen size/text length
- Claude's discretion on whether fewer options get larger buttons

### Non-template question behavior
- Same color system for all MC questions — participants cannot distinguish template from non-template
- Non-template questions use admin-entered order (no shuffling/randomization)
- No visual indicator of template usage in participant view — templates are an admin concept

### Transition & edge cases
- Freeze display order after votes — once a question has votes, its display order is locked even if template changes
- Live and batch voting must look identical for template-linked questions (same colors, order, sizing)
- Deleted template: fall back gracefully — question keeps its options (ON DELETE SET NULL), renders like a non-template question using its own option order

### Claude's Discretion
- Specific color palette values and sequence
- Button sizing strategy for different option counts (adaptive vs fixed)
- How to detect and enforce the vote-based freeze on display order
- Implementation pattern for deriving colors from position index

</decisions>

<specifics>
## Specific Ideas

- The core value of templates for rendering is ORDER consistency, not visual distinction — "Strongly Agree" is always in position 1 across all questions using that template
- Existing buttons already have colors — this phase makes them consistent, not introduces them
- Participant experience should be seamless — no awareness of the template system

</specifics>

<deferred>
## Deferred Ideas

- Admin "preview as participant" for template-linked questions — nice-to-have for a future phase

</deferred>

---

*Phase: 13-consistent-rendering*
*Context gathered: 2026-02-09*
