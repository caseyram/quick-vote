---
phase: 26-sequence-results-enhancements
plan: 02
subsystem: sequence-management
tags: [progress-tracking, ux-simplification, runtime-settings]

dependency_graph:
  requires: [vote-aggregation, sequence-manager, supabase-realtime]
  provides: [live-vote-progress, simplified-session-config]
  affects: [sequence-item-card, presentation-controls, admin-session]

tech_stack:
  added:
    - VoteProgressBar component (real-time vote completion indicator)
  patterns:
    - Real-time progress tracking via existing Supabase subscriptions
    - Conditional rendering based on batch status
    - Runtime-only session configuration (content editing in template editor)

key_files:
  created:
    - src/components/VoteProgressBar.tsx
  modified:
    - src/components/SequenceItemCard.tsx
    - src/components/SequenceManager.tsx
    - src/components/PresentationControls.tsx
    - src/pages/AdminSession.tsx

decisions:
  - "Progress bar renders only for active batches with vote data present"
  - "Green progress bar indicates 100% completion (all participants voted on all questions)"
  - "Blue progress bar indicates voting in progress"
  - "X/Y count format shows total votes vs expected votes"
  - "Draft session config shows only runtime settings (reasons, test mode, teams, sequence)"
  - "Content editing (slides, questions, templates) lives exclusively in template editor"
  - "No new Supabase subscriptions needed - uses existing sessionVotes data from parent"

metrics:
  duration: "250 seconds"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
  completed: "2026-02-15T02:19:28Z"
---

# Phase 26 Plan 02: Live Vote Progress & Simplified Session Config Summary

**One-liner:** Real-time vote progress bars on active batch cards and streamlined draft session config with runtime-only settings.

## What Was Built

Implemented two complementary enhancements:

1. **Live vote progress bars** for active batch cards in the sequence sidebar:
   - Displays X/Y vote count (total votes / expected votes)
   - Blue progress bar during voting, turns green at 100% completion
   - Updates in real-time via existing Supabase realtime subscription
   - Only renders for batches with `status === 'active'` and vote data available

2. **Simplified draft session configuration**:
   - Removed all content editing UI (image uploader, import/export, template panels)
   - Kept only runtime settings: session name, participant link, reasons toggle, test mode toggle, team configuration, and sequence manager
   - Content editing now lives exclusively in the template editor
   - Cleaner, more focused draft session experience

## Tasks Completed

### Task 1: Create VoteProgressBar and wire live vote data through sequence cards

**Commit:** ce1837d

Created `src/components/VoteProgressBar.tsx` - a reusable component for displaying vote completion progress:
- Accepts `batchQuestionIds`, `sessionVotes`, and `participantCount` props
- Calculates total votes across all batch questions
- Calculates expected votes (question count × participant count)
- Computes percentage with division-by-zero guard
- Determines completion status (all questions have >= participantCount votes)
- Renders color-coded progress bar (green when complete, blue otherwise)
- Displays "X/Y" count label
- Smooth 300ms transition animation on progress changes

Extended `SequenceItemCard` props:
- Added `batchQuestionIds?: string[]` - question IDs belonging to this batch
- Added `sessionVotes?: Record<string, Vote[]>` - current vote state
- Added `participantCount?: number` - number of connected participants
- Conditionally renders `VoteProgressBar` when batch is active and vote data is available
- Progress bar appears below the question count line

Extended `SequenceManager` props:
- Added `sessionVotes?: Record<string, Vote[]>`
- Added `participantCount?: number`
- Computes `batchQuestionIds` for each batch item and passes to `SequenceItemCard`
- Applied to both live mode and draft mode card rendering (progress bars only show for active batches)

Wired data from `PresentationControls`:
- Added `sessionVotes` and `participantCount` props to `<SequenceManager>` call
- Props already available in PresentationControls, no new data fetching needed

### Task 2: Simplify AdminSession draft view to runtime-only settings

**Commit:** 1eae097

Removed from draft view JSX:
- Image uploader section (entire block with heading and `<ImageUploader>`)
- Import/export section (entire `<SessionImportExport>` block with refetch logic)
- Response template panel (`<ResponseTemplatePanel />`)
- Template panel (`<TemplatePanel sessionId={session.session_id} />`)
- Session template panel (`<SessionTemplatePanel sessionId={session.session_id} />`)
- Default template selector (entire "Default Template" div with label, description, and `<TemplateSelector>`)
- Bulk apply confirmation dialog (ConfirmDialog at bottom of component)

