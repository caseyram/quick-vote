# State: QuickVote

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.
**Stack:** Vite + React (TypeScript), Supabase (database + realtime), Vercel deployment
**Repo:** C:/code/quick-vote

## Current Position

**Milestone:** v1.2 Response Templates
**Phase:** 12 (in progress)
**Plan:** 2 of 3 complete
**Status:** Phase 12 in progress — template assignment UI complete
**Last activity:** 2026-02-09 — Completed 12-02-PLAN.md

Progress: [██████░░░░░░░░░░░░░░] 33% (1.33/4 phases)

**Current Focus:** Session default template settings UI.

**Next Action:** Execute Phase 12 Plan 03 (Session settings UI)

## Milestone History

| Version | Name | Shipped | Phases | Plans |
|---------|------|---------|--------|-------|
| v1.0 | MVP | 2026-01-28 | 1-5 | 16 |
| v1.1 | Batch Questions & Polish | 2026-01-29 | 6-10 (+09.1) | 18 |

See `.planning/MILESTONES.md` for full details.
See `.planning/milestones/` for archived roadmaps and requirements.

## Performance Metrics

**v1.0 (Phases 1-5):**
- Plans: 16
- Avg plans/phase: 3.2
- Delivered: All requirements

**v1.1 (Phases 6-10 + 09.1):**
- Plans: 18
- Avg plans/phase: 3.0
- Delivered: All requirements
- Inserted phases: 1 (Phase 09.1)

**v1.2 Target:**
- Phases: 4
- Requirements: 16
- Expected plans: ~12-14 (3-4 per phase)

**v1.2 Phase 11:**
- Plans: 3
- Completed: 2026-02-09
- Requirements: TMPL-01, TMPL-02, TMPL-03, TMPL-04 (all verified)

**v1.2 Phase 12:**
- Plans: 2 of 3 complete
- In progress: 2026-02-09
- Next: Session settings UI for default template

## Accumulated Context

### Key Decisions

See PROJECT.md for full decision log.

**v1.2 Approach:**
- Templates stored globally in Supabase (not session-specific)
- Templates locked to questions (cannot edit options while template assigned)
- Session-level default template for faster question creation
- Export/import includes templates with deduplication by name

**Phase 11 (Template Database & CRUD):**
- JSONB array storage for options (simpler than normalized table)
- ON DELETE SET NULL preserves question options when template deleted
- Global RLS policies (all authenticated users can CRUD templates)
- Unique constraint on template name with code 23505 error handling
- Alphabetical sorting in store for consistent ordering
- Inline PL/pgSQL trigger function for updated_at (moddatetime extension unavailable)
- Modal overlay close requires mousedown+mouseup on overlay (prevents text selection drift)
- Unsaved changes confirmation on Cancel/overlay close

**Phase 12 (Template Assignment & Defaults) - In Progress:**
- Nullable FK session.default_template_id for per-session defaults
- checkQuestionVotes(questionId) helper for vote-based validation
- Spread merge pattern in Zustand to prevent field loss on updates
- Session store method setSessionDefaultTemplate(templateId) for persistence
- TemplateSelector uses native HTML select (not react-select) for consistency
- Locked/unlocked option modes: read-only gray boxes when template assigned
- Detach forks template options as editable (no data loss)
- Replace confirmation when switching from custom to template
- Vote guard blocks template changes on questions with votes
- Session default template pre-selected in QuestionForm create mode

### Potential Next Features

From v1.1 deferred requirements:
- Collections (reusable question sets): COLL-01 to COLL-05
- Mobile swipe gesture navigation: BATCH-F01
- Hybrid mode (mix live + batch): BATCH-F02

Other possibilities:
- CSV/PDF export of results
- Ranked choice voting
- Performance optimizations for larger scale

### Open Questions

(none)

### Blockers

(none)

## Session Continuity

**Last session:** 2026-02-09 — Completed Phase 12 Plan 02
**Stopped at:** Template assignment UI complete (TemplateSelector, QuestionForm with locked/unlocked modes)
**Next action:** Execute Phase 12 Plan 03 (Session settings UI for default template)
**Resume file:** None

---
*State initialized: 2026-01-27*
*Updated: 2026-02-09 — Phase 12 Plan 02 complete*
