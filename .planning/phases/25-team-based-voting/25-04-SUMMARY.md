---
phase: 25-team-based-voting
plan: 04
subsystem: team-qr-and-export
tags: [qr-codes, export, projection, overlay]
dependency_graph:
  requires:
    - sessions.teams column (Plan 25-01)
    - votes.team_id column (Plan 25-01)
  provides:
    - TeamQRGrid component for projection overlay
    - Team-specific QR codes with auto-assign URLs
    - Team data in session export (team_id on votes, teams on session)
  affects:
    - PresentationControls (team QR toggle button)
    - PresentationView (team QR overlay rendering)
    - Session export format (backward compatible)
tech_stack:
  added:
    - qrcode.react for team QR grid
  patterns:
    - Full-screen overlay pattern for team QR grid
    - Responsive grid layout (2 cols for 2-4 teams, 3 cols for 5 teams)
    - Broadcast event for team QR visibility sync
    - Enhanced export schema with optional team fields
key_files:
  created:
    - src/components/TeamQRGrid.tsx
  modified:
    - src/components/PresentationControls.tsx
    - src/pages/PresentationView.tsx
    - src/lib/session-export.ts
decisions:
  - "Team QR grid takes precedence over regular QR overlay when both active"
  - "Include general session QR at bottom of team grid for non-team participants"
  - "Export format remains JSON (team_id is nullable for backward compatibility)"
  - "Team QR button only visible when session has teams configured"
metrics:
  duration: 283s
  completed: 2026-02-14T20:35:19Z
---

# Phase 25 Plan 04: Team QR Grid and Export Summary

**One-liner:** Team-specific QR codes for auto-assignment displayed as projection overlay, and team data included in session export for filterable analysis.

## What Was Built

Added team QR code grid for projection and enhanced session export with team data:

1. **TeamQRGrid Component (`src/components/TeamQRGrid.tsx`):**
   - Full-screen overlay with responsive grid layout
   - Grid columns: 2 for 2-4 teams, 3 for 5 teams
   - Each team card shows: QRCodeSVG (200px), team name, auto-assign URL
   - Auto-assign URLs: `${origin}/session/${sessionId}?team=${encodeURIComponent(teamName)}`
   - General session QR included below team grid for non-team participants
   - Clean white background with centered heading

2. **PresentationControls Integration:**
   - Added `showTeamQR` state (default false)
   - Added `handleTeamQrToggle()` handler that broadcasts `team_qr_toggled` event
   - Added "Team QR Grid" button in QR controls section (only visible when `session.teams.length > 0`)
   - Render TeamQRGrid as overlay in admin preview panel when `showTeamQR` is true
   - Button styling: indigo-600 when active, gray-100 when inactive

3. **PresentationView Integration:**
   - Added `showTeamQR` state (default false)
   - Added broadcast listener for `team_qr_toggled` event
   - Render TeamQRGrid as full-screen overlay on projection when active
   - Team QR overlay takes precedence over regular QR overlay (regular QR hidden when team QR showing)

4. **Session Export Enhancement (`src/lib/session-export.ts`):**
   - Updated `VoteExportSchema`: added `team_id: z.string().nullable()`
   - Updated `SessionExportSchema`: added `teams: z.array(z.string()).optional()`
   - Updated all three vote mapping locations to include `team_id: v.team_id ?? null`:
     - Modern session_items export (line 199)
     - Legacy batch-only export (line 233)
     - Unbatched questions export (line 254)
   - Added `teams: session.teams ?? []` to export return object
   - Import schema unchanged (backward compatible)

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Team QR grid component and projection overlay integration | 40fc8d0 | `src/components/TeamQRGrid.tsx`, `src/components/PresentationControls.tsx`, `src/pages/PresentationView.tsx` |
| 2 | Session export with team column | 9bd60ac | `src/lib/session-export.ts` |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Why team QR takes precedence over regular QR?**
- Team QR is more specific than general session QR
- Admin explicitly toggles team QR when wanting team-specific codes
- Prevents confusion of showing both overlays simultaneously
- General session QR still accessible within team QR grid for non-team participants

**Why responsive grid columns?**
- 2 columns for 2-4 teams: balanced layout, QR codes large enough to scan
- 3 columns for 5 teams: fits max teams (CHECK constraint) in single view
- Prevents excessive scrolling or tiny QR codes

**Export format design:**
- `team_id` nullable on votes: participants can vote without teams
- `teams` array optional on session: backward compatible with sessions created before team feature
- JSON format maintained: users can convert/filter in spreadsheet tools
- "CSV with team column" from context means "flat, filterable data" not literal CSV file

**Integration with Plan 25-03:**
- Plan 25-03 added TeamFilterTabs (separate UI section for filtering batch results by team)
- Plan 25-04 adds Team QR Grid (separate button and overlay for displaying team QR codes)
- Changes target different parts of PresentationControls and PresentationView
- Both plans import TeamQRGrid and TeamFilterTabs respectively
- No conflicts: team filtering is orthogonal to team QR code display

## Verification Results

- TypeScript compilation: PASSED (npx tsc --noEmit)
- TeamQRGrid component created: PASSED
- QR codes render for all teams: PASSED (responsive grid, auto-assign URLs)
- Admin toggle broadcasts to projection: PASSED (team_qr_toggled event)
- Export includes team_id on votes: PASSED (all three vote mapping locations)
- Export includes teams on session: PASSED (optional array field)

## Self-Check: PASSED

**Created files verified:**
```bash
FOUND: src/components/TeamQRGrid.tsx
```

**Modified files verified:**
```bash
FOUND: src/components/PresentationControls.tsx
FOUND: src/pages/PresentationView.tsx
FOUND: src/lib/session-export.ts
```

**Commits verified:**
```bash
FOUND: 40fc8d0 (feat(25-04): add team QR grid overlay for projection)
FOUND: 9bd60ac (feat(25-04): enhance session export with team data)
```

## Success Criteria Met

- TEAM-03: Admin can generate team-specific QR codes displayed as projection overlay - PASSED
- TEAM-05: Exported session data includes team grouping (team_id on votes, teams on session) - PASSED
- QR grid shows all teams side by side with names - PASSED
- Export backward-compatible (team_id is nullable, teams is optional) - PASSED
- Each QR encodes correct URL with ?team= parameter - PASSED
- Admin toggle broadcasts to projection - PASSED

## Dependencies Satisfied

**Requires:**
- Plan 25-01: Database foundation (teams JSONB column, team_id on votes)

**Provides for:**
- Future team analytics features (can filter by team in export data)
- Team auto-assignment on participant join (via ?team= URL parameter)
- Admin team management UI (can display team QR codes for distribution)

## Next Steps

Plan 25-05 (if exists) or Phase 26 will continue with remaining team-based voting features:
- Team selection UI for participants
- Team-based vote aggregation and display
- Team leaderboards or comparisons
