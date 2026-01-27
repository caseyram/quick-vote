---
phase: 04-realtime-and-live-session-orchestration
plan: 01
subsystem: realtime-hooks
tags: [supabase-realtime, presence, countdown-timer, zustand, hooks]
dependency_graph:
  requires: [03-03]
  provides: [useRealtimeChannel, usePresence, useCountdown, realtime-store-slice]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: []
  patterns: [channel-lifecycle-hook, presence-grace-period, drift-corrected-timer, store-slice-extension]
key_files:
  created:
    - src/hooks/use-realtime-channel.ts
    - src/hooks/use-presence.ts
    - src/hooks/use-countdown.ts
  modified:
    - src/stores/session-store.ts
decisions:
  - id: RT-HOOK-01
    decision: "useRealtimeChannel excludes setup from deps (caller must useCallback)"
    rationale: "Prevents reconnect cycles from unstable callback references"
  - id: RT-HOOK-02
    decision: "usePresence calls channel.track() directly (buffers until SUBSCRIBED)"
    rationale: "Simplifies API -- no need for callers to coordinate track timing with subscribe"
  - id: RT-HOOK-03
    decision: "useCountdown stores onComplete in ref to avoid stale closures"
    rationale: "Callers do not need to memoize onComplete; ref always has latest"
  - id: RT-HOOK-04
    decision: "ConnectionStatus type exported from use-realtime-channel and reused in store"
    rationale: "Single source of truth for connection status union type"
metrics:
  duration: "~3 minutes"
  completed: 2026-01-27
---

# Phase 4 Plan 01: Realtime Hooks and Store Extension Summary

**One-liner:** Three foundation hooks (channel lifecycle, presence tracking, drift-corrected countdown) plus Zustand store extension with realtime state slice.

## What Was Built

### useRealtimeChannel (`src/hooks/use-realtime-channel.ts`)
Central Supabase channel lifecycle hook. Creates a channel, calls a user-provided setup callback to configure listeners (Broadcast, Postgres Changes, Presence), subscribes, tracks connection status (`connecting | connected | reconnecting | disconnected`), and cleans up on unmount. Returns `{ channelRef, connectionStatus }`.

### usePresence (`src/hooks/use-presence.ts`)
Presence tracking hook with 10-second grace period for disconnects. Listens to Supabase Presence `sync`, `join`, and `leave` events. Maintains per-key leave timers so brief network blips don't cause participant count flicker. Calls `channel.track()` directly (buffers until SUBSCRIBED). Returns `{ participantCount }`.

### useCountdown (`src/hooks/use-countdown.ts`)
Drift-corrected countdown timer using `setInterval` at 100ms with `Date.now()` delta calculation. Stores `onComplete` in a ref to avoid stale closures. Provides `start(durationMs)`, `stop()`, `remaining` (ms), and `isRunning`. Consumers derive seconds via `Math.ceil(remaining / 1000)`.

### Store Extension (`src/stores/session-store.ts`)
Added four realtime state fields to the existing Zustand store:
- `participantCount: number` (default 0)
- `connectionStatus: ConnectionStatus` (default 'connecting')
- `activeQuestionId: string | null` (default null)
- `timerEndTime: number | null` (default null)

Each with a corresponding setter. All fields included in `reset()`. Fully additive -- no existing state or setters modified.

## Task Log

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useRealtimeChannel and usePresence hooks | 67ef167 | src/hooks/use-realtime-channel.ts, src/hooks/use-presence.ts |
| 2 | Create useCountdown hook and extend Zustand store | bdab857 | src/hooks/use-countdown.ts, src/stores/session-store.ts |

## Decisions Made

1. **RT-HOOK-01: setup excluded from useRealtimeChannel deps** -- Caller must wrap setup in `useCallback`. This prevents reconnect cycles from unstable references while keeping the hook API simple.

2. **RT-HOOK-02: usePresence calls channel.track() directly** -- Supabase buffers `track()` calls until the channel reaches SUBSCRIBED state, so callers don't need to coordinate timing between subscribe and track.

3. **RT-HOOK-03: onComplete stored in ref inside useCountdown** -- The `start` and `stop` callbacks remain stable (wrapped in `useCallback`) while always calling the latest `onComplete`. Callers do not need to memoize their callback.

4. **RT-HOOK-04: ConnectionStatus type shared between hook and store** -- The `ConnectionStatus` type is exported from `use-realtime-channel.ts` and imported by `session-store.ts`, ensuring a single source of truth.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit`: Zero errors
- `npm run build`: Success
- All three hook files exist and export documented hooks
- Store has all four new fields with setters and reset coverage
- No existing store functionality broken (all Phase 2-3 consumers unaffected)

## Next Phase Readiness

Plan 04-01 provides the foundation hooks that Plans 04-02 through 04-04 will consume:
- **04-02** will create UI components (BarChart, CountdownTimer, ConnectionBanner, ParticipantCount) that consume these hooks
- **04-03** will rewrite AdminSession using useRealtimeChannel + usePresence + useCountdown
- **04-04** will rewrite ParticipantSession using the same hooks

No blockers for downstream plans.
