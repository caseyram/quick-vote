# Phase 14: Export/Import Integration - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Templates travel with session data through JSON export/import. Extend the existing export and import flows to include response template definitions and preserve template-question associations through round-trips. No new UI surfaces — this extends existing export/import functionality.

</domain>

<decisions>
## Implementation Decisions

### Name collision handling
- On import, match templates by name (case-sensitive)
- If same name AND same options: skip overwrite, reuse existing template (link questions to it)
- If same name but different options: overwrite existing template with imported version
- Case-sensitive matching: "Yes/No" and "yes/no" are treated as different templates

### Export scope
- Export only templates referenced by questions in the session (not all global templates)
- Session default_template_id is NOT included in export (it's a local setting, not data)
- Each question includes an explicit template_id field in the export JSON, pointing to a template in the export's templates array
- Old export files (pre-template) import seamlessly with no warnings — questions simply have no template association

### Import feedback
- Success message includes template count alongside batches and questions: "Imported 3 batches, 12 questions, 2 templates"
- Counts only — no dedup details in the user-facing message
- If template import fails (database error), entire import fails (all-or-nothing)

### Claude's Discretion
- Whether to add template support to both export functions (`exportSession` and `exportSessionData`) or just the primary one — decide based on actual usage in the codebase
- Whether to restore session default_template_id on import — decide based on how import is used (append vs fresh session)
- Overwrite UX: whether to show post-import summary noting which templates were updated — pick appropriate level

</decisions>

<specifics>
## Specific Ideas

- Explicit template_id on questions in JSON makes the format unambiguous and avoids fragile name-matching during import
- Templates array should be a top-level field in the export JSON (alongside session_name, created_at, batches)
- Backward compatibility with pre-template exports is critical — the optional templates field means old files just work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-export-import-integration*
*Context gathered: 2026-02-09*
