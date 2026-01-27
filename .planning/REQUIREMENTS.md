# Requirements: QuickVote

**Defined:** 2026-01-27
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Management

- [ ] **SESS-01**: Admin can create a session via unique link (no account required)
- [ ] **SESS-02**: Admin can add, edit, and reorder questions within a session
- [ ] **SESS-03**: Sessions are persisted in Supabase -- admin can revisit past sessions and results

### Voting

- [ ] **VOTE-01**: Participants can vote Agree or Disagree on a statement
- [ ] **VOTE-02**: Participants can pick one option from multiple choices
- [ ] **VOTE-03**: Participants can change their vote until they explicitly lock in or the admin ends the round
- [ ] **VOTE-04**: Admin can configure per-question whether voting is anonymous or named

### Live Session

- [ ] **LIVE-01**: Admin can advance questions, close voting, and reveal results
- [ ] **LIVE-02**: Admin can set an optional countdown timer that auto-closes voting
- [ ] **LIVE-03**: Results display as a live-updating bar chart as votes arrive
- [ ] **LIVE-04**: Admin can see how many participants are connected

### Participant Joining

- [ ] **JOIN-01**: Admin can display a QR code that participants scan to join the session
- [ ] **JOIN-02**: Participants see a lobby/waiting screen until the session starts
- [ ] **JOIN-03**: Participants who join mid-session land on the current active question
- [ ] **JOIN-04**: Participants see visual confirmation that their vote was received

### UI/Experience

- [ ] **UIEX-01**: Voting UI is full-screen and tactile with large tap targets and satisfying animations
- [ ] **UIEX-02**: Responsive design works on phones (participants) and desktop (admin)
- [ ] **UIEX-03**: Connection status indicator shows if participant is connected or disconnected

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Session Modes

- **MODE-01**: Self-paced survey mode where participants work through questions independently
- **MODE-02**: Session history list -- admin can browse all past sessions

### Advanced Voting

- **ADVT-01**: Ranked choice voting -- participants order several options by preference
- **ADVT-02**: Participant can provide a text reason with their vote
- **ADVT-03**: Pie chart as an alternative results visualization

### Export

- **EXPT-01**: Export session results as CSV
- **EXPT-02**: Export session results as PDF

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Kills instant-join UX -- admin uses simple link, no login |
| Real-time chat or discussion | Moderation burden, not core to voting value |
| Multi-admin session management | Complexity not justified for v1 -- single admin per session |
| Mobile native app | Web-first, responsive design sufficient |
| Presentation builder | Scope trap -- admin creates questions, not slides |
| Email collection from participants | Trust destroyer -- participants should feel safe |
| Complex admin dashboard | Kills simplicity -- the product is about quick, focused voting |
| OAuth / social login | No accounts at all -- not even simple ones |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 2 | Pending |
| SESS-02 | Phase 2 | Pending |
| SESS-03 | Phase 2 | Pending |
| VOTE-01 | Phase 3 | Pending |
| VOTE-02 | Phase 3 | Pending |
| VOTE-03 | Phase 3 | Pending |
| VOTE-04 | Phase 3 | Pending |
| LIVE-01 | Phase 4 | Pending |
| LIVE-02 | Phase 4 | Pending |
| LIVE-03 | Phase 4 | Pending |
| LIVE-04 | Phase 4 | Pending |
| JOIN-01 | Phase 3 | Pending |
| JOIN-02 | Phase 3 | Pending |
| JOIN-03 | Phase 3 | Pending |
| JOIN-04 | Phase 3 | Pending |
| UIEX-01 | Phase 5 | Pending |
| UIEX-02 | Phase 5 | Pending |
| UIEX-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0
- Note: Phase 1 (Integration Spike) has no requirements -- infrastructure validation only

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after roadmap revision (phase renumbering)*
