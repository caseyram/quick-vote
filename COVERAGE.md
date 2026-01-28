# Code Coverage Report

**Generated:** January 2026
**Tool:** Vitest + @vitest/coverage-v8
**Result:** 334 tests across 32 test files

## Summary

| Metric | Coverage |
|--------|----------|
| **Statements** | **85.79%** |
| **Branches** | 84.99% |
| **Functions** | 77.77% |
| **Lines** | 85.79% |

---

## Coverage by Area

### Pages (`src/pages/`) — 82.21% statements

Top-level route components that orchestrate the full user experience.

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| Home.tsx | 96.29% | 86.66% | 75% | Landing page with session creation and past sessions |
| ParticipantSession.tsx | 87.52% | 87.50% | 100% | Participant voting interface with lobby, voting, waiting, and results views |
| AdminSession.tsx | 77.89% | 79.67% | 57.89% | Admin control panel for running live sessions (draft, lobby, active, ended views) |
| *Demo.tsx* | *excluded* | | | *Test/demo page, excluded from coverage* |

**Gaps:** AdminSession's `ActiveQuestionHero` sub-component reasons panel (lines 924-971) requires complex async state setup involving local vote state populated via realtime subscriptions. ParticipantSession's unreachable fallback paths (lines 320, 548-553) and reconnection refetch (line 328) account for most missing coverage.

---

### Components (`src/components/`) — 88% statements

Reusable UI components covering voting interfaces, admin controls, and session management.

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| AdminPasswordGate.tsx | 100% | 100% | 100% | Password prompt wrapper for admin pages |
| BarChart.tsx | 100% | 88.88% | 100% | Horizontal bar chart for vote results |
| ConnectionBanner.tsx | 100% | 100% | 100% | Full-width reconnection status banner |
| ConnectionPill.tsx | 100% | 100% | 100% | Compact connection status indicator |
| CountdownTimer.tsx | 100% | 100% | 100% | Animated countdown with color transitions |
| Lobby.tsx | 100% | 100% | 100% | Waiting screen for participants |
| ParticipantCount.tsx | 100% | 100% | 100% | Connected participant counter |
| QRCode.tsx | 100% | 100% | 100% | QR code overlay and centered display |
| ReasonInput.tsx | 100% | 92.30% | 100% | Inline text input for vote reasoning |
| VoteAgreeDisagree.tsx | 97.04% | 72.22% | 57.14% | Agree/Sometimes/Disagree vote interface |
| VoteMultipleChoice.tsx | 96.55% | 76.66% | 80% | Multiple choice vote interface |
| AdminControlBar.tsx | 97% | 86.84% | 85.71% | Fixed bottom admin toolbar |
| SessionResults.tsx | 95.16% | 72.54% | 100% | Post-session results summary |
| AdminQuestionControl.tsx | 85.45% | 79.59% | 83.33% | Per-question admin controls (start, close, results) |
| TemplatePanel.tsx | 80.85% | 81.25% | 62.50% | Save/load question templates from localStorage |
| ImportExportPanel.tsx | 75.78% | 84.61% | 83.33% | JSON import/export for questions |
| QuestionList.tsx | 72.47% | 93.75% | 28.57% | Draggable question list with edit/delete |
| QuestionForm.tsx | 71.50% | 77.77% | 70% | Add/edit question form |
| PastSessions.tsx | 68.03% | 66.66% | 33.33% | Past sessions list with resume/template actions |

**Gaps:** QuestionList and QuestionForm have lower function coverage because drag-and-drop reorder handlers and multi-step edit workflows are not fully exercised. PastSessions has async Supabase-fetched data paths that are partially covered.

---

### Hooks (`src/hooks/`) — 85.22% statements

Custom React hooks encapsulating reusable stateful logic.

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| use-auth.ts | 100% | 100% | 100% | Anonymous Supabase authentication initialization |
| use-countdown.ts | 100% | 90.90% | 100% | Drift-corrected countdown timer (100ms tick) |
| use-haptic.ts | 100% | 100% | 100% | Device vibration API wrapper |
| use-presence.ts | 93.87% | 100% | 100% | Participant presence tracking with 10s grace period |
| use-realtime-channel.ts | 63.01% | 73.33% | 100% | Supabase Realtime channel lifecycle management |

**Gaps:** `use-realtime-channel` has lower coverage because the presence-related code paths (lines 63-85: sync/leave/join listeners, lines 96-101: presence tracking after subscribe) are only exercised when `presenceConfig` is provided, which requires integration with the full channel lifecycle. The hook is tested for its core subscribe/status behavior.

---

### Libraries (`src/lib/`) — 80.62% statements

Pure utility modules and business logic.

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| admin-auth.ts | 100% | 100% | 100% | Password gate logic (env var check, sessionStorage) |
| vote-aggregation.ts | 100% | 80% | 100% | Vote counting and percentage calculation |
| question-templates.ts | 76.92% | 100% | 85.71% | Template CRUD, JSON conversion, bulk insert |
| supabase.ts | 55.55% | 0% | 100% | Supabase client initialization |

