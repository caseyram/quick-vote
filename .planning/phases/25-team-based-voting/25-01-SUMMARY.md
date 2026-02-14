---
phase: 25-team-based-voting
plan: 01
subsystem: database-foundation
tags: [schema, types, validation, api]
dependency_graph:
  requires: []
  provides:
    - sessions.teams column (JSONB, max 5 teams)
    - votes.team_id column (TEXT, nullable, indexed)
    - Session and Vote TypeScript types with team fields
    - team-api.ts CRUD module with Zod validation
  affects:
    - All future team-based features (admin config UI, participant join, filtering, QR codes, export)
tech_stack:
  added:
    - Zod schema validation for team lists
  patterns:
    - JSONB column for dynamic team array
    - Composite indexes for efficient team+session queries
    - Nullable foreign key pattern (team_id on votes)
key_files:
  created:
    - supabase/migrations/20260215_080_add_teams.sql
    - src/lib/team-api.ts
  modified:
    - src/types/database.ts
decisions:
  - "Use JSONB for teams array on sessions table (flexible, no separate teams table needed)"
  - "Max 5 teams enforced at database level via CHECK constraint"
  - "team_id nullable on votes (participants can opt out of teams)"
  - "Case-insensitive uniqueness validation in Zod (prevents 'Red' and 'red')"
  - "Composite index on (session_id, team_id) for efficient filtering queries"
metrics:
  duration: 100s
  completed: 2026-02-14T20:27:50Z
---

# Phase 25 Plan 01: Team Database Foundation Summary

**One-liner:** Database schema and TypeScript foundation for team-based voting with JSONB teams storage, indexed team_id on votes, and Zod-validated CRUD API.

## What Was Built

Created the database foundation for team-based voting:

1. **Database Migration (`20260215_080_add_teams.sql`):**
   - Added `teams JSONB` column to sessions table (default empty array, max 5 teams via CHECK constraint)
   - Added `team_id TEXT` column to votes table (nullable for non-team participants)
   - Created index on `votes.team_id` for efficient filtering
   - Created composite index on `votes(session_id, team_id)` for session+team queries
   - Added documentation comments on both columns

2. **TypeScript Type Updates (`src/types/database.ts`):**
   - Added `teams: string[]` field to Session interface
   - Added `team_id: string | null` field to Vote interface

3. **Team API Module (`src/lib/team-api.ts`):**
   - `TeamListSchema` - Zod schema enforcing: non-empty names, max 50 chars per name, max 5 teams, unique names (case-insensitive)
   - `validateTeamList(teams)` - Client-side validation function
   - `updateSessionTeams(sessionId, teams)` - Persists team configuration to database with validation
   - `fetchSessionTeams(sessionId)` - Retrieves team configuration (returns empty array if none)

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Database migration and TypeScript type updates | d36d4e0 | `supabase/migrations/20260215_080_add_teams.sql`, `src/types/database.ts` |
| 2 | Team API module with CRUD and validation | 8bd3459 | `src/lib/team-api.ts` |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Why JSONB for teams?**
- Teams are session-scoped (no need for separate teams table)
- Max 5 teams keeps array small (no performance concerns)
- JSONB allows efficient querying and constraint enforcement
- Simple schema (just an array of strings)

**Why nullable team_id on votes?**
- Participants can vote without joining a team
- NULL values are indexed efficiently in PostgreSQL
- Allows filtering: team votes (team_id IS NOT NULL) vs non-team votes (team_id IS NULL)

**Index strategy:**
- Single-column index on team_id supports: filtering by team, checking if participant has team
- Composite index on (session_id, team_id) supports: "get all votes for session X and team Y" (most common query pattern)

**Validation approach:**
- Database-level: CHECK constraint prevents > 5 teams
- Application-level: Zod schema provides detailed error messages and type safety
- Case-insensitive uniqueness prevents user confusion ('Red' vs 'red')

## Dependencies Satisfied

**Provides foundation for:**
- Plan 02: Admin team configuration UI (will use updateSessionTeams)
- Plan 03: Participant team join flow (will set team_id on votes)
- Plan 04: Team filter tabs in presentation view
- Plan 05: Team-specific QR code grid
- Plan 06: Team column in CSV export

**No breaking changes:**
- Existing sessions have empty teams array (default value)
- Existing votes have NULL team_id (nullable column)
- All existing code continues to work

## Verification Results

- TypeScript compilation: PASSED (npx tsc --noEmit)
- Migration file exists: PASSED
- Types file updated: PASSED
- Team API module created: PASSED
- All exports available: validateTeamList, updateSessionTeams, fetchSessionTeams, TeamListSchema

## Self-Check: PASSED

**Created files verified:**
- FOUND: supabase/migrations/20260215_080_add_teams.sql
- FOUND: src/lib/team-api.ts

**Modified files verified:**
- FOUND: src/types/database.ts (Session.teams, Vote.team_id fields present)

**Commits verified:**
- FOUND: d36d4e0 (feat(25-01): add teams database schema)
- FOUND: 8bd3459 (feat(25-01): add team API module with validation)

## Next Steps

Plan 02 will build the admin UI for configuring teams:
- Team name input fields in AdminSession (lobby phase)
- Real-time team list updates
- Integration with updateSessionTeams API
- Participant count per team display
