---
phase: "04"
plan: "03"
subsystem: "admin-realtime"
tags: ["supabase-realtime", "broadcast", "postgres-changes", "presence", "bar-chart", "countdown-timer", "admin-session"]
dependency-graph:
  requires: ["04-01", "04-02"]
  provides: ["realtime AdminSession", "broadcast admin commands", "live vote streaming", "bar chart results"]
  affects: ["04-04"]
tech-stack:
  added: []
  patterns: ["shared channel with prop-passed channelRef", "session-level vote accumulation", "timer-driven auto-close"]
key-files:
  created: []
  modified:
    - "src/pages/AdminSession.tsx"
    - "src/components/AdminQuestionControl.tsx"
    - "src/components/SessionResults.tsx"
decisions:
  - id: "ADMIN-RT-01"
    decision: "Session-level vote accumulation in AdminSession, passed down as props"
    rationale: "All Postgres Changes listeners must be registered before channel.subscribe(); single channel shared via channelRef prop avoids multiple subscriptions"
  - id: "ADMIN-RT-02"
    decision: "Auto-reveal results immediately after voting_closed broadcast"
    rationale: "Per CONTEXT.md auto-close + auto-reveal on timer expiry; simplifies participant flow"
  - id: "ADMIN-RT-03"
    decision: "Timer duration is local state in AdminQuestionControl, not persisted to DB"
    rationale: "Timer is ephemeral UI state; participant receives timerSeconds via broadcast payload"
metrics:
  duration: "~5 minutes"
  completed: "2026-01-27"
---

# Phase 4 Plan 03: Admin Session Realtime Wiring Summary

**One-liner:** Admin session rewritten with Supabase Realtime -- live vote streaming via Postgres Changes, broadcast commands for question activation/close/reveal, presence-based participant count, countdown timer controls, and vertical bar chart results replacing all polling.

## What Was Built

### AdminSession.tsx Realtime Rewrite
- Removed 3-second polling (`setInterval`/`pollQuestions`) entirely
- Added `useRealtimeChannel` with Postgres Changes listeners for both `questions` and `votes` tables filtered by session_id
- Added `usePresence` for live participant count with admin role tracking
- Renders `<ConnectionBanner>` at page top for reconnection/disconnection feedback
- Renders `<ParticipantCount>` in session header alongside status badge when live
- Broadcasts `session_lobby`, `session_active`, `session_ended` on state transitions
- Manages `sessionVotes: Record<string, Vote[]>` state, populated by initial fetch and live Postgres Changes events
- Passes `channelRef` and `votes` as props to each `AdminQuestionControl` instance
- Session ID tracked in ref for stable channel setup callback

### AdminQuestionControl.tsx Realtime Rewrite
- Removed all internal vote fetching and polling (`fetchVotes`, `setInterval`)
- Accepts `votes: Vote[]` and `channelRef: RefObject<RealtimeChannel | null>` as new props
- Computes `aggregated` from votes via `useMemo(aggregateVotes(votes), [votes])` -- recomputes automatically as parent passes new live votes
- Broadcasts `question_activated` (with `timerSeconds` payload), `voting_closed`, and `results_revealed` events
- Timer selection UI: pill buttons for 15s/30s/60s/No timer (default: no timer), displayed when question is pending
- Uses `useCountdown` hook with auto-close callback -- when timer expires, automatically calls `handleCloseVoting`
- Renders `<CountdownTimer>` alongside vote count during active questions
- Replaced horizontal percentage bars with `<BarChart>` component using proper color mapping (blue/orange for agree/disagree, 8-color palette for multiple choice)
- Named voter details preserved below bar chart for non-anonymous questions

### SessionResults.tsx Bar Chart Update
- Replaced horizontal percentage bars with `<BarChart>` component
- Same color mapping as AdminQuestionControl (agree/disagree colors, multi-choice palette)
- Extracted `buildBarData` helper for converting aggregated data to BarChart format
- Overall structure preserved (loading state, empty state, scrollable card layout)

