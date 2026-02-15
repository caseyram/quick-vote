---
phase: 26-sequence-results-enhancements
plan: 01
subsystem: template-authoring
tags: [multi-select, dnd, ux-enhancement]

dependency_graph:
  requires: [session-items-api, sequence-manager-dnd]
  provides: [multi-select-reordering]
  affects: [sequence-manager, sequence-item-card]

tech_stack:
  added:
    - use-multi-select hook (custom state management)
  patterns:
    - shift-click range selection
    - ctrl/meta-click toggle selection
    - group drag with relative order preservation
    - Set-based O(1) selection lookup

key_files:
  created:
    - src/hooks/use-multi-select.ts
  modified:
    - src/components/SequenceManager.tsx
    - src/components/SequenceItemCard.tsx

decisions:
  - "Multi-select enabled only in draft mode (isLive=false)"
  - "Selection uses Set<string> for O(1) lookups"
  - "Group drag preserves relative order of selected items"
  - "Shift-click range selection adds to existing selection (union)"
  - "Selection clears after successful drag, on Escape, and on click-empty-space"
  - "Indigo tint (bg-indigo-100 border-indigo-400) for selected state"
  - "Active state takes precedence over selected state"
  - "DragOverlay shows count badge for multi-item drag"
  - "Auto-clear selection when dragging unselected item"
  - "Prevent text selection during shift-click via onMouseDown preventDefault"

metrics:
  duration: "167 seconds"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  completed: "2026-02-15T02:12:34Z"
---

# Phase 26 Plan 01: Multi-Select Rearrangement Summary

**One-liner:** Shift-click and ctrl-click multi-select with group drag for efficient sequence reordering in draft mode.

## What Was Built

Implemented multi-select functionality for the sequence sidebar, enabling admins to:
- Select ranges via shift-click (from last selected to clicked item, adds to existing selection)
- Toggle individual items via ctrl/cmd-click
- Drag multiple selected items as a group while preserving their relative order
- Clear selection via Escape key or clicking empty space
- See visual feedback with indigo background tint on selected items

The implementation is scoped to **draft mode only** — live mode (PresentationControls) has no selection UI or behavior.

## Tasks Completed

### Task 1: Create useMultiSelect hook and integrate into SequenceManager

**Commit:** 5ae8bc1

Created `src/hooks/use-multi-select.ts` — a reusable hook for managing multi-select state with:
- Shift-click range selection (bidirectional, adds to existing selection)
- Ctrl/Meta-click toggle (add or remove individual item)
- Regular click (select only clicked item)
- Escape key listener (clear all selection)
- Click-empty-space handler (clear all selection)
- Set-based storage for O(1) selection checks
- `lastSelectedId` tracking for shift-range anchoring

Integrated the hook into `SequenceManager.tsx` draft mode:
- Calls `useMultiSelect({ itemIds: sortableIds, enabled: !isLive })`
- Passes `isSelected` and `onSelect` props to each `SequenceItemCard`
- Container div has `onClick={handleContainerClick}` for click-empty deselection
- Container div has `onMouseDown` with `preventDefault()` on shift-click to prevent text selection
- Modified `handleDragStart` to clear selection when dragging unselected item
- Modified `handleDragEnd` to support group drag:
  - Detects group drag when dragged item is in `selectedIds` and size > 1
  - Removes all selected items from order, computes target index in remaining items
  - Inserts all selected items (in original relative order) at target index
  - Clears selection after successful drag
- Updated `DragOverlay` to show count badge (`{selectedIds.size} items`) when multiple items selected

### Task 2: Add selection visual state to SequenceItemCard

**Commit:** 62fabe4

Extended `SequenceItemCard` props with:
- `isSelected?: boolean` — whether this item is part of current multi-selection
- `onSelect?: (event: React.MouseEvent) => void` — click handler that receives MouseEvent for modifier key detection

Updated color classes logic:
```typescript
const colorClasses = isActive
  ? 'bg-blue-100 border-blue-500'       // Active (highest priority)
  : isSelected
  ? 'bg-indigo-100 border-indigo-400'   // Selected
  : isBatch
  ? 'bg-blue-50 border-blue-200 hover:border-blue-300'   // Batch default
  : 'bg-purple-50 border-purple-200 hover:border-purple-300'; // Slide default
```

Click handling:
- When `onSelect` is provided, it becomes the card's click handler (instead of `onClick`)
- When `onSelect` is NOT provided, falls back to `onClick` (live mode behavior)
- Drag handle, batch expand button, and delete button all have `e.stopPropagation()` — they remain unaffected by selection

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All success criteria met:

- [x] Multi-select via shift-click (range) and ctrl/cmd-click (toggle) works in draft mode
- [x] Selected items show indigo background tint (`bg-indigo-100 border-indigo-400`)
- [x] Group drag moves all selected items preserving relative order
- [x] Escape and click-empty-space both clear selection
- [x] Live mode (`isLive=true`) has no selection behavior (hook disabled, no props passed)
- [x] TypeScript compiles without errors

## Technical Details

**Multi-select algorithm:**

1. **Shift-click range:** Finds indices of `lastSelectedId` and clicked item, slices range from `itemIds`, adds to existing `selectedIds` Set (union).
2. **Ctrl/Meta-click toggle:** Adds to Set if not present, removes if present. Updates `lastSelectedId`.
3. **Regular click:** Replaces `selectedIds` with new Set containing only clicked item. Updates `lastSelectedId`.
4. **Escape key:** Global keydown listener clears selection.
5. **Click-empty-space:** Container's `onClick` checks `event.target === event.currentTarget` to avoid clearing on child clicks.

**Group drag algorithm:**

1. Detect group drag: `selectedIds.has(draggedId) && selectedIds.size > 1`
2. Remove all selected items from current `sortableIds` → `remainingIds`
3. Find target index in `remainingIds` based on `over.id`
4. Extract selected items in original order: `sortableIds.filter(id => selectedIds.has(id))`
5. Insert all selected items at target index (after `over.id`):
   ```typescript
   newOrder = [
     ...remainingIds.slice(0, targetIndex + 1),
     ...selectedInOrder,
     ...remainingIds.slice(targetIndex + 1),
   ];
   ```
6. Optimistic update → persist to DB → clear selection on success

**Text selection prevention:** `onMouseDown` on container calls `e.preventDefault()` when `e.shiftKey` is true, preventing browser text selection during shift-click.

**DragOverlay enhancement:** Shows count badge when `selectedIds.size > 1`, otherwise shows single item preview (existing behavior).

## Files Changed

**Created:**
- `src/hooks/use-multi-select.ts` (106 lines)

**Modified:**
- `src/components/SequenceManager.tsx` (+182 lines, group drag logic, multi-select integration)
- `src/components/SequenceItemCard.tsx` (+40 lines, selection props and visual state)

## Next Steps

Plan complete. Multi-select rearrangement ready for testing. Next plan in phase 26 (if any) will focus on results enhancements.

## Self-Check: PASSED

**Created files verification:**
```bash
FOUND: src/hooks/use-multi-select.ts
```

**Modified files verification:**
```bash
FOUND: src/components/SequenceManager.tsx
FOUND: src/components/SequenceItemCard.tsx
```

**Commits verification:**
```bash
FOUND: 5ae8bc1
FOUND: 62fabe4
```

All claimed files and commits exist.