Removed unused imports:
- `ImageUploader`
- `SessionImportExport`
- `ResponseTemplatePanel`
- `TemplatePanel`
- `SessionTemplatePanel`
- `TemplateSelector`
- `ConfirmDialog`
- `createSlide` (from slide-api)
- `checkQuestionVotes` (from template-api)

Removed unused handlers:
- `handleSlideUploaded` - only used by ImageUploader
- `handleDefaultTemplateChange` - only used by TemplateSelector
- `handleBulkApplyConfirm` - only used by bulk apply dialog
- `handleBulkApplyCancel` - only used by bulk apply dialog

Removed unused state:
- `bulkApplyConfirm` - state for bulk apply confirmation
- `bulkApplying` - loading state for bulk apply
- `pendingBatchId` - unused state variable

Kept in draft view:
- Header with session title, draft badge, and delete button
- Participant link sharing section
- Session Settings section with reasons toggle and test mode toggle
- Team Configuration section
- Session Sequence section with SequenceManager and expanded batch detail panel
- `handleDeleteSlide` - still used by SequenceManager for deleting slides
- `deleteSlide` import - still needed by handleDeleteSlide

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:

- [x] VoteProgressBar component created with real-time vote count display
- [x] Active batch cards show live progress bars with "X/Y" count
- [x] Progress bar updates in real-time via existing Supabase realtime subscription
- [x] Progress bar turns green when all participants voted on all batch questions
- [x] Draft session config shows only runtime settings (title, link, reasons/test toggles, teams, sequence)
- [x] No image uploader, template panels, import/export, or default template selector in session config
- [x] TypeScript compiles without errors
- [x] No unused imports or dead code from removed features

## Technical Details

**VoteProgressBar algorithm:**

1. Sum votes across all batch question IDs: `totalVotes = sum(sessionVotes[qId]?.length || 0)`
2. Calculate expected votes: `totalExpected = batchQuestionIds.length * participantCount`
3. Guard against division by zero: `percent = totalExpected === 0 ? 0 : min(100, (totalVotes / totalExpected) * 100)`
4. Check completion: `allComplete = participantCount > 0 && every(qId => (sessionVotes[qId]?.length || 0) >= participantCount)`
5. Apply color: `bg-green-500` when `allComplete`, `bg-blue-500` otherwise
6. Render with smooth transition: `transition-all duration-300`

**Data flow for progress bars:**

```
AdminSession (isActive=true)
  └─> PresentationControls (receives sessionVotes, participantCount)
      └─> SequenceManager (receives sessionVotes, participantCount)
          └─> SequenceItemCard (receives batchQuestionIds, sessionVotes, participantCount)
              └─> VoteProgressBar (conditionally rendered when batch.status === 'active')
```

No new Supabase subscriptions needed - `sessionVotes` is already maintained by the parent component's realtime channel.

**Conditional rendering logic:**

Progress bar renders when ALL conditions are met:
- `batchQuestionIds` is defined (item is a batch with questions)
- `sessionVotes` is defined (vote data available)
- `participantCount !== undefined` (participant count available)
- `batch.status === 'active'` (batch is actively accepting votes)

This ensures progress bars:
- Never show in draft mode (batches aren't active)
- Never show for closed batches (status !== 'active')
- Never show when vote data isn't available
- Only show when all required data is present

**Simplified session config:**

Before: Draft view had 8 sections (header, link, settings, teams, sequence, image uploader, import/export, 3 template panels)

After: Draft view has 5 sections (header, link, settings, teams, sequence)

Removed: 3 sections, 6 component imports, 4 handler functions, 3 state variables, 2 API imports

## Files Changed

**Created:**
- `src/components/VoteProgressBar.tsx` (51 lines)

**Modified:**
- `src/components/SequenceItemCard.tsx` (+14 lines, added vote progress props and rendering)
- `src/components/SequenceManager.tsx` (+18 lines, added vote data props and pass-through)
- `src/components/PresentationControls.tsx` (+2 lines, wired sessionVotes/participantCount to SequenceManager)
- `src/pages/AdminSession.tsx` (-120 lines, removed content editing UI and handlers)

## Next Steps

Plan complete. Live vote progress bars and simplified session config ready for testing. This completes Phase 26-02.

## Self-Check: PASSED

**Created files verification:**
```bash
FOUND: src/components/VoteProgressBar.tsx
```

**Modified files verification:**
```bash
FOUND: src/components/SequenceItemCard.tsx
FOUND: src/components/SequenceManager.tsx
FOUND: src/components/PresentationControls.tsx
FOUND: src/pages/AdminSession.tsx
```

**Commits verification:**
```bash
FOUND: ce1837d
FOUND: 1eae097
```

All claimed files and commits exist.
