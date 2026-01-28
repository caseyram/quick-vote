# Project Research Summary

**Project:** QuickVote v1.1 - Batch Questions & Polish
**Domain:** Self-paced voting, question collections, batch survey mode
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

QuickVote v1.1 extends a working live polling system with two orthogonal concepts: **collections** (named, reusable question groups for library/sharing) and **batches** (runtime self-paced voting mode). The existing stack handles 90% of requirements with minimal additions -- Motion v12 already includes gesture support for swipe navigation, Zustand's persist middleware handles local progress, and the only new dependency recommended is Zod v4 for robust JSON schema validation during collection import/export. The architecture adds one new table (`collections`), two columns on `questions`, and a `batch_progress` table for participant tracking.

The recommended approach is to build collections infrastructure first (no realtime complexity), then batch activation mechanics, then participant self-paced UI, and finally the admin progress dashboard. This order follows natural dependencies: collections are pure CRUD, batch mode requires schema changes before participant UI can be built, and progress tracking requires the batch infrastructure to exist. The existing single-channel-per-session realtime pattern extends cleanly with new broadcast events (`batch_activated`, `batch_ended`) without structural changes.

The primary risk is **mode confusion** -- participants not knowing whether to wait for the admin (live mode) or proceed at their own pace (batch mode). This is the #1 pitfall and must be addressed with explicit visual differentiation, clear mode indicators, and distinct entry experiences. Secondary risks include progress state inconsistency between client and server, silent import failures on malformed JSON, and live/batch state accidentally sharing where they shouldn't. All critical pitfalls have clear prevention strategies documented.

## Key Findings

### Recommended Stack

The existing stack (React 19, Motion v12, Zustand v5, Supabase) handles batch mode requirements with one addition.

**Core technologies:**
- **Motion v12** (existing): Gestures for swipe navigation -- `drag`, `onPan`, `onDragEnd` for card-based navigation with velocity detection
- **Zustand v5 persist middleware** (existing): Local progress tracking -- stores batch progress in localStorage, survives page refresh
- **Zod v4** (new, ~12KB): JSON schema validation -- declarative validation with TypeScript inference and user-friendly error messages via `z.prettifyError()`

