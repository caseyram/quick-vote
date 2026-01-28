# Phase 9: Session Management - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin has a global entry point (/admin) to manage all sessions with review and export capabilities. Includes session list, read-only review of past sessions, JSON export with full data, and JSON import of questions/batches into existing sessions.

</domain>

<decisions>
## Implementation Decisions

### Session list view
- Show summary stats per session: name, date, question count, participant count
- Search by name only (text filter, no advanced filtering)
- Delete with confirmation dialog (hard delete, not archive)
- Prominent "New Session" button at top of list
- List ordered by timestamp, most recent first

### Session review flow
- View results only (read-only mode, no editing or continuing)
- All questions visible in scrollable list (not one-at-a-time navigation)
- Questions grouped by batch (batch headers with questions underneath)
- Full results per question: counts, percentages, reasons preview
- Click to expand and see all reasons

### Export format & behavior
- Full data export: questions, batches, votes, reasons
- Include participant_id (full fidelity, votes traceable to participants)
- Export available in both locations: session list (quick action) and review mode
- Filename convention: session-name-date.json (human-readable)

### Import flow & validation
- Import adds questions + batches into current session (not creating new session)
- Ignore votes in import file (import structure only, votes discarded)
- Fail completely on validation errors (all or nothing, no partial import)

### Claude's Discretion
- Import button placement (session admin view vs /admin list)
- Exact JSON schema structure
- Search implementation (debounced input, instant filter)
- Delete confirmation dialog design
- How "reasons preview" truncates long text

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

*Phase: 09-session-management*
*Context gathered: 2026-01-28*
