---
phase: 22-template-foundation-authoring
plan: 02
subsystem: template-editor
tags: [batch-editing, inline-editing, question-management, duration-input, drag-reorder]
dependency-graph:
  requires: [template-editor-store, editor-components, dnd-kit]
  provides: [batch-editor, question-row, duration-input]
  affects: [template-editor-store, database-types]
tech-stack:
  added: [DurationInput]
  patterns: [collapsible-inline-editing, nested-drag-and-drop, timer-duration-management]
key-files:
  created:
    - src/components/editor/BatchEditor.tsx
    - src/components/editor/QuestionRow.tsx
    - src/components/shared/DurationInput.tsx
  modified:
    - src/stores/template-editor-store.ts
    - src/types/database.ts
    - src/components/editor/EditorMainArea.tsx
    - src/components/editor/EditorToolbar.tsx
decisions:
  - title: "Auto-collapse expanded questions on drag start"
    rationale: "Prevents glitchy drag overlays from expanded question rows (per 22-RESEARCH.md pitfall #2)"
  - title: "Timer duration as number input in seconds"
    rationale: "Simpler UX than separate minute/second inputs, with human-readable conversion displayed below"
  - title: "Batch-level timer_duration in blueprint as optional field"
    rationale: "Backward-compatible with older templates, gracefully handles missing field"
metrics:
  duration: "4 minutes"
  tasks: 2
  files: 7
  commits: 2
  completed: "2026-02-12"
---

# Phase 22 Plan 02: Batch Question Editing Summary

Built inline batch question editing with collapsible QuestionRow components, drag-reorder within batches, and DurationInput for configuring batch timer durations.

## Tasks Completed

### Task 1: BatchEditor with collapsed QuestionRows and drag-reorder
**Commit:** a676db2

Created BatchEditor component with:
- Inline editable batch name (click to edit, Enter/Escape to save/cancel)
- Question count display showing total questions in batch
- Nested DndContext with SortableContext for question drag-reorder (independent from sidebar)
- PointerSensor with distance: 8 activation constraint
- Auto-collapse all expanded questions on drag start (prevents glitchy drag overlays)
- Add Question button creates new EditorQuestion with nanoid ID and auto-expands it
- DragOverlay shows compact question summary during drag (type badge + truncated text)

Created QuestionRow component with:
- Collapsed state: compact row with drag handle (grip dots), type badge (A/D or MC), truncated question text, expand chevron
- Expanded state: all editable fields inline (text textarea, response type select, options for MC, anonymous checkbox, timer override input)
- Click anywhere on collapsed row to expand (except drag handle)
- Collapse via chevron button or Escape key
- Drag handle hidden when expanded (prevents drag-while-editing)
- Auto-collapse on collapseSignal counter change from BatchEditor
- Auto-focus textarea on expand
- Delete question button in expanded view
- All changes immediately update parent batch in store via updateItem

Updated EditorMainArea to use real BatchEditor component instead of placeholder.

**Files:** src/components/editor/BatchEditor.tsx, src/components/editor/QuestionRow.tsx, src/components/editor/EditorMainArea.tsx

### Task 2: DurationInput component and timer duration wiring
**Commit:** 71b7284

Created DurationInput component with:
- Number input for seconds with min=0, step=1
- Human-readable conversion displayed below (e.g., "90" shows "= 1m 30s")
- Empty or 0 value treated as "no timer" (returns null via onChange)
- Styling consistent with other admin inputs
- Props: value, onChange, label, placeholder

Updated BatchEditor to include DurationInput:
- Added to batch header area with label "Batch Timer (seconds)"
- Value bound to item.batch.timer_duration
- onChange updates batch timer_duration in store via updateItem

Updated template-editor-store:
- Added timer_duration: number | null to EditorItem batch interface
- Updated loadFromBlueprint to read timer_duration from blueprint (defaults to null if missing)
- Updated toBlueprint to serialize timer_duration to blueprint
- Updated all batch creation code (fallbacks and addItem calls) to include timer_duration: null

Extended database types:
- Added timer_duration?: number | null to SessionBlueprintItem.batch interface
- Backward-compatible: optional field allows older blueprints without timer_duration to load

Updated EditorMainArea and EditorToolbar:
- Added timer_duration: null to batch creation in handleAddBatch functions

**Files:** src/components/shared/DurationInput.tsx, src/components/editor/BatchEditor.tsx, src/stores/template-editor-store.ts, src/types/database.ts, src/components/editor/EditorMainArea.tsx, src/components/editor/EditorToolbar.tsx

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps completed:
1. `npx tsc --noEmit` passes with no errors
2. BatchEditor renders with collapsible question rows
3. Click question to expand shows all editable fields (text, type, options, anonymous, timer)
4. Drag questions to reorder within batch
5. Expanded questions auto-collapse on drag start
6. Add Question creates new question and auto-expands
7. DurationInput in batch header accepts number input and shows human-readable conversion
8. All edits persist through save/load cycle (verified via store's toBlueprint/loadFromBlueprint)

## Success Criteria

- [x] Batch questions render as collapsed compact rows with type badge and truncated text
- [x] Expanding a question reveals all editable fields inline
- [x] Questions are drag-reorderable within a batch
- [x] New questions can be added at the bottom of the batch
- [x] Batch timer duration is configurable via DurationInput
- [x] All edits immediately update the store and persist through save/load cycle

## Next Steps

Plan 03 will build the preview mode for the template editor. Plan 04 will add template list management on the Home page.

## Self-Check: PASSED

Verified all created files exist:
- [x] src/components/editor/BatchEditor.tsx
- [x] src/components/editor/QuestionRow.tsx
- [x] src/components/shared/DurationInput.tsx

Verified all modified files have expected changes:
- [x] src/stores/template-editor-store.ts (timer_duration added to EditorItem batch, toBlueprint, loadFromBlueprint)
- [x] src/types/database.ts (timer_duration added to SessionBlueprintItem.batch)
- [x] src/components/editor/EditorMainArea.tsx (uses BatchEditor, adds timer_duration to batch creation)
- [x] src/components/editor/EditorToolbar.tsx (adds timer_duration to batch creation)

Verified all commits exist:
- [x] a676db2 (Task 1: BatchEditor with question rows and drag-reorder)
- [x] 71b7284 (Task 2: DurationInput and timer duration wiring)
