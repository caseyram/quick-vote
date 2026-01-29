# Phase 10: Progress Dashboard & Results Polish - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can monitor batch completion in real-time and results view has improved UX. This phase covers the admin-facing progress dashboard during active batches and improvements to the results viewing experience. Participant-facing changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Progress Dashboard Location & Layout
- Inline in admin session view (top section, always visible when active)
- Progress bar + numbers display (visual bar showing ratio plus exact counts)
- Mini bars per question showing response count for each question
- Only visible during active batch (hide when no batch active)

### Real-time Update Behavior
- Brief highlight pulse animation when counts change (quick glow, then fade)
- Visual only — no sound or browser notifications
- Stay visible with final stats after batch closes ("15/15 complete" persists)

### Claude's Discretion (Updates)
- Update timing mechanism (realtime subscription vs polling) — pick based on existing architecture

### Results View Layout
- Column order matches question order as authored (Option 1 left, Option 2 right)
- Columns display in their authored sequence for horizontal layout
- Floating/sticky navigation arrows on left/right edges of screen
- Keyboard arrows (←/→) navigate between questions in results view

### Read/Unread Reasons
- Background highlight for unread reasons (subtle tinted background)
- Click on reason card to mark as read
- Individual marking only — no bulk "mark all as read" action
- Session-only persistence via localStorage (not database)

</decisions>

<specifics>
## Specific Ideas

- Progress dashboard should feel like a live sports scoreboard — you glance at it and immediately know the status
- Results navigation should be as smooth as the participant carousel experience

</specifics>

<deferred>
## Deferred Ideas

- Haptic feedback on participant selection/submission/next — future participant UX phase

</deferred>

---

*Phase: 10-progress-dashboard-results-polish*
*Context gathered: 2026-01-28*
