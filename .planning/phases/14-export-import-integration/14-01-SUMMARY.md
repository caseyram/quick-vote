---
phase: 14-export-import-integration
plan: 01
subsystem: api
tags: [zod, supabase, json, export, import, templates]

# Dependency graph
requires:
  - phase: 11-template-database
    provides: response_templates table with name/options fields and unique name constraint
  - phase: 12-template-assignment
    provides: question.template_id FK for template-question associations
provides:
  - Extended export/import schemas with template support
  - Template-aware JSON export with name-based references
  - Name-based template deduplication on import
  - Template-question association preservation through export/import round-trip
affects: [14-02-ui-integration, future export/import features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ID-to-name mapping for export (UUIDs → human-readable names)"
    - "Name-to-ID mapping for import (human-readable names → UUIDs)"
    - "Upsert with deduplication pattern (check-compare-update/insert)"
    - "Race condition handling for unique constraints (error code 23505)"

key-files:
  created: []
  modified:
    - src/lib/session-export.ts
    - src/lib/session-import.ts

key-decisions:
  - "Store template NAME (not UUID) in export JSON for portability and readability"
  - "Overwrite existing templates when name matches but options differ"
  - "Import templates before questions to satisfy FK constraints"
  - "Make templates field optional in schemas for backward compatibility"

patterns-established:
  - "Export pattern: Collect referenced IDs → fetch data → map to names → include in JSON"
  - "Import pattern: Upsert templates → build name→ID map → restore FKs via map"
  - "Deduplication pattern: Fetch by name → compare arrays with JSON.stringify → conditional upsert"

# Metrics
duration: 4min
completed: 2026-02-09
---

# Phase 14 Plan 01: Export/Import Core Logic Summary

**JSON export/import extended with template support using name-based deduplication and FK restoration via mapping**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-09T22:44:50Z
- **Completed:** 2026-02-09T22:49:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended Zod schemas with backward-compatible optional template fields
- Export functions fetch and include templates referenced by questions
- Import upserts templates with name-based deduplication (reuse/update/insert logic)
- Template-question associations preserved through export/import round-trip via name mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend export schemas and exportSession function** - `a4ff01a` (feat)
2. **Task 2: Extend import schemas, add upsertTemplates, update importSessionData** - `992e006` (feat)

## Files Created/Modified

- `src/lib/session-export.ts` - Added TemplateExportSchema, extended QuestionExportSchema with template_id, added optional templates to SessionExportSchema, exportSession fetches templates and maps UUIDs to names
- `src/lib/session-import.ts` - Added TemplateImportSchema, extended QuestionImportSchema with template_id, added optional templates to ImportSchema, created upsertTemplates function with dedup logic, updated exportSessionData and importSessionData to support templates

## Decisions Made

1. **Template ID semantics in export JSON:** Field is named `template_id` but stores template NAME (not UUID) for human readability and cross-instance portability. This is a deliberate semantic shift - database uses UUIDs, export uses names.

2. **Deduplication strategy:** Name-based matching with options comparison via `JSON.stringify`. If name exists with different options, overwrite (import data is authoritative). If same name and same options, reuse existing template.

3. **Backward compatibility approach:** Made `templates` field optional in all schemas (`z.array(...).optional()`) so old export files (pre-template) pass validation without errors.

4. **Import ordering:** Templates imported FIRST (before batches/questions) to satisfy FK constraints on `question.template_id`.

5. **Race condition handling:** Catch error code 23505 (unique constraint violation) on template insert, retry fetch by name once to handle concurrent imports.

6. **exportSessionData parameter order:** Added `templates` as LAST optional parameter to avoid breaking existing callers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

**Ready for Plan 14-02:** UI integration work can now wire up the extended export/import functions.

**Blockers:** None

**Notes:**
- All 17 existing import tests pass (backward compatibility verified)
- TypeScript compilation succeeds with no errors
- Import return type changed to include `templateCount` - UI callers in Plan 02 will need updates
- Old export format (no templates field) validates successfully via optional schema fields

---
*Phase: 14-export-import-integration*
*Completed: 2026-02-09*