## Task Log

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite AdminSession with realtime channel, presence, and broadcast | 34f128a | src/pages/AdminSession.tsx |
| 2 | Rewrite AdminQuestionControl with broadcast, bar chart, timer + SessionResults | 826c449 | src/components/AdminQuestionControl.tsx, src/components/SessionResults.tsx |

## Decisions Made

1. **ADMIN-RT-01: Session-level vote accumulation in AdminSession** -- All Postgres Changes listeners must be registered before `channel.subscribe()`. Since `useRealtimeChannel` handles subscribe timing, the setup callback in AdminSession registers listeners for both questions and votes tables. Votes are accumulated in `Record<string, Vote[]>` state and passed down as props to AdminQuestionControl.

2. **ADMIN-RT-02: Auto-reveal results immediately after voting_closed** -- Per CONTEXT.md's "auto-close + auto-reveal on timer expiry" pattern, the admin broadcasts both `voting_closed` and `results_revealed` in sequence when closing voting. This simplifies the participant flow (no separate reveal step needed).

3. **ADMIN-RT-03: Timer duration is ephemeral local state** -- The countdown duration (15s/30s/60s/null) is not persisted to the database. It lives in AdminQuestionControl's local state and is communicated to participants via the `question_activated` broadcast payload (`timerSeconds` field).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass -- zero errors |
| `npm run build` | Pass |
| No `setInterval` in AdminSession.tsx | Pass -- zero matches |
| No `setInterval` in AdminQuestionControl.tsx | Pass -- zero matches |
| `useRealtimeChannel` in AdminSession.tsx | Pass -- imported and called |
| `usePresence` in AdminSession.tsx | Pass -- imported and called |
| `<ParticipantCount>` in AdminSession.tsx | Pass -- rendered in header |
| `<ConnectionBanner>` in AdminSession.tsx | Pass -- rendered at top |
| `<BarChart>` in AdminQuestionControl.tsx | Pass -- renders in closed/revealed state |
| `<BarChart>` in SessionResults.tsx | Pass -- renders for each question result |
| `<CountdownTimer>` in AdminQuestionControl.tsx | Pass -- renders during active state |
| Broadcast: question_activated | Pass -- sent in handleActivate |
| Broadcast: voting_closed | Pass -- sent in handleCloseVoting |
| Broadcast: results_revealed | Pass -- sent in handleCloseVoting |
| Broadcast: session_active | Pass -- sent in handleBeginVoting |
| Broadcast: session_ended | Pass -- sent in handleEndSession |
| Broadcast: session_lobby | Pass -- sent in handleStartSession |
| Timer selection UI (15s/30s/60s/none) | Pass -- pill buttons rendered for pending questions |
| AdminSession.tsx min_lines (200) | Pass -- 638 lines |
| AdminQuestionControl.tsx min_lines (150) | Pass -- 284 lines |
| SessionResults.tsx min_lines (80) | Pass -- 145 lines |

## Success Criteria

| Criteria | Status |
|----------|--------|
| LIVE-01: Admin advances questions and closes/reveals via broadcast | Met -- question_activated, voting_closed, results_revealed broadcast |
| LIVE-02: Admin sets countdown timer; auto-closes on expiry | Met -- timer selection UI + useCountdown with auto-close callback |
| LIVE-03: Bar chart displays live-updating results via Postgres Changes | Met -- votes stream via Postgres Changes, BarChart renders from aggregated data |
| LIVE-04: Admin sees participant count via Presence | Met -- usePresence + ParticipantCount rendered in header |
| Phase 3 admin functionality preserved | Met -- session state machine, QR code, anonymous toggle, question management all intact |

## Next Phase Readiness

Plan 04-03 provides the admin half of realtime. Plan 04-04 (participant session realtime wiring) is the final plan in Phase 4:
- Admin now broadcasts all 6 event types that 04-04's participant listeners consume
- The shared channel pattern (`session:{sessionId}`) is established and can be reused by participants
- Timer seconds are communicated via broadcast payload for participant-side countdown display
- No blockers for 04-04
