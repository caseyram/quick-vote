---
phase: 12-template-assignment-defaults
plan: 02
subsystem: ui
tags: [react, typescript, zustand, supabase, templates, forms]

# Dependency graph
requires:
  - phase: 12-01
    provides: Template data layer (migration, API helpers, store methods, checkQuestionVotes)
provides:
  - TemplateSelector reusable component for template dropdown
  - Template-aware QuestionForm with locked/unlocked modes
  - Template assignment to questions (create and edit)
  - Detach confirmation with option forking
  - Vote guard preventing template changes on voted questions
  - Session default template pre-selection
affects: [12-03, export-import, session-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Locked/unlocked UI modes based on template assignment
    - Confirmation dialogs for destructive operations (detach, replace)
    - Vote-based validation guards

key-files:
  created:
    - src/components/TemplateSelector.tsx
  modified:
    - src/components/QuestionForm.tsx
    - src/components/QuestionForm.test.tsx

key-decisions:
  - "TemplateSelector uses native HTML select (not react-select) for consistency with project patterns"
  - "Locked options displayed as read-only gray boxes with helper text"
  - "Detach operation forks template options as editable (no data loss)"
  - "Replace confirmation shown when switching from custom options to template"
  - "Vote guard blocks template changes at QuestionForm level (not API level)"
  - "Session default template pre-selected in create mode"

patterns-established:
  - "Controlled component pattern for TemplateSelector with null/string conversion"
  - "Light theme UI for admin forms (bg-white, text-gray-900, border-gray-300)"
  - "Confirmation dialogs for user-visible state changes (detach, replace)"

# Metrics
duration: 4min
completed: 2026-02-09
---

# Phase 12 Plan 02: Template Assignment UI Summary

**Template selector with locked/unlocked option modes, detach with confirmation, and vote-based template change guards**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-09T17:41:30Z
- **Completed:** 2026-02-09T17:45:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- TemplateSelector component for template dropdown (controlled, null-safe)
- QuestionForm template assignment with locked read-only options when template assigned
- Detach confirmation dialog that forks template options as editable
- Vote guard prevents template changes on questions with votes
- Session default template pre-selection in create mode

## Task Commits

Each task was committed atomically:

1. **Task 1: TemplateSelector component** - `f1d83d7` (feat)
2. **Task 2: Template-aware QuestionForm** - `236b8df` (feat)

## Files Created/Modified
- `src/components/TemplateSelector.tsx` - Reusable controlled select for template assignment with disabled state
- `src/components/QuestionForm.tsx` - Template-aware form with locked/unlocked modes, detach, replace, vote guard
- `src/components/QuestionForm.test.tsx` - Updated mocks for template-store and template-api

## Decisions Made

**1. Light theme for admin UI**
- Used bg-white, text-gray-900, border-gray-300 (not dark theme)
- Consistent with project memory guidance for admin components
- Locked options shown as gray read-only boxes (bg-gray-100)

**2. Native HTML select**
- Used native `<select>` element instead of react-select
- Consistent with existing project patterns (no external select library)
- Simpler, lighter, no additional dependencies

**3. Null/string conversion**
- Empty string in select represents "None (custom options)"
- Converted to `null` in state and database
- Prevents ambiguity between empty string and null

**4. Vote guard placement**
- Check happens in QuestionForm (UI level), not API level
- Provides immediate feedback to user
- Prevents unnecessary API calls for blocked operations

**5. Detach operation**
- Copies template options as editable (fork pattern)
- Template itself unchanged (questions with that template unaffected)
- Confirmation dialog prevents accidental detachment

**6. Replace confirmation**
- Shown when switching from custom options to template
- Prevents data loss from accidental template selection
- Only shown if custom options have non-empty values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Act() warnings in tests**
- QuestionForm has async effects (fetchTemplates, checkQuestionVotes)
- Caused act() warnings in test output
- Tests still pass (warnings don't cause failures)
- Added mocks for useTemplateStore and template-api functions
- Warnings are harmless (React testing library noise)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03 (Session Settings UI):**
- Template assignment working in QuestionForm
- TemplateSelector reusable for session settings panel
- Vote guard pattern established (can be reused for template edit guards)

**Ready for future phases:**
- Export/import can include question template_id field
- Session settings can set default_template_id
- Template panel can show usage counts and vote warnings

**No blockers or concerns.**

---
*Phase: 12-template-assignment-defaults*
*Completed: 2026-02-09*
