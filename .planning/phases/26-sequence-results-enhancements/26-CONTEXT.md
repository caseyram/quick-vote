# Phase 26: Sequence & Results Enhancements - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-select rearrangement in the sequence sidebar, live completion count for active batches, and session configuration simplification. All content editing (slides, questions, templates) happens in the template editor — session config is stripped to runtime-only settings.

**Dropped from original scope:**
- SEQE-01 (drag handles hidden during live session) — dropped per user decision. Editing should remain available during live sessions.
- RESL-02 (expand multiple reasons simultaneously) — skipped, existing reason review system is sufficient.
- RESL-03 (auto-mark reasons as read) — skipped, existing viewed tracking is sufficient.

</domain>

<decisions>
## Implementation Decisions

### Multi-select rearrangement (SEQE-02)
- Selection method: Shift-click for range, Ctrl-click to add/remove individual items
- Visual indicator: Background tint on selected items
- Group drag behavior: Claude's discretion (stacked preview, ghost stack, or best fit with existing drag library)
- Deselection: Both Escape key and clicking empty space clear the selection

### Live completion count (RESL-01)
- Format: Progress bar with numeric count (e.g., "12/30")
- Placement: Replaces the existing status badge / "Results ready" text on the sequence item card
- Update mechanism: Realtime via existing Supabase realtime subscription (not polling)
- Completion state: Progress bar turns green when 100% of participants have voted

### Session configuration simplification
- Remove all slide/question editing from session config — content editing lives exclusively in the template editor
- Remove response template, question template, and session template selectors from session config
- Keep only: session name, teams configuration, reasons enabled toggle, test data toggle
- Reasons enabled defaults to ON (both in template editor and session config)

### Claude's Discretion
- Group drag visual implementation (stacked preview vs ghost stack)
- Progress bar styling to fit existing sequence card layout
- Session config page layout after simplification
- How to handle existing sessions that were created with the old config flow

</decisions>

<specifics>
## Specific Ideas

- "The session template provides all the editing we need" — session config should be a thin runtime config layer, not duplicate the editor
- "If there are a lot of slides the user ends up having to scroll a long way to get to remaining config options" — current config page has too much clutter
- "If we can drag during live session there should be a drag handle. Otherwise it might be confusing if they are accidentally dragged" — drag handles should always be visible when drag is functional

</specifics>

<deferred>
## Deferred Ideas

- Session editing vs template editing architectural refactoring — extract shared editing components, eliminate duplication between session config and template editor. Separate phase.

</deferred>

---

*Phase: 26-sequence-results-enhancements*
*Context gathered: 2026-02-14*
