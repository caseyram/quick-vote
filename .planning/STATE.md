# State: QuickVote

## Project Reference

**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.
**Stack:** Vite + React (TypeScript), Supabase (database + realtime), Vercel deployment
**Repo:** C:/code/quick-vote

## Current Position

**Phase:** 4 of 5 -- Realtime and Live Session Orchestration
**Plan:** 4 of 4 complete
**Status:** Phase 4 complete (all 4 plans done)
**Last activity:** 2026-01-27 -- Completed 04-04 (participant session realtime wiring) -- Phase 4 complete
**Progress:** [####################] 12/12 plans complete (phases 1-4 done, phase 5 not started)

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Integration Spike | Complete (2/2 plans done) |
| 2 | Data Foundation and Session Setup | Complete (3/3 plans done) |
| 3 | Join Flow and Voting Mechanics | Complete (3/3 plans done) |
| 4 | Realtime and Live Session Orchestration | Complete (4/4 plans done) |
| 5 | Immersive UI and Polish | Not Started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 12 |
| Plans failed | 0 |
| Total requirements | 18 |
| Requirements done | 15 (SESS-01, SESS-02, SESS-03, VOTE-01, VOTE-02, VOTE-03, VOTE-04, JOIN-01, JOIN-02, JOIN-03, JOIN-04, LIVE-01, LIVE-02, LIVE-03, LIVE-04) |

## Accumulated Context

### Key Decisions
- Zustand over React Context for state management (re-render performance with rapid vote updates)
- Separate admin_token (UUID) from public session_id (nanoid) for URL security
- Client-side aggregation for v1 (50-100 users); server-side aggregation deferred
- Single Supabase channel per session multiplexing Broadcast + Presence + Postgres Changes
- Idempotent vote insertion (UPSERT with UNIQUE constraint) from day one
- Integration spike before feature work to validate Vercel + Supabase pipeline end-to-end
- Vercel auto-deploy on push to main (git push, not Vercel CLI)
- Multiplexed channel pattern validated: single channel handles both Broadcast and Postgres Changes
- Manual TypeScript types over Supabase-generated types for simplicity and control
- useAuth as plain React hook (not Zustand) -- auth state is app-level singleton
- No error handling that blocks rendering in useAuth -- graceful degradation if auth fails
- Single Zustand store for session + questions (always used together)
- Auth gating in App.tsx (not per-page) ensures anonymous auth ready before any Supabase calls
- Explicit column list in participant queries to never expose admin_token
- Individual updates for position swap over upsert (avoids NOT NULL column issues in upsert)
- Edit state managed in AdminSession parent (QuestionList triggers, QuestionForm receives)
- VoteCount interface in vote-aggregation.ts (derived UI type, not DB row -- not in database.ts)
- Voting state added to existing Zustand store (single store pattern, not separate voting store)
- 400ms double-tap threshold for forgiving mobile gesture detection
- ParticipantSession uses local state machine for view derivation (not Zustand) -- page-level UI state
- Safe Session type casts admin_token/created_by to empty strings for Zustand store compatibility on participant side
- Name prompt persisted to sessionStorage (scoped to browser tab), shown once per session for named questions
- Results view in ParticipantSession is intentional placeholder (Plan 03-03 builds full SessionResults)
- Anonymous toggle placed as separate Voting Privacy section above QuestionList in draft state (QuestionList/QuestionForm unchanged)
- Wider layout (max-w-4xl) during live session for admin presentation screen readability
- AdminQuestionControl receives votes as props from AdminSession (live via Postgres Changes, replacing 3s polling)
- Question status polling replaced by Postgres Changes subscription in AdminSession (Phase 4 realtime)
- useRealtimeChannel excludes setup from deps -- caller must useCallback to avoid reconnect cycles
- usePresence calls channel.track() directly -- buffers until SUBSCRIBED, no caller coordination needed
- useCountdown stores onComplete in ref -- avoids stale closures, callers don't need to memoize callback
- ConnectionStatus type exported from use-realtime-channel and reused in Zustand store (single source of truth)
- CSS height transitions (0.5s ease-out) for BarChart animation -- simple, zero-dependency approach
- Blue/orange for agree/disagree, 8-color palette for multiple choice -- neutral, non-judgmental
- Pill badge with clock SVG for countdown timer -- compact, non-distracting per CONTEXT.md
- Session-level vote accumulation in AdminSession, passed down as props (all Postgres Changes listeners before subscribe)
- Auto-reveal results immediately after voting_closed broadcast (per CONTEXT.md auto-close + auto-reveal)
- Timer duration is ephemeral local state in AdminQuestionControl, communicated via broadcast payload
- Participant timer is cosmetic only -- real close comes from admin's voting_closed broadcast
- Mutable refs (viewRef, activeQuestionRef) avoid stale closures in Broadcast callbacks
- hasConnectedOnce ref distinguishes initial connect from reconnection for re-fetch logic
- waitingMessage state provides contextual feedback (waiting, reviewing results, results shown)
- Crossfade uses CSS opacity transition (300ms) with displayedQuestion buffer state

### Research Insights
- Supabase Realtime has three mechanisms: Broadcast (admin commands), Postgres Changes (vote stream), Presence (participant count)
- Vote submission must be idempotent: UNIQUE(question_id, participant_id) + UPSERT
- Realtime events are "something changed" signals; DB is always source of truth for counts
- Centralized useRealtimeChannel hook required to prevent subscription leaks
- Mobile viewport: use 100dvh not 100vh
- Tactile UI is the product identity, not polish -- must ship in v1
- Tailwind CSS v4 uses CSS-first configuration (no tailwind.config.js), just @import "tailwindcss" in CSS
- Supabase anonymous auth (signInAnonymously()) is production-ready; must enable in Dashboard
- @supabase/supabase-js remains at v2 (no v3); installed version 2.93.1 is current
- React Router v7 uses single package `react-router` (not react-router-dom); declarative mode for Vite SPA
- Zustand v5 requires create<T>()(fn) with double parentheses
- RLS policies must use (select auth.uid()) wrapped in select for performance

### TODOs
- Verify motion vs framer-motion package name at install time

### Blockers
(none)

## Session Continuity

**Last session:** 2026-01-27 -- Completed 04-04 (participant session realtime wiring) -- Phase 4 complete
**Next action:** Plan and execute Phase 5 (Immersive UI and Polish)
**Resume file:** None
**Context to preserve:** Phase 4 complete. All realtime wiring done -- admin broadcasts events (question_activated, voting_closed, results_revealed, session_active, session_ended, session_lobby) and participants receive them instantly via Broadcast listeners. All polling removed from both AdminSession and ParticipantSession. Hooks (useRealtimeChannel, usePresence, useCountdown) and components (BarChart, CountdownTimer, ConnectionBanner, ParticipantCount) fully integrated into both admin and participant pages. Reconnection re-fetch handles missed events. Build passes with zero TS errors.

---
*State initialized: 2026-01-27*
*Updated: 2026-01-27 -- Completed 01-02 integration PoC plan (Phase 1 complete)*
*Updated: 2026-01-27 -- Phase 2 planned (3 plans, 3 waves, research + verification passed)*
*Updated: 2026-01-27 -- Completed 02-01 (deps, schema, types, auth hook)*
*Updated: 2026-01-27 -- Completed 02-02 (router, store, pages)*
*Updated: 2026-01-27 -- Completed 02-03 (question CRUD) -- Phase 2 complete*
*Updated: 2026-01-27 -- Phase 2 verified (7/7 must-haves, 3/3 requirements complete)*
*Updated: 2026-01-27 -- Phase 3 planned (3 plans, 2 waves, research + verification passed)*
*Updated: 2026-01-27 -- Completed 03-01 (foundation hooks, utilities, store extensions)*
*Updated: 2026-01-27 -- Completed 03-02 (participant voting UI, state machine, polling bridge)*
*Updated: 2026-01-27 -- Completed 03-03 (admin controls: QR, state machine, question activation, results) -- Phase 3 complete*
*Updated: 2026-01-27 -- Phase 3 verified (5/5 success criteria, 8 requirements complete)*
*Updated: 2026-01-27 -- Completed 04-01 (realtime hooks: useRealtimeChannel, usePresence, useCountdown)*
*Updated: 2026-01-27 -- Completed 04-02 (realtime UI components: BarChart, CountdownTimer, ConnectionBanner, ParticipantCount)*
*Updated: 2026-01-27 -- Completed 04-03 (admin realtime: broadcast commands, live vote streaming, bar chart results, countdown timer, presence)*
*Updated: 2026-01-27 -- Completed 04-04 (participant realtime: broadcast listeners, presence, timer, reconnection) -- Phase 4 complete*
