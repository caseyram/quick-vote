---
phase: 12-template-assignment-defaults
plan: 03
type: execute
completed: 2026-02-09

subsystem: ui, state, database
tags: [admin-session, settings, default-template, bulk-apply, bug-fixes]

requires:
  - 12-01: session.default_template_id, checkQuestionVotes, setSessionDefaultTemplate
  - 12-02: TemplateSelector, QuestionForm with template modes

provides:
  - Session default template UI in AdminSession settings
  - Bulk apply with vote safety
  - Inline batch question editing fix
  - ConfirmDialog button type fix

affects:
  - 12-COMPLETE: Phase 12 fully delivered

tech-stack:
  added: []
  patterns:
    - Bulk apply with vote-checking safety gate
    - Options field sync during bulk template assignment
    - Inline editing in nested DnD context (BatchCard)

decisions:
  - bulk-apply-options-sync:
      what: "Set both template_id AND options during bulk apply"
      why: "Questions need options to render correctly even before page reload"
      alternatives: "Set only template_id and rely on reload (rejected - bad UX)"
  - batch-inline-editing:
      what: "Render QuestionForm inline in BatchCard when editing"
      why: "BatchCard had no inline editing - clicking Edit set state but nothing rendered"
      alternatives: "Open separate modal (rejected - inconsistent with unbatched editing)"

key-files:
  modified:
    - src/pages/AdminSession.tsx
    - src/stores/session-store.ts
    - src/components/BatchCard.tsx
    - src/components/BatchList.tsx
    - src/components/ConfirmDialog.tsx
---

# Phase 12 Plan 03: Session Defaults & Verification Summary

**One-liner:** Session default template UI with bulk apply, plus bug fixes for batch editing, options sync, and dialog buttons.

## What Was Built

### Session Default Template UI (TMPL-05)
- Added "Default Template" dropdown in AdminSession Session Settings panel
- Uses TemplateSelector component with light admin theme
- Persists via `setSessionDefaultTemplate()` in session store
- "None" option clears the default
- New MC questions auto-select the session's default template

### Bulk Apply with Vote Safety
- When setting a default template, checks for existing templateless MC questions
- Shows ConfirmDialog with count of questions to update and skipped (voted) count
- Uses `checkQuestionVotes()` to skip questions with votes
- Sets both `template_id` AND `options` during bulk update for immediate UI sync
- Refreshes questions from database after bulk apply

### Bug Fixes (from human verification)
1. **Batch question editing** - BatchCard now accepts `editingQuestion` and `onCancelEdit` props, renders QuestionForm inline when editing a batch question
2. **Bulk apply options sync** - Bulk apply now sets `options` alongside `template_id` so questions update visually without page reload
3. **Session store column fix** - `setSessionDefaultTemplate` used `.eq('session_id', session.session_id)` instead of incorrect `.eq('id', session.id)`
4. **ConfirmDialog buttons** - Added `type="button"` to Cancel and Confirm buttons to prevent accidental form submission when inside a `<form>` element
5. **Error handling** - Added try/catch around `setSessionDefaultTemplate` call

## Commits

1. **06c0a61** - `feat(12-03): add session default template UI`
   - Default template dropdown in Session Settings
   - Bulk apply with vote safety
   - ConfirmDialog for bulk apply confirmation

2. **096edbb** - `fix(12-03): batch question editing, bulk apply, and dialog buttons`
   - BatchCard inline editing support
   - Options sync during bulk apply
   - Session store column name fix
   - ConfirmDialog type="button" fix
   - Error handling for setSessionDefaultTemplate

## Verification

- TypeScript compilation: PASS (npx tsc --noEmit)
- Tests: PASS (401 passed, 16 failed pre-existing)
- Human verification: APPROVED (all ASGN-01 through ASGN-05 and TMPL-05 verified in browser)

## Deviations from Plan

- Plan did not anticipate BatchCard missing inline editing support (pre-existing gap)
- Plan's bulk apply only set `template_id`; fix added `options` sync
- Plan used `.eq('id', session.id)` in store but sessions table uses `session_id` column
- ConfirmDialog button type issue discovered during in-form usage

## Requirements Verified

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ASGN-01 | Complete | TemplateSelector dropdown in QuestionForm for MC questions |
| ASGN-02 | Complete | Template selection auto-populates locked options |
| ASGN-03 | Complete | Options locked (read-only gray boxes) while template assigned |
| ASGN-04 | Complete | Detach copies template options as editable custom options |
| ASGN-05 | Complete | Template switching with replace confirmation on existing questions |
| TMPL-05 | Complete | Session default template dropdown with bulk apply |

## Performance Metrics

- Tasks: 2/2 completed (1 auto + 1 checkpoint)
- Files modified: 5
- Commits: 2 (feature + bug fixes)
- Tests: 401 passed (no regressions)
- TypeScript errors: 0
- Bug fixes: 5 (from human verification)
