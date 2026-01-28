# Requirements: QuickVote

**Defined:** 2026-01-27
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Management

- [x] **SESS-01**: Admin can create a session via unique link (no account required)
- [x] **SESS-02**: Admin can add, edit, and reorder questions within a session
- [x] **SESS-03**: Sessions are persisted in Supabase -- admin can revisit past sessions and results

### Voting

- [x] **VOTE-01**: Participants can vote Agree or Disagree on a statement
- [x] **VOTE-02**: Participants can pick one option from multiple choices
- [x] **VOTE-03**: Participants can change their vote until they explicitly lock in or the admin ends the round
- [x] **VOTE-04**: Admin can configure per-question whether voting is anonymous or named

### Live Session

- [x] **LIVE-01**: Admin can advance questions, close voting, and reveal results
- [x] **LIVE-02**: Admin can set an optional countdown timer that auto-closes voting
- [x] **LIVE-03**: Results display as a live-updating bar chart as votes arrive
- [x] **LIVE-04**: Admin can see how many participants are connected

### Participant Joining

- [x] **JOIN-01**: Admin can display a QR code that participants scan to join the session
- [x] **JOIN-02**: Participants see a lobby/waiting screen until the session starts
- [x] **JOIN-03**: Participants who join mid-session land on the current active question
- [x] **JOIN-04**: Participants see visual confirmation that their vote was received

### UI/Experience

- [x] **UIEX-01**: Voting UI is full-screen and tactile with large tap targets and satisfying animations
- [x] **UIEX-02**: Responsive design works on phones (participants) and desktop (admin)
- [x] **UIEX-03**: Connection status indicator shows if participant is connected or disconnected

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
| SESS-01 | Phase 2 | Complete |
| SESS-02 | Phase 2 | Complete |
| SESS-03 | Phase 2 | Complete |
| VOTE-01 | Phase 3 | Complete |
| VOTE-02 | Phase 3 | Complete |
| VOTE-03 | Phase 3 | Complete |
| VOTE-04 | Phase 3 | Complete |
| LIVE-01 | Phase 4 | Complete |
| LIVE-02 | Phase 4 | Complete |
| LIVE-03 | Phase 4 | Complete |
| LIVE-04 | Phase 4 | Complete |
| JOIN-01 | Phase 3 | Complete |
| JOIN-02 | Phase 3 | Complete |
| JOIN-03 | Phase 3 | Complete |
| JOIN-04 | Phase 3 | Complete |
| UIEX-01 | Phase 5 | Complete |
| UIEX-02 | Phase 5 | Complete |
| UIEX-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0
- Note: Phase 1 (Integration Spike) has no requirements -- infrastructure validation only

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-28 -- Phase 5 complete (UIEX-01..03 verified), all 18/18 v1 requirements satisfied*
