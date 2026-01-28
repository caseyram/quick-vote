# Requirements: QuickVote v1.1

**Defined:** 2026-01-28
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile — not like filling out a form.

## v1.1 Requirements

Requirements for batch questions and polish milestone. Each maps to roadmap phases.

### Batch Questions

- [x] **BATCH-01**: Admin can create questions on-the-fly and group them into a named batch
- [x] **BATCH-02**: Admin can create multiple batches within a single session
- [x] **BATCH-03**: Admin can activate a batch (all questions delivered to participants at once)
- [x] **BATCH-04**: Participant sees all batch questions and can navigate with Next/Previous buttons
- [x] **BATCH-05**: Participant sees progress indicator ("Question 3 of 10")
- [x] **BATCH-06**: Participant answers persist when navigating between questions
- [x] **BATCH-07**: Participant can submit/complete the batch when finished
- [x] **BATCH-08**: Participant can use arrow keys to navigate batch questions (desktop)
- [x] **BATCH-09**: Participant sees visual answer review before final submit
- [x] **BATCH-10**: Participant sees completion animation per question answered

### Session Management

- [ ] **SESS-01**: Global admin URL (/admin) shows list of all sessions
- [ ] **SESS-02**: Session list ordered by timestamp, most recent first
- [ ] **SESS-03**: Admin can reopen a past session to review results
- [ ] **SESS-04**: Admin can export session as JSON (questions grouped by batch, with votes/reasons)
- [ ] **SESS-05**: Admin can import questions from JSON file (preserves batch groupings)

### Progress Dashboard

- [ ] **PROG-01**: Admin sees count of participants who completed the batch
- [ ] **PROG-02**: Admin sees count of participants in progress
- [ ] **PROG-03**: Admin sees per-question response counts
- [ ] **PROG-04**: Progress dashboard updates in real-time as participants answer

### Results Improvements

- [ ] **RESL-01**: Admin can mark individual reasons as read
- [ ] **RESL-02**: Results columns show in consistent order (agree always same position)
- [ ] **RESL-03**: Results view uses horizontal space better to reduce vertical scrolling
- [ ] **RESL-04**: Admin can navigate between questions with left/right arrow buttons in results view

## Future Requirements

Acknowledged but deferred to later milestones.

### Collections (Deprioritized)

- **COLL-01**: Admin can create a named collection of reusable questions
- **COLL-02**: Admin can add/remove questions from a collection
- **COLL-03**: Admin can load a collection into a session
- **COLL-04**: Admin can import a collection from JSON file
- **COLL-05**: Admin can export a collection as JSON file

### Advanced Batch Features

- **BATCH-F01**: Swipe gesture navigation for mobile participants
- **BATCH-F02**: Hybrid mode (mix of live single questions and batches in same session)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Skip logic / branching | High complexity, low value for short voting sessions |
| Required questions / validation | Voting context tolerates incomplete responses |
| Per-question time limits in batch | Contradicts self-paced concept |
| Auto-advance after answer | Removes participant control |
| Partial save / resume later | Batch sessions designed for single sitting |
| User accounts / authentication | Keep admin access simple via URLs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BATCH-01 | Phase 6 | Complete |
| BATCH-02 | Phase 6 | Complete |
| BATCH-03 | Phase 7 | Complete |
| BATCH-04 | Phase 8 | Complete |
| BATCH-05 | Phase 8 | Complete |
| BATCH-06 | Phase 8 | Complete |
| BATCH-07 | Phase 8 | Complete |
| BATCH-08 | Phase 8 | Complete |
| BATCH-09 | Phase 8 | Complete |
| BATCH-10 | Phase 8 | Complete |
| SESS-01 | Phase 9 | Pending |
| SESS-02 | Phase 9 | Pending |
| SESS-03 | Phase 9 | Pending |
| SESS-04 | Phase 9 | Pending |
| SESS-05 | Phase 9 | Pending |
| PROG-01 | Phase 10 | Pending |
| PROG-02 | Phase 10 | Pending |
| PROG-03 | Phase 10 | Pending |
| PROG-04 | Phase 10 | Pending |
| RESL-01 | Phase 10 | Pending |
| RESL-02 | Phase 10 | Pending |
| RESL-03 | Phase 10 | Pending |
| RESL-04 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 - BATCH-04 to BATCH-10 complete (Phase 8)*
