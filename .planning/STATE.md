# State: QuickVote

## Project Reference

**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.
**Stack:** Vite + React (TypeScript), Supabase (database + realtime), Vercel deployment
**Repo:** C:/code/quick-vote

## Current Position

**Phase:** 3 of 5 -- Join Flow and Voting Mechanics
**Plan:** 1 of 3 complete
**Status:** In progress
**Last activity:** 2026-01-27 -- Completed 03-01-PLAN.md (foundation hooks, utilities, store)
**Progress:** [############________] Phases 1-2 + plan 03-01 done (6/8 plans across phases 1-3)

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Integration Spike | Complete (2/2 plans done) |
| 2 | Data Foundation and Session Setup | Complete (3/3 plans done) |
| 3 | Join Flow and Voting Mechanics | In Progress (1/3 plans done) |
| 4 | Realtime and Live Session Orchestration | Not Started |
| 5 | Immersive UI and Polish | Not Started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 6 |
| Plans failed | 0 |
| Total requirements | 18 |
| Requirements done | 3 (SESS-01, SESS-02, SESS-03) |

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
- Test RLS + Realtime Postgres Changes interaction before Phase 4

### Blockers
(none)

## Session Continuity

**Last session:** 2026-01-27 -- Completed 03-01-PLAN.md (foundation hooks, utilities, store extensions)
**Next action:** Execute 03-02-PLAN.md (participant voting UI) and 03-03-PLAN.md (admin controls) -- Wave 2 plans
**Resume file:** None
**Context to preserve:** Phase 3 Wave 1 complete. Foundation hooks (useDoubleTap, useHaptic), vote aggregation utility, Zustand voting state, and qrcode.react installed. Wave 2 (plans 03-02 and 03-03) can proceed in parallel. moddatetime trigger SQL needs manual execution in Supabase SQL Editor.

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
