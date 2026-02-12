---
phase: 22-template-foundation-authoring
plan: 03
subsystem: template-editor
tags: [preview-mode, lightbox, session-creation, yet-another-react-lightbox]
dependency-graph:
  requires: [template-editor-store, session-template-api, slide-api]
  provides: [PreviewMode, SegmentedControl, SlideLightbox, quick-session-flows]
  affects: [EditorToolbar, TemplateEditorPage, Home, SidebarSequenceItem, SlideEditor]
tech-stack:
  added: [yet-another-react-lightbox]
  patterns: [url-search-params, keyboard-navigation, lightbox-wrapper, session-materialization]
key-files:
  created:
    - src/components/editor/SegmentedControl.tsx
    - src/components/editor/PreviewMode.tsx
    - src/components/shared/SlideLightbox.tsx
  modified:
    - src/components/editor/EditorToolbar.tsx
    - src/pages/TemplateEditorPage.tsx
    - src/components/editor/SlideEditor.tsx
    - src/components/editor/SidebarSequenceItem.tsx
    - src/pages/Home.tsx
    - src/stores/template-editor-store.ts
decisions:
  - title: "Use URL search params for edit/preview mode"
    rationale: "Enables deep-linking to preview mode, no additional state management needed"
  - title: "Install yet-another-react-lightbox for image viewing"
    rationale: "Battle-tested library for lightbox functionality, minimal setup required"
  - title: "Restructure Home page with three session creation paths"
    rationale: "Create New (template editor), Quick Session (direct), New from Template (copy) - clear separation of flows"
  - title: "Add Start Session button alongside Save Template"
    rationale: "Separate one-off session launch from template persistence, clear user intent"
metrics:
  duration: "6 minutes"
  tasks: 2
  files: 10
  commits: 2
  completed: "2026-02-12"
---

# Phase 22 Plan 03: Edit/Preview Toggle, Lightbox, Quick Session Summary

Edit/preview toggle with segmented control, preview mode with next/prev navigation and keyboard shortcuts, slide image lightbox using yet-another-react-lightbox, and restructured Home page with Create New / Quick Session / New from Template flows plus Start Session button in editor.

## Tasks Completed

### Task 1: Edit/Preview toggle and PreviewMode component
**Commit:** b6f13b8

Created SegmentedControl component:
- Reusable segmented control with options array, value, and onChange props
- Active state: bg-white shadow-sm text-gray-900
- Inactive state: text-gray-500 hover:text-gray-700
- Compact sizing: text-sm, px-3 py-1.5

Created PreviewMode component:
- Reads items from template-editor-store
- Local currentIndex state for navigation
- Renders current sequence item full-width:
  - Batch items: formatted batch preview with question list, type badges, anonymous flag
  - Slide items: full-size image (max-height 70vh) with caption
- Navigation bar with Previous/Next buttons and position indicator
- Keyboard shortcuts: ArrowLeft for prev, ArrowRight for next
- Empty state: "No items to preview. Add batches or slides in Edit mode."

Updated EditorToolbar:
- Replaced edit/preview toggle placeholder with SegmentedControl
- Mode managed via URL search param `?mode=preview` (default 'edit')
- useSearchParams from react-router for state management

Updated TemplateEditorPage:
- Read mode from URL search params
- Conditionally render PreviewMode (mode='preview') or sidebar + main area (mode='edit')

**Files:** src/components/editor/SegmentedControl.tsx, src/components/editor/PreviewMode.tsx, src/components/editor/EditorToolbar.tsx, src/pages/TemplateEditorPage.tsx

### Task 2: Slide lightbox and quick session flow
**Commit:** 69e05a5

Installed yet-another-react-lightbox:
- `npm install yet-another-react-lightbox`

Created SlideLightbox component:
- Wrapper around yet-another-react-lightbox
- Props: open, onClose, imageSrc, alt
- Single-image lightbox with simple API

Updated SlideEditor:
- Add lightboxOpen state
- Click slide image to open lightbox
- Add cursor-pointer and hover:opacity-90 to image
- Replace custom lightbox overlay with SlideLightbox component

Updated SidebarSequenceItem:
- Add lightboxOpen state
- Make slide thumbnails clickable to open lightbox
- Stop propagation on thumbnail click to prevent item selection
- Render SlideLightbox for slide items

Restructured Home page:
- Create New button: navigates to `/templates/new` (blank template editor)
- Quick Session section: existing createSession flow with title input
- New from Template section: fetches templates, displays list, navigates to `/templates/:id/edit?from=template`
- Fetch templates on mount via fetchSessionTemplates

Updated TemplateEditorPage:
- Check for `?from=template` search param
- If present: load as copy (null templateId, append "(Copy)" to name)
- Clear `from` param after loading to prevent re-triggering

Updated template-editor-store:
- Update loadFromBlueprint signature to accept `templateId: string | null`

Updated EditorToolbar:
- Add Start Session button (green, next to Save Template)
- handleStartSession: serialize to blueprint, create session in Supabase, call loadTemplateIntoSession, navigate to admin view
- Disable Start Session when no items or starting
- Rename Save button label to "Save Template" for clarity

**Files:** src/components/shared/SlideLightbox.tsx, src/components/editor/SlideEditor.tsx, src/components/editor/SidebarSequenceItem.tsx, src/pages/Home.tsx, src/pages/TemplateEditorPage.tsx, src/stores/template-editor-store.ts, src/components/editor/EditorToolbar.tsx, package.json, package-lock.json

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps completed:
1. `npx tsc --noEmit` passes with no errors
2. Toggle Edit/Preview - sidebar hides/shows, preview renders sequence items
3. Preview next/prev navigation works with buttons and arrow keys
4. Click slide image in editor - lightbox overlay shows full image
5. Click slide thumbnail in sidebar - lightbox opens
6. Home page: "Create New" opens /templates/new
7. Home page: "Quick Session" creates session directly (existing behavior)
8. Home page: "New from Template" opens editor with template copy
9. Editor toolbar: "Start Session" creates session from blueprint, navigates to admin view
10. Editor toolbar: "Save Template" saves to Supabase (existing save behavior)

## Success Criteria

- [x] Edit/Preview toggle works via SegmentedControl with URL search param persistence
- [x] Preview mode shows formatted sequence items one at a time with next/prev navigation
- [x] Lightbox opens on slide image/thumbnail click using yet-another-react-lightbox
- [x] Quick session flow: Create New, Quick Session, and New from Template all work from Home page
- [x] Start Session in editor creates a one-off session without saving a template

## Next Steps

Plan 04 will add template list management on the Home page with edit, rename, delete, and duplicate actions.

## Self-Check: PASSED

Verified all created files exist:
- [x] src/components/editor/SegmentedControl.tsx
- [x] src/components/editor/PreviewMode.tsx
- [x] src/components/shared/SlideLightbox.tsx

Verified all commits exist:
- [x] b6f13b8 (Task 1)
- [x] 69e05a5 (Task 2)
