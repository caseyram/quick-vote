# Roadmap: QuickVote

## Milestones

- **v1.0 MVP** - Phases 1-5 (shipped 2026-01-28)
- **v1.1 Batch Questions & Polish** - Phases 6-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) - SHIPPED 2026-01-28</summary>

See git history for v1.0 implementation details. Milestone delivered:
- Live admin-pushed voting sessions
- Real-time participant voting
- Results visualization with word clouds
- Session management and question CRUD
- Projection mode for displays

</details>

### v1.1 Batch Questions & Polish (In Progress)

**Milestone Goal:** Enable self-paced batch voting mode with on-the-fly batch creation, session management improvements, and results polish.

- [x] **Phase 6: Batch Schema & UI** - Admin can create and manage batches on-the-fly
- [x] **Phase 7: Batch Activation** - Admin activates batch for participant self-paced voting
- [x] **Phase 8: Participant Batch Experience** - Participants navigate and complete batch questions at their own pace
- [ ] **Phase 9: Session Management** - Global admin URL, session list, review past sessions, export/import
- [ ] **Phase 10: Progress Dashboard & Results Polish** - Real-time progress monitoring and improved results UX

## Phase Details

### Phase 6: Batch Schema & UI
**Goal**: Admin can create questions on-the-fly and organize them into named batches within a session
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: BATCH-01, BATCH-02
**Success Criteria** (what must be TRUE):
  1. Admin can create a new batch within a session and give it a name
  2. Admin can add questions to a batch on-the-fly (create question and assign to batch in one flow)
  3. Admin can create multiple batches within the same session
  4. Admin can see which questions belong to which batch
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Database schema & types (batches table, Batch type, store methods)
- [x] 06-02-PLAN.md — Batch UI components (BatchCard, BatchList, drag-and-drop with dnd-kit)
- [x] 06-03-PLAN.md — Admin session integration (wire components to Supabase, inline question creation)

### Phase 7: Batch Activation
**Goal**: Admin can activate a batch so participants receive all questions at once for self-paced voting
**Depends on**: Phase 6
**Requirements**: BATCH-03
**Success Criteria** (what must be TRUE):
  1. Admin can activate a batch from the session admin view
  2. When batch is activated, participants receive all batch questions simultaneously (not one-at-a-time push)
  3. Admin can see that a batch is currently active
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — Database status column and Zustand activeBatchId state
- [x] 07-02-PLAN.md — Activation UI and handlers (Activate/Close button, mode exclusion, broadcasts)

### Phase 8: Participant Batch Experience
**Goal**: Participants can navigate, answer, review, and submit batch questions at their own pace
**Depends on**: Phase 7
**Requirements**: BATCH-04, BATCH-05, BATCH-06, BATCH-07, BATCH-08, BATCH-09, BATCH-10
**Success Criteria** (what must be TRUE):
  1. Participant sees all batch questions and can navigate with Next/Previous buttons
  2. Participant sees progress indicator showing current position ("Question 3 of 10")
  3. Participant answers persist when navigating between questions (vote saved immediately)
  4. Participant can use arrow keys to navigate batch questions on desktop
  5. Participant sees visual answer review before final submit showing all their responses
  6. Participant can submit/complete the batch when finished answering
  7. Participant sees completion animation when answering each question
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — Wire batch_activated/batch_closed listeners in ParticipantSession
- [x] 08-02-PLAN.md — Create BatchVotingCarousel with Next/Previous navigation and progress indicator
- [x] 08-03-PLAN.md — Add keyboard navigation and completion animation
- [x] 08-04-PLAN.md — Gap closure: Add answer review screen before batch completion

### Phase 9: Session Management
**Goal**: Admin has a global entry point to manage all sessions with review and export capabilities
**Depends on**: Phase 8
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05
**Success Criteria** (what must be TRUE):
  1. Admin can access /admin URL to see list of all sessions
  2. Session list is ordered by timestamp with most recent first
  3. Admin can reopen a past session to review its results
  4. Admin can export a session as JSON with questions grouped by batch and including votes/reasons
  5. Admin can import questions from a JSON file that preserves batch groupings
**Plans**: 5 plans

Plans:
- [ ] 09-01-PLAN.md — /admin route and session list (search, delete, new session)
- [ ] 09-02-PLAN.md — JSON export library with Zod schemas
- [ ] 09-03-PLAN.md — Session review page with batch-grouped results and export wiring
- [ ] 09-04-PLAN.md — JSON import library and ImportSessionPanel component
- [ ] 09-05-PLAN.md — Wire import panel into AdminSession and verify end-to-end

### Phase 10: Progress Dashboard & Results Polish
**Goal**: Admin can monitor batch completion in real-time and results view has improved UX
**Depends on**: Phase 9
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, RESL-01, RESL-02, RESL-03, RESL-04
**Success Criteria** (what must be TRUE):
  1. Admin sees count of participants who have completed the batch
  2. Admin sees count of participants still in progress
  3. Admin sees per-question response counts
  4. Progress dashboard updates in real-time as participants answer
  5. Admin can mark individual reasons as read
  6. Results columns display in consistent order (agree/disagree positions stable)
  7. Results view uses horizontal space efficiently (less vertical scrolling)
  8. Admin can navigate between questions using left/right arrow buttons in results view
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 16/16 | Complete | 2026-01-28 |
| 6. Batch Schema & UI | v1.1 | 3/3 | Complete | 2026-01-28 |
| 7. Batch Activation | v1.1 | 2/2 | Complete | 2026-01-28 |
| 8. Participant Batch Experience | v1.1 | 4/4 | Complete | 2026-01-28 |
| 9. Session Management | v1.1 | 0/5 | Planned | - |
| 10. Progress Dashboard & Results Polish | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-28*
*Last updated: 2026-01-28 - Phase 9 planned (5 plans)*
