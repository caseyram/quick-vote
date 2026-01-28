# Requirements: QuickVote v1.1

**Defined:** 2026-01-28
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile — not like filling out a form.

## v1.1 Requirements

Requirements for batch questions and polish milestone. Each maps to roadmap phases.

### Collections

- [ ] **COLL-01**: Admin can create a named collection of questions
- [ ] **COLL-02**: Admin can add existing questions to a collection
- [ ] **COLL-03**: Admin can remove questions from a collection
- [ ] **COLL-04**: Admin can edit collection name
- [ ] **COLL-05**: Admin can delete a collection
- [ ] **COLL-06**: Admin can load a collection into a session (copies questions)
- [ ] **COLL-07**: Admin can export a collection as JSON file
- [ ] **COLL-08**: Admin can import a collection from JSON file
- [ ] **COLL-09**: Admin can create a batch on-the-fly from selected session questions

### Batch Mode

- [ ] **BATCH-01**: Admin can set session mode (live or batch) when activating questions
- [ ] **BATCH-02**: Participant sees all batch questions and can navigate with Next/Previous buttons
- [ ] **BATCH-03**: Participant sees progress indicator ("Question 3 of 10")
- [ ] **BATCH-04**: Participant answers persist when navigating between questions
- [ ] **BATCH-05**: Participant can submit/complete the batch when finished
- [ ] **BATCH-06**: Participant can use arrow keys to navigate batch questions (desktop)
- [ ] **BATCH-07**: Participant sees visual answer review before final submit
- [ ] **BATCH-08**: Participant sees completion animation per question answered

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

### Advanced Batch Features

- **BATCH-F01**: Swipe gesture navigation for mobile participants
- **BATCH-F02**: Hybrid mode (mix of live and batch questions in same session)
- **BATCH-F03**: Skip logic / conditional branching
- **BATCH-F04**: Save progress and resume later

### Collection Enhancements

- **COLL-F01**: Collection versioning
- **COLL-F02**: Public collection library (share across users)
- **COLL-F03**: Collection folders/categories

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Skip logic / branching | High complexity, low value for short voting sessions (5-15 questions) |
| Required questions / validation | Voting context tolerates incomplete responses; adds friction |
| Per-question time limits in batch | Contradicts self-paced concept |
| Auto-advance after answer | Removes participant control |
| Partial save / resume later | Requires identity system; batch sessions designed for single sitting |
| Complex collection hierarchy | Over-engineering; flat list sufficient |
| Collection sharing / permissions | Requires user accounts |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLL-01 | — | Pending |
| COLL-02 | — | Pending |
| COLL-03 | — | Pending |
| COLL-04 | — | Pending |
| COLL-05 | — | Pending |
| COLL-06 | — | Pending |
| COLL-07 | — | Pending |
| COLL-08 | — | Pending |
| COLL-09 | — | Pending |
| BATCH-01 | — | Pending |
| BATCH-02 | — | Pending |
| BATCH-03 | — | Pending |
| BATCH-04 | — | Pending |
| BATCH-05 | — | Pending |
| BATCH-06 | — | Pending |
| BATCH-07 | — | Pending |
| BATCH-08 | — | Pending |
| PROG-01 | — | Pending |
| PROG-02 | — | Pending |
| PROG-03 | — | Pending |
| PROG-04 | — | Pending |
| RESL-01 | — | Pending |
| RESL-02 | — | Pending |
| RESL-03 | — | Pending |
| RESL-04 | — | Pending |

**Coverage:**
- v1.1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 (pending roadmap)

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after initial definition*
