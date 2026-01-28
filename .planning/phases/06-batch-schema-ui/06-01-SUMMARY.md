---
phase: 06-batch-schema-ui
plan: 01
subsystem: data-layer
tags: [database, types, zustand, batches]

dependency_graph:
  requires: [05-results-reveal]
  provides: [batch-schema, batch-types, batch-store-methods]
  affects: [06-02, 06-03, 07-01]

tech_stack:
  added: []
  patterns: [nullable-fk-for-optional-relationship, position-sorting]

key_files:
  created:
    - sql/add-batches.sql
  modified:
    - src/types/database.ts
    - src/stores/session-store.ts
    - src/stores/session-store.test.ts

decisions:
  - id: D-0601-01
    choice: "Place migration in sql/ directory (not supabase/migrations/)"
    why: "Project uses sql/ for all database schema files, consistent with existing pattern"

metrics:
  duration: 4m
  completed: 2026-01-28
---

# Phase 06 Plan 01: Batch Schema & Store Summary

**One-liner:** Database schema for batches table with nullable FK on questions, plus Zustand store with batch CRUD methods

## What Was Built

### 1. Database Migration (sql/add-batches.sql)

Created batches table:
- `id` UUID PRIMARY KEY with gen_random_uuid() default
- `session_id` TEXT NOT NULL with FK to sessions(session_id) ON DELETE CASCADE
- `name` TEXT NOT NULL DEFAULT 'Untitled Batch'
- `position` INTEGER NOT NULL DEFAULT 0
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Added batch_id to questions:
- UUID type, nullable (preserves unbatched questions for v1.0 compatibility)
- Foreign key to batches(id) ON DELETE SET NULL (non-destructive)

Created indexes:
- `idx_batches_session_id` on batches(session_id)
- `idx_questions_batch_id` on questions(batch_id)

RLS policies:
- Enabled RLS with standard CRUD policies matching existing pattern
- Session creator can insert/update/delete batches
- Anyone authenticated can read batches

### 2. TypeScript Types (src/types/database.ts)

```typescript
export interface Batch {
  id: string;
  session_id: string;
  name: string;
  position: number;
  created_at: string;
}

// Question now includes:
batch_id: string | null;
```

### 3. Session Store (src/stores/session-store.ts)

Added batch state and methods:

```typescript
// State
batches: Batch[]

// Methods
setBatches: (batches: Batch[]) => void    // Set all, sorted by position
addBatch: (batch: Batch) => void          // Add and re-sort
updateBatch: (id, updates) => void        // Partial update by id
removeBatch: (id: string) => void         // Filter out by id
```

Reset clears batches array to `[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration path adjusted**
- **Found during:** Task 1
- **Issue:** Plan specified `supabase/migrations/` but project uses `sql/` directory
- **Fix:** Created `sql/add-batches.sql` instead, following existing convention
- **Files modified:** sql/add-batches.sql (created)
- **Commit:** 0013dde

**2. [Rule 3 - Blocking] Test helper missing batch_id**
- **Found during:** Task 3
- **Issue:** makeQuestion() helper in tests lacked new batch_id field
- **Fix:** Added `batch_id: null` to makeQuestion helper, added makeBatch helper and batch tests
- **Files modified:** src/stores/session-store.test.ts
- **Commit:** 13a2083

## Technical Notes

- **PostgreSQL FK indexing:** Explicitly created indexes on FK columns since PostgreSQL does NOT auto-index them
- **ON DELETE SET NULL:** Deleting a batch unbatches its questions rather than deleting them
- **Position sorting:** Both setBatches and addBatch sort by position, matching existing setQuestions pattern
- **Test coverage:** Added 5 new tests for batch management (setBatches, addBatch, updateBatch x2, removeBatch)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0013dde | feat | Create batches table migration |
| 6d8f45e | feat | Add Batch type and batch_id to Question |
| 13a2083 | feat | Add batch state to session store |

## Next Phase Readiness

**Ready for 06-02:** Batch UI components can now use:
- `Batch` type for props/state
- `Question.batch_id` for batch assignment
- `useSessionStore` batch methods for state management

**Migration note:** The SQL file needs to be run against Supabase to create the actual schema. UI development can proceed with types/store but will need DB for integration testing.

---
*Completed: 2026-01-28*
*Duration: 4 minutes*
