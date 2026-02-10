# Phase 15: Admin Results Template Ordering - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix admin result views so bar chart columns display in template-defined order, matching the participant view. Three admin views need updating: Previous Results grid, ActiveQuestionHero live results, and SessionResults end-of-session view. All should use the existing `buildConsistentBarData()` utility with template options.

</domain>

<decisions>
## Implementation Decisions

### Missing options display
- Always show ALL options as columns in admin charts, even those with zero votes
- This applies to both template-linked AND custom (non-template) questions — consistent behavior everywhere
- Zero-vote columns display a "0" count label with no bar rendered (empty column space)
- Template-linked questions derive column order from template; custom questions use their own option order

### Claude's Discretion
- Exact approach to integrating template store lookups in AdminSession and SessionResults
- Whether to refactor shared chart rendering logic or keep changes minimal per-file
- Error handling for missing template references

</decisions>

<specifics>
## Specific Ideas

No specific requirements — the participant view already implements the target behavior via `buildConsistentBarData()`. Admin views should match that behavior exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-admin-results-template-ordering*
*Context gathered: 2026-02-10*