**Gaps:** `supabase.ts` has low coverage because its environment variable validation (lines 7-10) runs at module load time and throws on missing config -- this is intentionally untested to avoid breaking the test environment. `question-templates.ts` bulk insert function (lines 98-120) involves Supabase calls that are partially mocked.

---

### Stores (`src/stores/`) — 100% statements

Zustand state management.

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| session-store.ts | 100% | 100% | 100% | Central store for session, questions, votes, and connection state |

---

### App Root (`src/`) — 100% statements

| File | Statements | Branches | Functions | Description |
|------|-----------|----------|-----------|-------------|
| App.tsx | 100% | 100% | 100% | BrowserRouter with route definitions |

---

## Architecture Diagram

```
src/
  App.tsx ........................ 100%   Router (3 routes)
  pages/
    Home.tsx ..................... 96%    Session creation + past sessions
    AdminSession.tsx ............. 78%    Admin control panel (draft/lobby/active/ended)
    ParticipantSession.tsx ....... 88%    Participant experience (lobby/voting/waiting/results)
  components/
    AdminControlBar.tsx .......... 97%    Fixed bottom toolbar
    AdminPasswordGate.tsx ........ 100%   Password prompt gate
    AdminQuestionControl.tsx ..... 85%    Per-question controls
    BarChart.tsx ................. 100%   Vote result visualization
    ConnectionBanner.tsx ......... 100%   Reconnection banner
    ConnectionPill.tsx ........... 100%   Status indicator
    CountdownTimer.tsx ........... 100%   Timer display
    ImportExportPanel.tsx ........ 76%    JSON import/export
    Lobby.tsx .................... 100%   Waiting screen
    ParticipantCount.tsx ......... 100%   Participant counter
    PastSessions.tsx ............. 68%    Session history list
    QRCode.tsx ................... 100%   QR code display
    QuestionForm.tsx ............. 72%    Add/edit question form
    QuestionList.tsx ............. 72%    Question list with reorder
    ReasonInput.tsx .............. 100%   Vote reason input
    SessionResults.tsx ........... 95%    Final results view
    TemplatePanel.tsx ............ 81%    Template management
    VoteAgreeDisagree.tsx ........ 97%    Agree/disagree voting
    VoteMultipleChoice.tsx ....... 97%    Multiple choice voting
  hooks/
    use-auth.ts .................. 100%   Auth initialization
    use-countdown.ts ............. 100%   Countdown timer
    use-haptic.ts ................ 100%   Haptic feedback
    use-presence.ts .............. 94%    Presence tracking
    use-realtime-channel.ts ...... 63%    Channel lifecycle
  lib/
    admin-auth.ts ................ 100%   Password logic
    question-templates.ts ........ 77%    Template utilities
    supabase.ts .................. 56%    Client init
    vote-aggregation.ts .......... 100%   Vote math
  stores/
    session-store.ts ............. 100%   Zustand store
```

## Test File Inventory

| Test File | Tests |
|-----------|-------|
| src/App.test.tsx | 2 |
| src/components/AdminControlBar.test.tsx | 15 |
| src/components/AdminPasswordGate.test.tsx | 5 |
| src/components/AdminQuestionControl.test.tsx | 14 |
| src/components/BarChart.test.tsx | 10 |
| src/components/ConnectionBanner.test.tsx | 6 |
| src/components/ConnectionPill.test.tsx | 7 |
| src/components/CountdownTimer.test.tsx | 8 |
| src/components/ImportExportPanel.test.tsx | 6 |
| src/components/Lobby.test.tsx | 2 |
| src/components/ParticipantCount.test.tsx | 4 |
| src/components/PastSessions.test.tsx | 3 |
| src/components/QRCode.test.tsx | 6 |
| src/components/QuestionForm.test.tsx | 8 |
| src/components/QuestionList.test.tsx | 9 |
| src/components/ReasonInput.test.tsx | 7 |
| src/components/SessionResults.test.tsx | 6 |
| src/components/TemplatePanel.test.tsx | 8 |
| src/components/VoteAgreeDisagree.test.tsx | 9 |
| src/components/VoteMultipleChoice.test.tsx | 11 |
| src/hooks/use-auth.test.ts | 3 |
| src/hooks/use-countdown.test.ts | 7 |
| src/hooks/use-haptic.test.ts | 3 |
| src/hooks/use-presence.test.ts | 7 |
| src/hooks/use-realtime-channel.test.ts | 10 |
| src/lib/admin-auth.test.ts | 11 |
| src/lib/question-templates.test.ts | 22 |
| src/lib/vote-aggregation.test.ts | 7 |
| src/pages/AdminSession.test.tsx | 52 |
| src/pages/Home.test.tsx | 8 |
| src/pages/ParticipantSession.test.tsx | 38 |
| src/stores/session-store.test.ts | 20 |
| **Total** | **334** |
