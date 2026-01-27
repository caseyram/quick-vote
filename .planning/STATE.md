# State: QuickVote

## Project Reference

**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.
**Stack:** Vite + React (TypeScript), Supabase (database + realtime), Vercel deployment
**Repo:** C:/code/quick-vote

## Current Position

**Phase:** 1 of 5 -- Integration Spike
**Plan:** Not yet planned
**Status:** NOT STARTED
**Progress:** [____________________] 0/5 phases complete

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Integration Spike | Not Started |
| 2 | Data Foundation and Session Setup | Not Started |
| 3 | Join Flow and Voting Mechanics | Not Started |
| 4 | Realtime and Live Session Orchestration | Not Started |
| 5 | Immersive UI and Polish | Not Started |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 0 |
| Plans failed | 0 |
| Total requirements | 18 |
| Requirements done | 0 |

## Accumulated Context

### Key Decisions
- Zustand over React Context for state management (re-render performance with rapid vote updates)
- Separate admin_token (UUID) from public session_id (nanoid) for URL security
- Client-side aggregation for v1 (50-100 users); server-side aggregation deferred
- Single Supabase channel per session multiplexing Broadcast + Presence + Postgres Changes
- Idempotent vote insertion (UPSERT with UNIQUE constraint) from day one
- Integration spike before feature work to validate Vercel + Supabase pipeline end-to-end

### Research Insights
- Supabase Realtime has three mechanisms: Broadcast (admin commands), Postgres Changes (vote stream), Presence (participant count)
- Vote submission must be idempotent: UNIQUE(question_id, participant_id) + UPSERT
- Realtime events are "something changed" signals; DB is always source of truth for counts
- Centralized useRealtimeChannel hook required to prevent subscription leaks
- Mobile viewport: use 100dvh not 100vh
- Tactile UI is the product identity, not polish -- must ship in v1

### TODOs
- Verify Supabase anonymous auth API surface before Phase 2 planning
- Verify @supabase/supabase-js version (v2 vs v3) at install time
- Verify motion vs framer-motion package name at install time
- Test RLS + Realtime Postgres Changes interaction before Phase 4

### Blockers
(none)

## Session Continuity

**Last session:** 2026-01-27 -- Roadmap revision (added integration spike as Phase 1)
**Next action:** Plan Phase 1 via /gsd:plan-phase 1
**Context to preserve:** Phase 1 is infrastructure-only (no requirements). Research identified Supabase Realtime (Phase 4) as highest-risk phase; consider research before planning that phase.

---
*State initialized: 2026-01-27*
*Updated: 2026-01-27 -- Phase renumbering after integration spike insertion*