**Explicitly rejected:**
- @use-gesture/react (Motion already covers this)
- PowerSync/RxDB (overkill for batch-submit-on-complete pattern)
- react-hotkeys-hook (native event handling sufficient for 3 keys)
- Valibot (smaller but less documentation, Zod's error messages are better for user-facing import)

### Expected Features

**Must have (table stakes):**
- Participant-controlled question navigation (Next/Previous)
- Progress indicator ("Question 3 of 10")
- Submit/Complete action
- Answers persist across navigation
- Admin progress dashboard (completion count, in-progress count)
- Collection CRUD (create, name, add questions)
- Load collection into session (copies questions)
- Collection JSON export/import

**Should have (differentiators):**
- Swipe-based navigation (maintains "tactile" identity)
- Visual answer review before submit
- Per-question completion animation
- On-the-fly batch creation from existing questions

**Defer (v2+):**
- Skip logic / conditional branching (high complexity, low value for short sessions)
- Collection versioning (enterprise feature)
- Hybrid live+batch mode (complex state management)
- Partial save / resume later (requires identity system)
- Collection hierarchy (folders, tags)

### Architecture Approach

Collections and batches are orthogonal -- collections are a storage/organization feature; batches are a runtime/session-mode feature. The key insight is that self-paced batch mode is a **different state machine** than live mode: participants control their own progression, so the admin no longer broadcasts per-question state changes. Instead, participants track progress locally and sync completion status back to the server.

**Major components:**
1. **CollectionManager** -- CRUD for collections, import/export JSON (Supabase DB only)
2. **BatchActivator** -- UI for selecting questions, creating batch (session-store, Broadcast)
3. **BatchVotingView** -- Participant multi-question navigation (session-store, Supabase DB)
4. **BatchProgressDashboard** -- Admin view of participant completion (Postgres Changes, session-store)

**Schema additions:**
- `collections` table (name, description, created_by)
- `collection_questions` table (question templates in collections)
- `batch_id` column on `questions` (groups questions into batches)
- `mode` and `active_batch_id` columns on `sessions`
- `batch_progress` table (per-participant, per-question completion tracking)

### Critical Pitfalls

1. **Mode Confusion** (CRITICAL) -- Participants don't know whether to wait or proceed. Prevent with explicit visual mode indicators, different entry animations, "Self-paced" vs "Live" badge on every screen, first-time tutorial for batch mode.

2. **Progress State Inconsistency** (CRITICAL) -- Client and server progress diverge after refresh or network issues. Prevent with server-side `batch_progress` table as source of truth, client initializes from server on mount, optimistic navigation with server confirmation.

3. **Collection Import Fails Silently** (CRITICAL) -- Malformed JSON causes unhelpful errors or corrupted data. Prevent with Zod schema validation producing per-field errors, validate-before-insert (atomic), preview before import, export format versioning.

4. **Live and Batch Modes Share State** (CRITICAL) -- Accidentally reading/writing `activeQuestionId` in batch mode causes bizarre cross-participant coupling. Prevent with clearly separated store state, mode-check guards, document state ownership.

5. **Batch Navigation Loses Vote State** (MODERATE) -- Navigating away loses answers. Prevented by existing pattern (votes submit immediately via UPSERT), but must load existing vote when rendering question and show "Already answered" indicator.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Collections Foundation

**Rationale:** Collections are pure CRUD with no realtime complexity. Building them first establishes the data model and import/export patterns before tackling the more complex batch mode.

**Delivers:** Admin can create, manage, and import collections into sessions.

**Addresses:**
- Collection CRUD (create, name, add questions)
- Load collection into session
- Collection JSON export/import

**Avoids:** Pitfall 3 (import validation), Pitfall 7 (naming collisions), Pitfall 10 (round-trip fidelity)

**Uses:** Zod v4 for import validation

### Phase 2: Batch Schema & Activation

**Rationale:** Batch mode requires schema changes (`batch_id` on questions, `mode` on sessions, `batch_progress` table) before participant UI can be built. This phase establishes the data foundation.

**Delivers:** Admin can select questions and activate a batch (participants don't react yet).

**Addresses:**
- Session mode selection
- Batch activation mechanics
- Progress tracking infrastructure

**Avoids:** Pitfall 2 (progress inconsistency), Pitfall 4 (shared state)

**Implements:** Schema additions, new broadcast events (`batch_activated`, `batch_ended`)

### Phase 3: Participant Batch Experience

**Rationale:** With batch infrastructure in place, build the participant-facing self-paced UI. This is where mode confusion risk is highest.

**Delivers:** Participants can complete a batch at their own pace with navigation.

**Addresses:**
- Participant-controlled navigation (Next/Previous/Swipe)
- Progress indicator
- Submit/Complete action
- Answers persist across navigation

**Avoids:** Pitfall 1 (mode confusion), Pitfall 5 (lost vote state), Pitfall 9 (navigation edges)

**Uses:** Motion v12 gestures, Zustand persist middleware

### Phase 4: Admin Progress Dashboard

**Rationale:** With participants generating progress data, build admin visibility. Depends on `batch_progress` table from Phase 2.

**Delivers:** Admin sees real-time participant completion status.

**Addresses:**
- Completion count
- In-progress count
- Per-question response counts
- Real-time updates

**Avoids:** Pitfall 6 (inefficient polling)

**Uses:** Postgres Changes subscription on `batch_progress` table

### Phase 5: Results & Polish

**Rationale:** Final polish phase addresses results view improvements and edge cases.

**Delivers:** Improved results UX, late joiner handling, review mode.

**Addresses:**
- Mark as read
- Consistent ordering
- Reduce scrolling
- Late joiner in batch mode
- Review mode for participants

**Avoids:** Pitfall 8 (mark as read persistence), Pitfall 11 (column ordering)

### Phase Ordering Rationale

- **Collections first:** No dependencies on batch mode, establishes import/export patterns
- **Schema before UI:** Batch participant UI cannot be built without `batch_id`, `mode`, `batch_progress`
- **Participant UI before dashboard:** Dashboard displays data generated by participant actions
- **Polish last:** Edge cases and improvements after core functionality works

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3 (Participant Batch Experience):** Swipe gesture implementation details, accessibility considerations for swipe-vs-buttons, keyboard navigation scoping

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Collections Foundation):** Standard CRUD, Zod validation is well-documented
- **Phase 2 (Batch Schema):** Schema design is straightforward, follows existing patterns
- **Phase 4 (Progress Dashboard):** Postgres Changes pattern already proven in v1.0 vote streaming
- **Phase 5 (Results & Polish):** Incremental improvements on existing components

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via official Motion, Zustand, Zod documentation |
| Features | MEDIUM-HIGH | Multiple sources agree (Mentimeter, Vevox, QuestionPro) |
| Architecture | HIGH | Builds on verified v1.0 patterns, minimal new components |
| Pitfalls | MEDIUM-HIGH | Based on codebase analysis and analogous systems |

**Overall confidence:** HIGH

### Gaps to Address

- **Timer behavior in batch mode:** Research didn't definitively resolve whether batch sessions should have timers. Recommendation: no per-question timer (contradicts self-paced), but session-level timeout is acceptable. Document design decision before Phase 2.

- **Large batch handling (20+ questions):** Current design assumes linear navigation works. May need "jump to question" dropdown for long batches. Validate during Phase 3 implementation.

- **Multi-device progress sync:** Current design uses `batch_progress` table which handles this, but the "resume on different device" UX isn't fully designed. Address in Phase 3 if scope allows.

## Sources

### Primary (HIGH confidence)
- [Motion Gestures Documentation](https://motion.dev/docs/react-gestures) -- drag, pan, swipe patterns
- [Motion Drag Guide](https://motion.dev/docs/react-drag) -- drag constraints, momentum
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist) -- localStorage persistence
- [Zod Official Documentation](https://zod.dev/) -- schema validation, error formatting
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime) -- channel patterns, Postgres Changes

### Secondary (MEDIUM confidence)
- [Mentimeter: Voting Pace Guide](https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace) -- live vs self-paced patterns
- [Vevox: Live polling vs surveys](https://help.vevox.com/hc/en-us/articles/360010481817-Live-polling-vs-surveys-what-s-the-difference) -- mode separation UX
- [QuestionPro: Navigation Buttons](https://www.questionpro.com/features/button.html) -- survey navigation standards
- [SurveyJS: Create a Simple Survey](https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey) -- JSON schema patterns

### Tertiary (needs validation)
- Swipe UX research (Springer) -- benefits claimed but implementation-dependent
- Collection picker scaling -- depends on actual usage patterns

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
