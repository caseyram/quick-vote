---
phase: 17-unified-sequence
plan: 01
subsystem: database
tags: [supabase, postgres, session_items, zustand, backfill, cascade]

# Dependency graph
requires:
  - phase: 16-image-slides
    provides: session_items table and migration with CASCADE constraints
provides:
  - sequence-api.ts with ensureSessionItems, createBatchSessionItem, reorderSessionItems
  - sessionItems state in session store with CRUD actions
  - Automatic backfill of session_items from batch ordering
  - Session item creation integrated into batch lifecycle
affects: [17-02-unified-sequence-ui, 18-19-20-presentation-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Idempotent backfill pattern for existing sessions
    - Sequential position updates to avoid race conditions
    - CASCADE deletion with store refresh pattern

key-files:
  created:
    - src/lib/sequence-api.ts
  modified:
    - src/stores/session-store.ts
    - src/pages/AdminSession.tsx
    - src/pages/AdminSession.test.tsx

key-decisions:
  - "ensureSessionItems is idempotent - safe to call multiple times"
  - "Batch session_items get positions from batch.position order during backfill"
  - "Do NOT modify existing slide positions during backfill - leave as-is"
  - "Re-fetch session_items after batch deletion to reflect CASCADE cleanup"

patterns-established:
  - "Backfill checks for existence before creating (batch-type items as sentinel)"
  - "Sequential updates for position changes (proven from AdminSession handleReorderItems)"
  - "Store refresh after CASCADE operations to maintain consistency"

# Metrics
duration: 6min
completed: 2026-02-10
---

# Phase 17 Plan 01: Unified Sequence Data Layer Summary

**Session items CRUD with idempotent backfill, Zustand store integration, and automatic batch lifecycle sync**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-11T03:43:30Z
- **Completed:** 2026-02-10T22:49:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created sequence-api.ts with ensureSessionItems (idempotent backfill), createBatchSessionItem, and reorderSessionItems
- Extended session store with sessionItems state array and 4 CRUD actions (set/add/remove/updatePositions)
- Integrated backfill into AdminSession load flow - existing sessions auto-populate session_items
- Wired batch creation and deletion into session_items lifecycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sequence-api.ts with CRUD and backfill** - `6d6d0b2` (feat)
2. **Task 2: Extend session store and wire backfill into AdminSession** - `159c920` (feat)

**Plan metadata:** (will be committed separately)

## Files Created/Modified
- `src/lib/sequence-api.ts` - Session items CRUD API with idempotent backfill logic
- `src/stores/session-store.ts` - Added sessionItems array state with set/add/remove/updatePositions actions
- `src/pages/AdminSession.tsx` - Calls ensureSessionItems on load, creates items on batch create, refreshes on batch delete
- `src/pages/AdminSession.test.tsx` - Updated mocks to support new store methods and sequence-api functions

## Decisions Made

**1. Idempotent backfill pattern**
- ensureSessionItems checks if batch-type items exist before creating
- Second call returns immediately - safe to call on every session load
- Prevents duplicate session_items from multiple loads

**2. Preserve existing slide positions during backfill**
- Batches get positions 0..N-1 from their batch.position order
- Slide items keep their current positions
- Position collisions acceptable - reorder function can fix later

**3. Sequential position updates**
- reorderSessionItems updates positions one-by-one in a for loop
- Proven pattern from AdminSession handleReorderItems
- Avoids type issues with PostgrestFilterBuilder

**4. Store refresh after CASCADE deletion**
- Batch deletion cascades to session_items (FK ON DELETE CASCADE)
- Re-fetch all session_items after delete to reflect changes
- Maintains store consistency with database state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all operations worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 17-02 (Unified Sequence UI):**
- Data layer complete: session_items table populated via backfill
- Store state available: sessionItems array in session store
- CRUD operations ready: create/read/update/delete via sequence-api.ts
- Batch lifecycle integrated: session_items auto-created and deleted with batches

**No blockers.**

UI implementation can now:
- Read sessionItems from store to render unified drag-and-drop list
- Call reorderSessionItems to persist position changes
- Rely on automatic session_item creation/deletion for batches

---
*Phase: 17-unified-sequence*
*Completed: 2026-02-10*
