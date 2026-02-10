# Roadmap: QuickVote v1.2

**Milestone:** v1.2 Response Templates
**Created:** 2026-02-09
**Phases:** 5 (starting from Phase 11)
**Requirements:** 16
**Depth:** Quick (3-5 phases)

## Overview

Introduce reusable response templates to eliminate participant confusion from inconsistent multiple choice layouts. Templates lock down option order, colors, and layout across all questions that use them. Includes full CRUD, template assignment, consistent rendering, and export/import support.

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 11 | Template Database & CRUD ✓ | Admin can create, edit, and manage reusable response templates | TMPL-01, TMPL-02, TMPL-03, TMPL-04 | 4 |
| 12 | Template Assignment & Defaults ✓ | Admin can assign templates to questions and set session defaults | ASGN-01, ASGN-02, ASGN-03, ASGN-04, ASGN-05, TMPL-05 | 5 |
| 13 | Consistent Rendering ✓ | Template-linked questions display identically for participants | REND-01, REND-02, REND-03 | 3 |
| 14 | Export/Import Integration ✓ | Templates travel with session data through JSON export/import | EXPT-01, EXPT-02, EXPT-03 | 3 |
| 15 | Admin Results Template Ordering ✓ | Admin result views match participant template ordering | Audit tech debt #1 | 1 |

## Phase 11: Template Database & CRUD

**Goal:** Admin can create, edit, and manage reusable response templates

**Dependencies:** Phase 10 (v1.1 complete)

**Requirements:** TMPL-01, TMPL-02, TMPL-03, TMPL-04

**Success Criteria:**
1. Admin can create a new response template with a name and ordered list of options
2. Admin can edit an existing template (rename, reorder options, add/remove options)
3. Admin can delete a template with confirmation dialog if template is in use by questions
4. Templates persist in Supabase and are available globally across all sessions

**Plans:** 3 plans

Plans:
- [x] 11-01-PLAN.md — Database migration, TypeScript types, Zustand store, Supabase API functions (Completed 2026-02-09)
- [x] 11-02-PLAN.md — Template management UI (list, editor with DnD, delete confirmation, AdminSession integration) (Completed 2026-02-09)
- [x] 11-03-PLAN.md — Database migration application and human verification of all TMPL requirements (Completed 2026-02-09)

**Technical Scope:**
- Database: Create `response_templates` table with columns: id, name, options (JSONB array), created_at, updated_at
- Zustand store: Add template management methods (create, update, delete, list)
- UI: Template management panel accessible from admin session view
- Components: ResponseTemplatePanel, TemplateEditor

## Phase 12: Template Assignment & Defaults

**Goal:** Admin can assign templates to questions and set session defaults

**Dependencies:** Phase 11

**Requirements:** ASGN-01, ASGN-02, ASGN-03, ASGN-04, ASGN-05, TMPL-05

**Success Criteria:**
1. Admin sees template dropdown when creating or editing multiple choice questions
2. Selecting a template auto-populates the question's options from the template
3. Options are locked (read-only) while a template is assigned
4. Admin can detach a question from its template to customize options independently
5. Admin can change the template assignment on an existing question (switch templates)
6. Admin can set a session-level default template that auto-applies to new multiple choice questions

**Plans:** 3 plans

Plans:
- [x] 12-01-PLAN.md — Database migration for session default_template_id, TypeScript types, checkQuestionVotes helper, session store method (Completed 2026-02-09)
- [x] 12-02-PLAN.md — TemplateSelector component and template-aware QuestionForm with locked/unlocked modes, detach, and vote guard (Completed 2026-02-09)
- [x] 12-03-PLAN.md — Session default template UI in AdminSession settings, bulk apply, migration application, and human verification (Completed 2026-02-09)

**Technical Scope:**
- Database: Add `template_id` column to questions table, add `default_template_id` column to sessions table
- Zustand: Add template assignment/detachment methods, default template management
- UI: Template dropdown in QuestionForm, lock/unlock toggle, session settings for default template
- Components: TemplateSelector, TemplateLockedIndicator

## Phase 13: Consistent Rendering

**Goal:** Template-linked questions display identically for participants

**Dependencies:** Phase 12

**Requirements:** REND-01, REND-02, REND-03

**Success Criteria:**
1. All questions using the same template display options in identical order (order matches template definition)
2. Same color mapping applied consistently across all template-linked questions (first option same color, etc.)
3. Identical button layout and sizing in participant voting view for template-linked questions

**Plans:** 2 plans

