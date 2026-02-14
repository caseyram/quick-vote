---
phase: 25-team-based-voting
plan: 02
subsystem: team-ui-and-joining
tags: [ui, components, team-flow, vote-integration]
dependency_graph:
  requires:
    - 25-01 (teams database schema, team-api.ts)
  provides:
    - Admin team configuration UI (add/remove teams in draft mode)
    - TeamPicker component (dropdown team selector)
    - TeamBadge component (team name pill)
    - Participant team joining flow (auto-assign, self-select, locking)
    - Vote payloads with team_id
  affects:
    - Future team features (team filtering in presentation, team-specific QRs, export)
tech_stack:
  added: []
  patterns:
    - sessionStorage for team persistence across page refreshes
    - URL param for team auto-assignment (?team=TeamName)
    - Team locking via existing votes query
key_files:
  created:
    - src/components/TeamPicker.tsx
    - src/components/TeamBadge.tsx
  modified:
    - src/pages/AdminSession.tsx
    - src/pages/ParticipantSession.tsx
    - src/components/VoteAgreeDisagree.tsx
    - src/components/VoteMultipleChoice.tsx
    - src/components/BatchVotingCarousel.tsx
decisions:
  - "Team picker as gate (blocks lobby/voting until team selected) when session has teams"
  - "Team locked after first vote (prevents switching teams mid-session)"
  - "sessionStorage for team persistence (survives refresh, scoped to session)"
  - "TeamBadge at top-right (z-40) to avoid overlap with ConnectionPill (top-left)"
  - "Auto-assign toast briefly shown (2s) for confirmation feedback"
metrics:
  duration: 232s
  completed: 2026-02-14T20:34:27Z
---

# Phase 25 Plan 02: Team Configuration UI and Joining Flow Summary

**One-liner:** Admin can configure teams in draft mode, participants can self-select or be auto-assigned to teams, and team_id is stored with all votes.

## What Was Built

Completed the UI and workflow for team-based voting:

### Task 1: UI Components and Admin Configuration

**TeamPicker.tsx:**
- Dropdown team selector with "Choose a team..." placeholder
- Dark theme (bg-gray-900) matching participant UI
- "Join Team" button (disabled when no selection)
- Centered card layout for mobile-first design

**TeamBadge.tsx:**
- Fixed position top-right (top-4 right-4)
- Indigo pill with team name (bg-indigo-600/80)
- z-40 to avoid overlap with vote buttons
- Visible in all participant views (lobby, waiting, voting, batch-voting, results)

**AdminSession.tsx Team Configuration:**
- Team config card shown only in draft mode (`isDraft && ...`)
- Text input + "Add Team" button
- Team list with "Remove" buttons
- Validation error display
- Team count indicator (N of 5 teams)
- Calls `updateSessionTeams` from team-api.ts
- Team names initialized from `session.teams` on load
- Hidden when session status is not 'draft' (teams locked after Go Live)

### Task 2: Participant Team Joining Flow

**ParticipantSession.tsx Team Logic:**

1. **Team State:**
   - `participantTeam: string | null` - current team assignment
   - `teamLocked: boolean` - true after first vote
   - `showTeamJoinedToast: boolean` - brief confirmation on auto-assign

2. **Auto-Assign from URL:**
   - Reads `?team=TeamName` from URL query params
   - Validates team exists in `session.teams`
   - Auto-assigns if valid, shows toast for 2s

3. **Team Locking:**
   - Queries votes table on load for existing votes by participant
   - If votes exist, extracts `team_id` and locks team
   - Locked team cannot be changed (picker never shown)

4. **sessionStorage Persistence:**
   - Stores team in `quickvote-team-{sessionId}` key
   - Restores on page refresh within same browser tab
   - Overridden by team lock if votes exist

5. **Team Picker Gate:**
   - Shown BEFORE lobby/voting views when:
     - Session has teams configured (`session.teams.length > 0`)
     - Participant not assigned (`!participantTeam`)
     - Team not locked (`!teamLocked`)
   - Blocks access until team selected

6. **TeamBadge Integration:**
   - Rendered in all views when `participantTeam` is set
   - Position: fixed top-right (no overlap with ConnectionPill at top-left)

**Vote Component Integration:**

- Added `teamId?: string | null` prop to:
  - `VoteAgreeDisagree`
  - `VoteMultipleChoice`
  - `BatchVotingCarousel`
