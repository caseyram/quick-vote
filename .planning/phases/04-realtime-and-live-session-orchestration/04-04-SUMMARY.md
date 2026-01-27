---
phase: 04-realtime-and-live-session-orchestration
plan: 04
subsystem: realtime-participant
tags: [supabase-realtime, broadcast, presence, countdown-timer, participant-session, connection-status]

dependency_graph:
  requires:
    - phase: 04-01
      provides: useRealtimeChannel, usePresence, useCountdown hooks
    - phase: 04-02
      provides: ConnectionBanner, CountdownTimer, ParticipantCount components
  provides:
    - "ParticipantSession with full realtime Broadcast listeners"
    - "Participant receives question_activated, voting_closed, results_revealed, session_active, session_ended, session_lobby in real-time"
    - "Reconnection recovery (re-fetch state on WebSocket reconnect)"
    - "Crossfade transition between questions"
  affects: [05-immersive-ui-and-polish]

tech_stack:
  added: []
  patterns: [broadcast-listener-setup, mutable-refs-for-broadcast-callbacks, reconnection-re-fetch, crossfade-with-css-opacity]

key_files:
  created: []
  modified:
    - src/pages/ParticipantSession.tsx

key_decisions:
  - "Participant timer is cosmetic only -- real close comes from admin voting_closed broadcast"
  - "Mutable refs (viewRef, activeQuestionRef) used to avoid stale closures in Broadcast callbacks"
  - "hasConnectedOnce ref distinguishes initial connect from reconnection for re-fetch logic"
  - "Lobby view inlined (not using Lobby component) to include ConnectionBanner and ParticipantCount"
  - "waitingMessage state distinguishes between 'Waiting for next question' and 'Results are being shown'"
  - "Crossfade uses CSS opacity transition (300ms) with displayedQuestion buffer state"

patterns_established:
  - "Broadcast listener pattern: useCallback setup function with mutable refs for latest state"
  - "Reconnection re-fetch: hasConnectedOnce ref + connectionStatus effect"
  - "Crossfade pattern: contentVisible + displayedQuestion state for opacity transition"

duration: 4min
completed: 2026-01-27
---

# Phase 4 Plan 04: Participant Session Realtime Wiring Summary

**ParticipantSession rewritten with Supabase Realtime Broadcast listeners replacing all 4s polling -- questions appear instantly, timers count down, presence shows social proof, and reconnection recovers missed events.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-01-27T19:12:31Z
- **Completed:** 2026-01-27T19:16:40Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced entire 4s polling bridge with 6 Broadcast event listeners (question_activated, voting_closed, results_revealed, session_active, session_ended, session_lobby)
- Wired useRealtimeChannel, usePresence, and useCountdown hooks into participant page
- Added ConnectionBanner (reconnecting/disconnected feedback), CountdownTimer (subtle timer during timed questions), and ParticipantCount (social proof in lobby, voting, waiting, and results views)
- Added reconnection re-fetch to catch events missed during WebSocket disconnection (Pitfall 6)
- Added 300ms CSS crossfade transition when admin activates a new question

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite ParticipantSession with Broadcast listeners and remove polling** - `8ff1394` (feat)
2. **Task 2: Verify full build and cross-reference all realtime wiring** - verification only, no code changes

**Plan metadata:** pending

## Files Created/Modified

- `src/pages/ParticipantSession.tsx` - Participant session page with full realtime: Broadcast listeners for all admin commands, presence tracking, countdown timer, connection status banner, reconnection re-fetch, crossfade transitions. 572 lines (up from 413).

## Decisions Made

1. **Participant timer is cosmetic** -- The participant's countdown timer is purely a visual display. The real close/reveal always comes from the admin's `voting_closed` broadcast. The `handleTimerComplete` callback is a no-op since the admin controls the authoritative timer.

2. **Mutable refs for Broadcast callbacks** -- `viewRef` and `activeQuestionRef` are kept in sync with state via useEffect. Broadcast callbacks read from refs to avoid stale closure issues (callbacks are registered once during channel setup and never re-registered).

3. **hasConnectedOnce ref for reconnection detection** -- Distinguishes the initial WebSocket connection from subsequent reconnections. Only reconnections trigger a re-fetch of session state from the database.

4. **Lobby view inlined** -- The original `<Lobby>` component was replaced with inline JSX in ParticipantSession to include `<ConnectionBanner>` and `<ParticipantCount>` in the lobby view. The Lobby component remains available for other uses.

5. **waitingMessage state** -- A `waitingMessage` state variable distinguishes between "Waiting for next question..." (between questions), "The host is reviewing results..." (after voting_closed), and "Results are being shown on the main screen" (after results_revealed). This provides contextual feedback to participants.

6. **displayedQuestion buffer for crossfade** -- A separate `displayedQuestion` state lags behind `activeQuestion` by 300ms during transitions. `contentVisible` controls CSS opacity. This achieves a smooth crossfade without any animation library.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass -- zero errors |
| `npm run build` | Pass |
| `setInterval` in ParticipantSession.tsx | 0 matches (removed) |
| `POLL_INTERVAL_MS` in src/ | 0 matches (removed) |
| `sessionStatusRef` in ParticipantSession.tsx | 0 matches (removed) |
| `useRealtimeChannel` in ParticipantSession.tsx | 3 matches (import + type + call) |
| `question_activated` listener | Present in ParticipantSession.tsx |
| All 6 broadcast events matched | Senders in Admin, listeners in Participant |
| `<CountdownTimer>` in ParticipantSession.tsx | Present |
| `<ParticipantCount>` in ParticipantSession.tsx | Present |
| `<ConnectionBanner>` in ParticipantSession.tsx | Present |
| File length (min 200 lines) | 572 lines |

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required for this plan. (Realtime publication SQL from Plan 04-02 is a prerequisite that should already be applied.)

## Next Phase Readiness

Phase 4 is now complete (all 4 plans executed):
- **04-01**: Realtime hooks (useRealtimeChannel, usePresence, useCountdown) and store extension
- **04-02**: UI components (BarChart, CountdownTimer, ConnectionBanner, ParticipantCount) and SQL
- **04-03**: Admin session realtime wiring (broadcast senders, live vote stream, bar charts)
- **04-04**: Participant session realtime wiring (broadcast listeners, presence, timer, reconnection)

Phase 5 (Immersive UI and Polish) can proceed. The realtime foundation is fully wired -- admin broadcasts events, participants receive them instantly. All polling has been removed from both admin and participant pages.

---
*Phase: 04-realtime-and-live-session-orchestration*
*Completed: 2026-01-27*