Plans:
- [x] 13-01-PLAN.md — Template-aware participant rendering (VoteMultipleChoice refactor, template loading in ParticipantSession, tests) (Completed 2026-02-09)
- [x] 13-02-PLAN.md — Human verification of consistent rendering in live and batch modes (Completed 2026-02-09)

**Technical Scope:**
- Refactor: Update VoteMultipleChoice component to use template order when template_id present
- Color mapping: Derive colors from template option index (position-based, already correct)
- Layout: Ensure button grid respects template option count for consistent sizing
- Verification: Test in both live and batch voting modes

## Phase 14: Export/Import Integration

**Goal:** Templates travel with session data through JSON export/import

**Dependencies:** Phase 13

**Requirements:** EXPT-01, EXPT-02, EXPT-03

**Success Criteria:**
1. JSON session export includes all response templates used by questions in the session
2. JSON import restores templates (deduplicates by name if template already exists globally)
3. Template-question associations are preserved through export/import round-trip

**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md — Extend Zod schemas and both export/import functions with template support (schemas, exportSession, exportSessionData, upsertTemplates, importSessionData) (Completed 2026-02-09)
- [x] 14-02-PLAN.md — Wire templates into UI components (SessionImportExport, ImportSessionPanel) and add tests for schema extensions and backward compatibility (Completed 2026-02-09)

**Technical Scope:**
- Export: Extend exportSession to include templates array (fetch templates for all template_ids in questions)
- Import: Extend importSession to upsert templates (match by name, preserve global templates)
- Zod schemas: Add Template schema, update SessionExport schema
- Verification: Test export → import → export produces identical template data

## Phase 15: Admin Results Template Ordering

**Goal:** Admin result views display bar chart columns in template-defined order, matching participant view

**Dependencies:** Phase 14

**Requirements:** Tech debt closure (audit item #1)

**Gap Closure:** Closes admin results ordering mismatch from v1.2 audit

**Success Criteria:**
1. AdminSession "Previous Results" grid uses `buildConsistentBarData()` with template options for column ordering
2. AdminSession ActiveQuestionHero live results use `buildConsistentBarData()` with template options
3. SessionResults end-of-session view uses `buildConsistentBarData()` with template options
4. Admin sees bar chart columns in same order as participants for template-linked questions

**Technical Scope:**
- AdminSession.tsx: Replace 2 inline `aggregated.map()` calls with `buildConsistentBarData()` (template lookup from store)
- SessionResults.tsx: Add template store integration, pass `templateOptions` to `buildConsistentBarData()`
- Both files already import from vote-aggregation.ts, minimal new dependencies

**Plans:** 1 plan

Plans:
- [x] 15-01-PLAN.md — Replace inline aggregated.map() with buildConsistentBarData() in AdminSession and SessionResults, add explicit template loading (Completed 2026-02-10)

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| TMPL-01 | 11 | Admin can create a named response template with an ordered list of options |
| TMPL-02 | 11 | Admin can edit a template (rename, reorder options, add/remove options) |
| TMPL-03 | 11 | Admin can delete a template (with confirmation if in use by questions) |
| TMPL-04 | 11 | Templates are stored globally in Supabase and available across all sessions |
| TMPL-05 | 12 | Admin can set a session-level default template that auto-applies to new MC questions |
| ASGN-01 | 12 | Admin can select a template from a dropdown when creating a multiple choice question |
| ASGN-02 | 12 | Selecting a template auto-populates the question's options from the template |
| ASGN-03 | 12 | Options are locked while a template is assigned (cannot edit per-question) |
| ASGN-04 | 12 | Admin can detach a question from its template to customize options independently |
| ASGN-05 | 12 | Admin can change the template assignment on an existing question |
| REND-01 | 13 | All questions using the same template display options in identical order |
| REND-02 | 13 | Same color mapping applied consistently across all template-linked questions |
| REND-03 | 13 | Identical button layout and sizing in participant voting view for template-linked questions |
| EXPT-01 | 14 | Response templates included in JSON session export |
| EXPT-02 | 14 | Templates restored when importing JSON (deduplicated by name if template already exists) |
| EXPT-03 | 14 | Template-question associations preserved through export/import round-trip |

**Coverage:** 16/16 requirements mapped (100%)

## Dependencies

```
Phase 11 (Template CRUD)
    ↓
Phase 12 (Assignment & Defaults)
    ↓
Phase 13 (Consistent Rendering)
    ↓
Phase 14 (Export/Import)
    ↓
Phase 15 (Admin Results Ordering) — tech debt closure
```

Linear dependency chain: each phase builds on previous. No parallel work possible.

---
*Created: 2026-02-09*
