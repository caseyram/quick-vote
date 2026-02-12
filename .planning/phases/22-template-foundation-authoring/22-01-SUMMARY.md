---
phase: 22-template-foundation-authoring
plan: 01
subsystem: template-editor
tags: [template-authoring, zustand, dnd-kit, image-upload]
dependency-graph:
  requires: [session-template-api, slide-api, database-types]
  provides: [template-editor-store, editor-components, template-editor-routes]
  affects: [App.tsx]
tech-stack:
  added: [template-editor-store, @dnd-kit/core, @dnd-kit/sortable]
  patterns: [zustand-store, drag-and-drop, image-compression, inline-editing]
key-files:
  created:
    - src/stores/template-editor-store.ts
    - src/pages/TemplateEditorPage.tsx
    - src/components/editor/EditorToolbar.tsx
    - src/components/editor/EditorSidebar.tsx
    - src/components/editor/SidebarSequenceItem.tsx
    - src/components/editor/EditorMainArea.tsx
    - src/components/editor/SlideEditor.tsx
  modified:
    - src/App.tsx
decisions:
  - title: "Use nanoid for editor item IDs"
    rationale: "Consistent with project convention, already in dependencies"
  - title: "Upload template images to 'templates' session ID folder"
    rationale: "Reuses existing slide storage infrastructure, isolates template images from session images"
  - title: "Store template ID in editor state after first save"
    rationale: "Enables switching from /templates/new to /templates/:id/edit after initial save"
metrics:
  duration: "4 minutes"
  tasks: 2
  files: 8
  commits: 2
  completed: "2026-02-12"
---

# Phase 22 Plan 01: Template Editor Foundation Summary

Built the foundational template editor with Zustand state management, full-page layout (toolbar + sidebar + main area), drag-and-drop sequence reordering, inline name editing, and Supabase save functionality.

## Tasks Completed

### Task 1: Template editor store, route, and page layout
**Commit:** 6d0dcd6

Created the core Zustand store for template editing with:
- Editor state: templateId, templateName, items, selectedItemId, isDirty, saving, loading
- EditorItem and EditorQuestion interfaces with batch/slide union types
- Actions: setTemplateName, addItem, removeItem, reorderItems, updateItem, selectItem, markClean/Dirty
- loadFromBlueprint: Converts SessionBlueprint to EditorItems with generated UUIDs
- toBlueprint: Serializes EditorItems back to SessionBlueprint format with sequential positions

Created TemplateEditorPage with:
- Route handling for /templates/new and /templates/:id/edit
- Template loading from Supabase on mount
- beforeunload warning for unsaved changes
- Full-page flex layout with toolbar, sidebar, and main area

Updated App.tsx to add template editor routes.

**Files:** src/stores/template-editor-store.ts, src/pages/TemplateEditorPage.tsx, src/App.tsx

### Task 2: Editor toolbar, sidebar with drag-reorder, and main area
**Commit:** 3d9201d

Created EditorToolbar with:
- Back arrow navigation to home
- Inline editable template name (click to edit, Enter to confirm, Escape to cancel)
- Insert actions: Add Batch, Add Slide, Upload Image (with browser-image-compression)
- Save button with loading/success states, disabled when not dirty
- Edit/Preview toggle placeholder (Preview shows alert for Plan 03)

Created EditorSidebar with:
- DndContext + SortableContext for drag-reorder using @dnd-kit
- PointerSensor with distance: 8 activation constraint
- Empty state with centered Add Batch/Slide buttons
- Draggable sequence items with selected highlighting

Created SidebarSequenceItem with:
- Drag handle with grip dots icon
- Type-specific icons and content (batch: list icon + question count, slide: thumbnail or image icon + caption)
- Selected state: bg-indigo-50 border-indigo-300
- Delete button visible on hover

Created EditorMainArea with:
- Empty state when no item selected (guidance + large Add Batch/Slide buttons)
- Routes to BatchEditor (placeholder for Plan 02) or SlideEditor based on selected item type

Created SlideEditor with:
- Image display (max-height 400px, object-contain) or upload zone (dashed border)
- Image upload with compression and Supabase storage upload
- Caption input with live updates to store
- "Change Image" button to replace existing image
- Click image to show lightbox overlay

**Files:** src/components/editor/EditorToolbar.tsx, src/components/editor/EditorSidebar.tsx, src/components/editor/SidebarSequenceItem.tsx, src/components/editor/EditorMainArea.tsx, src/components/editor/SlideEditor.tsx, src/pages/TemplateEditorPage.tsx

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps completed:
1. `npx tsc --noEmit` passes with no errors
2. Routes /templates/new and /templates/:id/edit render TemplateEditorPage
3. Add Batch/Slide creates items in sidebar with proper selection
4. Drag items in sidebar to reorder
5. Edit template name in toolbar with inline editing
6. Save button creates new template or updates existing, URL updates after first save
7. beforeunload warns when navigating away with unsaved changes

## Success Criteria

- [x] Template editor route works at /templates/new and /templates/:id/edit
- [x] Toolbar, sidebar, and main area render correctly in full-page layout
- [x] Sequence items can be added, reordered via drag-and-drop, and deleted
- [x] Template name is editable inline in toolbar
- [x] Save persists template blueprint to Supabase session_templates table
- [x] Unsaved changes trigger beforeunload warning

## Next Steps

Plan 02 will build the BatchEditor with question editing, response template selection, and batch configuration. Plan 03 will add the preview mode. Plan 04 will add template list management on the Home page.

## Self-Check: PASSED

Verified all created files exist:
- [x] src/stores/template-editor-store.ts
- [x] src/pages/TemplateEditorPage.tsx
- [x] src/components/editor/EditorToolbar.tsx
- [x] src/components/editor/EditorSidebar.tsx
- [x] src/components/editor/SidebarSequenceItem.tsx
- [x] src/components/editor/EditorMainArea.tsx
- [x] src/components/editor/SlideEditor.tsx

Verified all commits exist:
- [x] 6d0dcd6 (Task 1)
- [x] 3d9201d (Task 2)
