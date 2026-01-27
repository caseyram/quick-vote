---
phase: 05-immersive-ui-and-polish
plan: 01
subsystem: ui-foundation
tags: [motion, animation, tailwind-theme, connection-indicator]

dependency_graph:
  requires: [04-01, 04-02]
  provides: [motion-library, tailwind-theme-tokens, connection-pill-component]
  affects: [05-02, 05-03, 05-04]

tech_stack:
  added: ["motion@12.29.2"]
  patterns: ["motion/react imports", "AnimatePresence for conditional rendering", "layout prop for smooth resizing", "oklch color tokens in Tailwind @theme"]

key_files:
  created:
    - src/components/ConnectionPill.tsx
  modified:
    - src/index.css
    - package.json
    - package-lock.json

decisions:
  - id: motion-v12-standard-import
    description: "Use standard motion import (not LazyMotion) -- 34kb justified for animation-heavy app"
  - id: oklch-color-tokens
    description: "Theme tokens use oklch color space for perceptual uniformity"
  - id: connection-pill-not-banner
    description: "ConnectionPill is a new component alongside ConnectionBanner (banner preserved for admin use)"

metrics:
  duration: ~4 minutes
  completed: 2026-01-27
---

# Phase 5 Plan 01: Animation Foundation and Theme Tokens Summary

**One-liner:** Installed motion v12.29.2 animation library, added oklch-based Tailwind theme tokens for dark surfaces and vote colors, and created ConnectionPill floating status indicator with animated dot and conditional text label.

## What Was Built

### Task 1: Install motion and add Tailwind theme tokens
- Installed `motion` v12.29.2 (4 packages added, React 19 compatible)
- Added `@theme` block to `src/index.css` with four semantic color tokens:
  - `--color-surface-dark` (oklch 0.145) -- deep charcoal for participant background
  - `--color-surface-elevated` (oklch 0.205) -- slightly lighter card surface
  - `--color-vote-agree` (oklch 0.637, blue) -- agree vote color
  - `--color-vote-disagree` (oklch 0.702, orange) -- disagree vote color
- All tokens usable as Tailwind utilities: `bg-surface-dark`, `bg-surface-elevated`, `bg-vote-agree`, `bg-vote-disagree`

### Task 2: Create ConnectionPill component
- New `src/components/ConnectionPill.tsx` -- floating pill in top-right corner (fixed, z-50)
- Four connection states with distinct visual treatment:
  - **Connected:** gray-800/80 pill, green dot with pulsing scale animation (1 -> 1.3 -> 1, 2s repeat)
  - **Reconnecting:** yellow-900/90 pill, yellow dot, "Reconnecting" text label
  - **Disconnected:** red-900/90 pill, red dot, "Disconnected" text label
  - **Connecting:** gray-800/80 pill, yellow dot, no text (silent initial connection)
- Uses `motion.div` with `layout` prop for smooth width transitions when text appears/disappears
- Uses `AnimatePresence` to animate text label in/out (width: 0 -> auto with opacity)
- Imports `ConnectionStatus` type from `use-realtime-channel` hook (type-safe)
- Does NOT modify existing `ConnectionBanner.tsx` (preserved for admin pages)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Standard `motion` import over LazyMotion | App is animation-heavy (vote buttons, transitions, gestures); 34kb justified, avoids complexity |
| oklch color space for theme tokens | Perceptually uniform -- consistent lightness/saturation across blue and orange vote colors |
| ConnectionPill as new component (not replacing ConnectionBanner) | Banner remains available for admin pages; pill is participant-specific per CONTEXT.md |
| Reconnecting state shows text label | Users need to know the app is working on reconnection vs fully disconnected |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npm ls motion` shows v12.x | PASS -- v12.29.2 |
| `npx tsc --noEmit` zero errors | PASS |
| index.css has @theme with 4 tokens | PASS |
| ConnectionPill.tsx exports ConnectionPill | PASS |
| Imports from "motion/react" | PASS |

## Commits

| Hash | Message |
|------|---------|
| 7f1f9fd | chore(05-01): install motion and add Tailwind theme tokens |
| 39f6035 | feat(05-01): create ConnectionPill floating connection status indicator |

## Next Phase Readiness

**Ready for 05-02 (Vote Interaction Animations).** The motion library and theme tokens are available for:
- `motion.button` with `whileTap` for vote button interactions
- `AnimatePresence` for question slide transitions
- Theme tokens for dark background and vote colors

**No blockers.** All exports and types are in place.
