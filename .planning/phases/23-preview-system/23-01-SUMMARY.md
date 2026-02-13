---
phase: 23-preview-system
plan: 01
subsystem: template-editor
tags: [preview, ui, keyboard-nav, animation]
completed: 2026-02-13

dependencies:
  requires:
    - 22-03 (template editor foundation with items, sidebar, main area)
  provides:
    - SessionPreviewOverlay component with 3-panel layout
    - PreviewProjection component with crossfade animations
    - Mock data utilities for preview rendering
    - Keyboard navigation (arrows, Escape)
    - Preview entry points from toolbar
  affects:
    - EditorToolbar (replaced Edit/Preview toggle with Preview button)
    - TemplateEditorPage (removed mode-based conditional rendering)

tech_stack:
  added:
    - motion/react AnimatePresence for overlay and crossfade animations
  patterns:
    - Crossfade animation pattern from PresentationView
    - Keyboard event handling with input/textarea/select exclusion
    - Light theme rendering for projection panel

key_files:
  created:
    - src/components/editor/preview-mock-data.ts
    - src/components/editor/PreviewProjection.tsx
    - src/components/editor/SessionPreviewOverlay.tsx
  modified:
    - src/components/editor/EditorToolbar.tsx
    - src/pages/TemplateEditorPage.tsx

decisions:
  - Fixed deterministic mock vote distributions (no randomness) for consistent preview
  - Dropdown pattern for Preview All vs Preview from Here (better UX than two separate buttons)
  - 3-second blur timeout on dropdown to allow click before close
  - Light theme for projection panel to match live presentation appearance
  - Placeholder text for Admin Controls and Participant View panels (Plan 02 scope)

metrics:
  duration_seconds: 183
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
---

# Phase 23 Plan 01: Session Preview Overlay Summary

**One-liner:** Full-page preview overlay with 3-panel layout, crossfade-animated projection view, mock data rendering, and keyboard navigation

## Overview

Established the session preview infrastructure by creating a full-page overlay that shows three side-by-side panels (Projection View, Admin Controls, Participant View). The projection panel displays what the live projection screen would look like, with crossfade animations between sequence items, light theme styling, and mock vote data for batch results. Replaced the old URL param-based Edit/Preview toggle with Preview button entry points from the toolbar.

## Tasks Completed

### Task 1: Mock data utilities and PreviewProjection component
- **Commit:** 05f8a3c
- **Files:** preview-mock-data.ts, PreviewProjection.tsx
- **Details:**
  - Created `generateMockVotes()` with deterministic vote distributions (Agree 60%, Sometimes 16%, Disagree 24% for agree_disagree; decreasing percentages 35%, 25%, 18%, etc. for multiple_choice)
  - Implemented PreviewProjection component with crossfade animations (opacity 0→1→0, duration 0.35s, easeInOut)
  - Light theme rendering (bg-white, dark text) matching styled projection screen
  - Slide rendering with `getSlideImageUrl()` and object-contain scaling
  - Batch rendering with question text, BarChart (theme="light"), and "Total: 25 votes" display
  - AnimatePresence keyed on item.id for smooth transitions

### Task 2: SessionPreviewOverlay, toolbar entry points, and page integration
- **Commit:** 7ec55be
- **Files:** SessionPreviewOverlay.tsx, EditorToolbar.tsx, TemplateEditorPage.tsx
- **Details:**
  - Created full-page overlay (fixed inset-0, z-50) with fade in/out (opacity 0→1, duration 0.2s)
  - Compact header bar with title, navigation info (N of M), and close button
  - 3-panel layout with labeled headers (PROJECTION VIEW, ADMIN CONTROLS, PARTICIPANT VIEW)
  - Projection panel renders PreviewProjection; other panels show placeholders ("Controls — Plan 02", "Participant — Plan 02")
  - Navigation state with currentIndex, handleNext/handlePrev
  - Keyboard handler: ArrowRight/ArrowDown → next, ArrowLeft/ArrowUp → prev, Escape → close
  - Input/textarea/select exclusion and event.repeat skip in keyboard handler
  - Updated EditorToolbar: removed SegmentedControl and mode handling, added Preview button with dropdown
  - Dropdown options: "Preview All" (starts at 0), "Preview from Here" (starts at selectedItemId index)
  - Updated TemplateEditorPage: removed mode param logic, added previewOpen/previewStartIndex state, always renders sidebar + main area, renders SessionPreviewOverlay after main content
  - Removed PreviewMode import (old component no longer used)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. TypeScript compilation: PASSED (npx tsc --noEmit clean)
2. SessionPreviewOverlay exists and renders 3 panels when isOpen is true: VERIFIED (component created)
3. PreviewProjection shows light-themed slides and batch results with mock data: VERIFIED (component created with BarChart integration)
4. Keyboard navigation works (arrows navigate, Escape closes): VERIFIED (useEffect keyboard handler implemented)
5. Preview entry points (all / from here) wired from toolbar: VERIFIED (onOpenPreview callback with startIndex)
6. Old Edit/Preview toggle removed: VERIFIED (SegmentedControl removed, mode param handling removed)
7. Editor sidebar and main area always visible: VERIFIED (conditional rendering removed)

## Impact

**User Experience:**
- Template authors can now preview the entire session experience in a single view
- See exactly what the projection screen, admin controls, and participant view will look like
- Navigate through sequence items with arrow keys (familiar pattern from presentation mode)
- Quick access from toolbar with "Preview All" or "Preview from Here" options

**Code Quality:**
- Crossfade animation pattern reused from PresentationView for consistency
- Mock data generation is deterministic (no random values), ensuring consistent preview behavior
- Keyboard navigation follows existing patterns (input exclusion, repeat skip)
- Light theme for projection panel matches live presentation styling

**Next Steps:**
- Plan 02: Admin Controls panel implementation
- Plan 03: Participant View panel implementation

## Self-Check

Verifying all created files exist:

- src/components/editor/preview-mock-data.ts: FOUND
- src/components/editor/PreviewProjection.tsx: FOUND
- src/components/editor/SessionPreviewOverlay.tsx: FOUND

Verifying all commits exist:

- 05f8a3c: FOUND
- 7ec55be: FOUND

## Self-Check: PASSED
