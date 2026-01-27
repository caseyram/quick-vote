---
phase: "04"
plan: "02"
subsystem: "ui-components"
tags: ["bar-chart", "countdown-timer", "connection-banner", "participant-count", "realtime-sql"]
dependency-graph:
  requires: ["03-03"]
  provides: ["BarChart component", "CountdownTimer component", "ConnectionBanner component", "ParticipantCount component", "realtime publication SQL"]
  affects: ["04-03", "04-04"]
tech-stack:
  added: []
  patterns: ["pure presentational components", "CSS height transitions for animation", "inline SVG icons"]
key-files:
  created:
    - "src/components/BarChart.tsx"
    - "src/components/CountdownTimer.tsx"
    - "src/components/ConnectionBanner.tsx"
    - "src/components/ParticipantCount.tsx"
    - ".planning/phases/04-realtime-and-live-session-orchestration/realtime-publication.sql"
  modified: []
decisions:
  - id: "BARCHART-CSS"
    decision: "CSS height transitions (0.5s ease-out) for bar chart animation"
    rationale: "Simple, performant, no extra dependencies -- CSS transitions handle smooth growth as vote data changes"
  - id: "COLOR-PALETTE"
    decision: "Blue/orange for agree/disagree, 8-color palette for multiple choice"
    rationale: "Neutral palette avoids implying right/wrong per CONTEXT.md decisions"
  - id: "TIMER-PILL"
    decision: "Pill badge with clock icon for countdown display"
    rationale: "Compact, non-distracting design per CONTEXT.md ('small, non-distracting, in the corner')"
metrics:
  duration: "~2 minutes"
  completed: "2026-01-27"
---

# Phase 4 Plan 2: Realtime UI Components and SQL Prerequisites Summary

**One-liner:** Four pure presentational components (BarChart, CountdownTimer, ConnectionBanner, ParticipantCount) and Supabase Realtime publication SQL for live session UI.

## What Was Built

### BarChart Component (src/components/BarChart.tsx)
- Vertical bar chart using flexbox layout with 300px container height
- Each bar animates smoothly via CSS `transition: height 0.5s ease-out`
- Displays count + percentage label above each bar, text label below
- Minimum height of 4px for bars with votes (prevents invisible bars)
- Exported color constants: `AGREE_DISAGREE_COLORS` (blue/orange) and `MULTI_CHOICE_COLORS` (8 distinct colors)
- Optional `totalVotes` prop to display total below the chart

### CountdownTimer Component (src/components/CountdownTimer.tsx)
- Compact pill badge with inline clock SVG icon (16x16)
- Returns null when `isRunning` is false (no render overhead)
- Normal state: gray background with gray text
- Urgency state (<=5 seconds): red background with `animate-pulse` CSS animation
- Subtle, non-distracting design aligned with CONTEXT.md vision

### ConnectionBanner Component (src/components/ConnectionBanner.tsx)
- Fixed top banner (z-50) for connection status display
- Returns null for `connected` and `connecting` states
- Reconnecting: yellow banner with spinning SVG indicator + "Reconnecting..." text
- Disconnected: red banner with "Connection lost. Please refresh if this persists."
- Auto-dismisses when parent passes `connected` status

### ParticipantCount Component (src/components/ParticipantCount.tsx)
- Inline badge with pulsing green dot (animate-pulse) when count > 0
- Gray dot (no pulse) when count is 0
- Displays "{count} connected" text

### Realtime Publication SQL
- ALTER PUBLICATION statements for `votes` and `questions` tables
- Must be run in Supabase SQL Editor before Phase 4 testing
- Documented as idempotent-safe with skip instructions

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| BARCHART-CSS | CSS height transitions for bar animation | Simple, performant, zero dependencies |
| COLOR-PALETTE | Blue/orange agree/disagree, 8-color multiple choice | Neutral palette per CONTEXT.md |
| TIMER-PILL | Pill badge with clock SVG for countdown | Non-distracting per CONTEXT.md |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass -- zero errors |
| `npm run build` | Pass |
| All 5 artifacts exist | Pass |
| BarChart min_lines (40) | Pass (69 lines) |
| CountdownTimer min_lines (20) | Pass (35 lines) |
| ConnectionBanner min_lines (15) | Pass (46 lines) |
| ParticipantCount min_lines (15) | Pass (18 lines) |
| SQL min_lines (3) | Pass (12 lines) |
| BarChart `transition.*height` pattern | Pass |
| CountdownTimer `remainingSeconds` pattern | Pass |
| Color constants exported | Pass |
| All components pure presentational | Pass |

## Commits

| Hash | Message |
|------|---------|
| 482be22 | feat(04-02): create BarChart and CountdownTimer components |
| 3fa93cd | feat(04-02): create ConnectionBanner, ParticipantCount, and realtime SQL |

## Next Phase Readiness

Plans 03 and 04 can now import these components directly:
- Admin pages (04-03) will use BarChart, CountdownTimer, ParticipantCount
- Participant pages (04-04) will use CountdownTimer, ConnectionBanner, ParticipantCount
- SQL must be executed in Supabase dashboard before realtime subscriptions will emit events