- All vote upserts include `team_id: teamId` in payload
- ParticipantSession passes `teamId={participantTeam}` to all vote components

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Admin team configuration UI and participant team picker components | 340c81d | `src/components/TeamPicker.tsx`, `src/components/TeamBadge.tsx`, `src/pages/AdminSession.tsx` |
| 2 | Participant team joining flow with auto-assign and vote integration | 60b231f | `src/pages/ParticipantSession.tsx`, `src/components/VoteAgreeDisagree.tsx`, `src/components/VoteMultipleChoice.tsx`, `src/components/BatchVotingCarousel.tsx` |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Team Picker Gate Pattern:**
- Acts as a pre-flight check before any voting UI
- Shown immediately after loading completes if team required
- Clean separation: team selection → lobby/voting (no interleaving)

**Team Locking Strategy:**
- Check for existing votes on mount (single query with limit 1)
- If votes exist, team is locked and restored from vote.team_id
- Prevents team switching after participation begins
- sessionStorage acts as cache but defers to database state

**Auto-Assign Flow:**
- URL param checked on initial load only (not on reconnect)
- Validation against session.teams prevents invalid team assignment
- Toast provides immediate feedback (2s duration, fades automatically)
- sessionStorage saves for persistence

**Vote Payload Structure:**
```typescript
{
  question_id: string,
  session_id: string,
  participant_id: string,
  value: string,
  reason: string | null,
  locked_in: boolean,
  display_name: string | null,
  team_id: string | null  // NEW - populated when participant has team
}
```

**sessionStorage Key Pattern:**
- `quickvote-team-{sessionId}` - scoped to specific session
- Allows multiple sessions in different tabs with different teams
- Persists across page refresh but not across browsers/devices

## Dependencies Satisfied

**Requires (from Plan 25-01):**
- `session.teams` column (JSONB array)
- `vote.team_id` column (TEXT, nullable)
- `updateSessionTeams` function
- `validateTeamList` function

**Provides for downstream plans:**
- Plan 03: Team filtering in presentation view (votes have team_id)
- Plan 04: Team-specific QR code generation (teams available in session.teams)
- Plan 05: Team column in CSV export (vote.team_id populated)

## Verification Results

- TypeScript compilation: PASSED (npx tsc --noEmit)
- All files created/modified as specified
- Team picker renders with dropdown and Join button
- Team badge renders in top-right corner
- Admin team config UI functional in draft mode
- Vote components accept and pass through teamId prop

## Self-Check: PASSED

**Created files verified:**
- FOUND: src/components/TeamPicker.tsx
- FOUND: src/components/TeamBadge.tsx

**Modified files verified:**
- FOUND: src/pages/AdminSession.tsx (team config UI, handlers, state)
- FOUND: src/pages/ParticipantSession.tsx (team state, auto-assign, picker gate, badge)
- FOUND: src/components/VoteAgreeDisagree.tsx (teamId prop and payload)
- FOUND: src/components/VoteMultipleChoice.tsx (teamId prop and payload)
- FOUND: src/components/BatchVotingCarousel.tsx (teamId prop and payload)

**Commits verified:**
- FOUND: 340c81d (feat(25-02): add team configuration UI and picker components)
- FOUND: 60b231f (feat(25-02): implement participant team joining flow and vote integration)

## User Workflows Enabled

**Admin Workflow:**
1. Create session (draft mode)
2. Add team names via text input (max 5)
3. Remove teams with Remove button
4. Validation prevents duplicates/max exceeded
5. Go Live → teams locked (config UI hidden)

**Participant Workflow (Self-Select):**
1. Scan general QR code (no ?team param)
2. See team picker gate if session has teams
3. Choose team from dropdown
4. Click "Join Team"
5. Proceed to lobby → voting with team badge visible

**Participant Workflow (Auto-Assign):**
1. Scan team-specific QR code (?team=TeamA)
2. Auto-assigned to TeamA (toast shown for 2s)
3. Proceed to lobby → voting with "TeamA" badge

**Participant Workflow (Team Lock):**
1. Join team and cast first vote
2. Team is now locked
3. Refresh page → team restored from existing votes
4. Cannot switch teams (picker never shown again)

## Next Steps

Plan 03 will add team filtering in presentation view:
- Team filter tabs/dropdown in PresentationControls
- Filter vote aggregation by team_id
- All Teams / Team A / Team B views
- Team-specific result displays
