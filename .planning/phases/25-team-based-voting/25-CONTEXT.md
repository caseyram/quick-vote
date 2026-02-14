# Phase 25: Team-Based Voting - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-team voting with team-specific QR codes and filtered results. Admin configures teams at the session level, participants join teams via self-select or auto-assign QR, admin can filter results by team, and export includes team grouping.

</domain>

<decisions>
## Implementation Decisions

### Team configuration
- Teams configured at the session level, NOT in the template editor
- Admin enters team names via free-form list (add/remove individual names)
- Maximum 4-5 teams per session
- Teams must be configured before going live — locked after Go Live (no mid-session changes)

### Team joining flow
- Both assignment paths: general QR shows team picker, team-specific QR auto-assigns
- General (non-team) QR code still works when teams are enabled — shows team picker
- Team picker uses dropdown select with a Join button
- Participants can switch teams until they cast their first vote, then locked
- Small team badge visible to participant during voting

### Results filtering
- Horizontal tab bar for team filter: All | Team A | Team B | ...
- Projection follows admin's filter — whatever team admin selects, projection shows the same
- When filtering by team, bars show only that team's votes (filter totals, not stacked/segmented)
- Vote counts, percentages, and participation stats all scoped to the selected team filter

### QR codes & export
- Team QR codes displayed as projection overlay — admin can show them on the projection screen
- Grid layout showing all team QR codes side by side with team names
- Export format: single CSV with a 'team' column (user filters/pivots in their spreadsheet)

### Claude's Discretion
- Database schema for team storage (sessions table column, separate table, etc.)
- RPC design for team-filtered vote aggregation
- Exact tab bar styling and placement within existing presentation UI
- QR code generation library/approach
- Team badge styling and placement on participant view

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-team-based-voting*
*Context gathered: 2026-02-14*
