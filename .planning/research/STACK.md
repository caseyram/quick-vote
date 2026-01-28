# Technology Stack for Batch Questions & Collections

**Project:** QuickVote v1.1 - Batch/Self-Paced Mode
**Researched:** 2026-01-28
**Overall Confidence:** HIGH

## Executive Summary

The existing stack (Motion v12, Zustand v5, Supabase, React 19) handles 90% of batch mode requirements with zero additions. Motion already has built-in gesture support (drag, pan, swipe) sufficient for card navigation. Zustand's persist middleware handles progress tracking locally. The only recommended addition is **Zod v4** for robust JSON schema validation during collection import/export.

---

## Existing Stack (Leverage These)

### Motion v12.29.2 - Gestures

**Already installed. Use for swipe navigation.**

Motion (formerly Framer Motion) includes comprehensive gesture support:

| Gesture | Prop | Use Case |
|---------|------|----------|
| Drag | `drag`, `whileDrag`, `dragConstraints` | Card swiping |
| Pan | `onPan`, `onPanStart`, `onPanEnd` | Swipe detection |
| Tap | `whileTap`, `onTap` | Vote selection |

**Why no additional gesture library needed:**
- Motion's `drag` prop with `dragConstraints` handles bounded swipe
- `dragMomentum` creates natural swipe feel with inertia
- `onDragEnd` provides velocity data for swipe-vs-tap detection
- Pan gesture fires after 3px movement, perfect for swipe detection

**Example pattern for question card swipe:**
```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => {
    if (Math.abs(info.velocity.x) > 500) {
      // Swipe detected
      info.velocity.x > 0 ? goNext() : goPrevious();
    }
  }}
  whileDrag={{ scale: 1.02 }}
>
```

**Confidence:** HIGH - Verified via official Motion documentation at [motion.dev/docs/react-gestures](https://motion.dev/docs/react-gestures) and [motion.dev/docs/react-drag](https://motion.dev/docs/react-drag).

---

### Zustand v5.0.5 - Progress Persistence

**Already installed. Add persist middleware for batch progress.**

Zustand's `persist` middleware handles local progress tracking:

```tsx
import { persist, createJSONStorage } from 'zustand/middleware';

const useBatchStore = create(
  persist(
    (set) => ({
      progress: {}, // { [collectionId]: { currentIndex, answers } }
      setProgress: (collectionId, data) =>
        set((s) => ({ progress: { ...s.progress, [collectionId]: data } })),
    }),
    {
      name: 'quickvote-batch-progress',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Why this works:**
- Persist middleware is built-in to Zustand (no additional install)
- Synchronous localStorage hydration happens before render
- Partial persistence can exclude functions/actions
- Progress survives page refresh/browser close

**No offline-first library needed because:**
- Batch mode submits votes when collection completes, not incrementally
- Progress is local-only until final submission
- Supabase handles server sync on completion
- PowerSync/RxDB would be overkill for this use case

**Confidence:** HIGH - Verified via Zustand official docs at [zustand.docs.pmnd.rs/middlewares/persist](https://zustand.docs.pmnd.rs/middlewares/persist).

---

### React 19 - Keyboard Navigation

**Already installed. Use native event handling.**

Arrow key navigation requires no additional library:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrevious();
    if (e.key === 'Enter') submitAnswer();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentIndex]);
```

**Why no react-hotkeys-hook or similar:**
- Simple 3-key navigation doesn't justify a library
- No complex key combinations needed
- Native events work reliably
- Less bundle size

**Confidence:** HIGH - Standard React pattern, no external verification needed.

---

## New Addition: Zod v4

### Why Add Zod

**Current problem:** `jsonToTemplates()` in `src/lib/question-templates.ts` uses manual validation with imperative type checking. This works but:
- Verbose error messages require manual construction
- No TypeScript inference from validation
- Harder to extend as collection schema grows

**Zod solves:**
- Declarative schema definition
- Automatic TypeScript type inference via `z.infer<>`
- Clear, user-friendly error messages via `z.prettifyError()`
- JSON Schema import/export for interoperability

### Recommended Version

```bash
npm install zod@^4.0.0
```

**Current stable:** 4.3.5 (published ~15 days ago as of 2026-01-28)

### Example Schema for Collections

```tsx
import { z } from 'zod';

const QuestionSchema = z.object({
  text: z.string().min(1, 'Question text required'),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean().default(true),
});

const CollectionSchema = z.object({
  name: z.string().min(1, 'Collection name required'),
  description: z.string().optional(),
  questions: z.array(QuestionSchema).min(1, 'At least one question required'),
  version: z.literal(1), // Schema versioning for future migrations
});

export type Collection = z.infer<typeof CollectionSchema>;

// Usage
function importCollection(json: string): Collection {
  const parsed = JSON.parse(json);
  return CollectionSchema.parse(parsed); // Throws ZodError with details
}
```

### Why Zod Over Alternatives

| Library | Bundle Size | Recommendation |
|---------|-------------|----------------|
| **Zod v4** | ~12KB gzip | **Use this** - Best DX, largest community, excellent errors |
| Valibot | ~2KB gzip | Skip - Smaller but less documentation, smaller community |
| Manual | 0KB | Skip - Already tried, verbose and error-prone |

**Rationale:**
- Collection import is user-facing; good error messages matter
- Zod 4 has 84M+ weekly downloads - well-tested, well-documented
- `z.prettifyError()` produces human-readable messages for UI
- JSON Schema conversion (`z.jsonSchema()`) enables future tooling
- 12KB is acceptable for robust validation

**Confidence:** HIGH - Verified current version and features via [zod.dev](https://zod.dev/) and [GitHub releases](https://github.com/colinhacks/zod/releases).

---

## Explicitly Rejected Options

### @use-gesture/react

**What it is:** Low-level gesture detection library from pmndrs.

**Why not:**
- Motion already handles drag/pan/swipe
- @use-gesture is designed to pair with react-spring, not Motion
- Adding it would duplicate gesture handling
- Extra 8KB for no benefit

**Confidence:** HIGH - Motion's gesture system is complete for our needs.

---

### PowerSync / RxDB (Offline-First Sync)

**What they are:** Sync layers for Supabase offline-first support.

**Why not:**
- Batch mode stores progress locally, syncs on completion
- No need for bidirectional sync during answering
- Complexity far exceeds benefit for our use case
- PowerSync requires additional service setup

**When you would need it:** If participants needed to continue sessions across devices mid-collection, or if network was unreliable during final submission.

**Confidence:** HIGH - Design decision based on batch mode requirements.

---

### react-hotkeys-hook / react-arrow-key-navigation-hook

**What they are:** Libraries for keyboard shortcut handling.

**Why not:**
- Only need 3 keys: ArrowLeft, ArrowRight, Enter
- Native `addEventListener` is simpler
- Extra dependency for trivial use case
- Increases bundle without meaningful benefit

**When you would need it:** Complex keyboard shortcuts with modifiers, or global hotkeys across multiple components.

**Confidence:** HIGH - Pattern analysis shows simple requirements.

---

### Valibot

**What it is:** Smaller alternative to Zod (~2KB vs ~12KB).

**Why not:**
- Smaller community, fewer resources
- Zod's error messages are more polished
- 10KB difference is negligible for this app
- Team likely already familiar with Zod patterns

**When you would use it:** Extreme bundle size constraints, or if already using it elsewhere.

**Confidence:** MEDIUM - Both are viable; Zod is recommended for DX.

---

## Integration Notes

### New Store Structure

```
src/stores/
  session-store.ts     # (existing) Real-time session state
  batch-store.ts       # (new) Batch progress with persist middleware
  collection-store.ts  # (new) Collection management
```

### JSON Schema for Collections

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "text": { "type": "string", "minLength": 1 },
          "type": { "enum": ["agree_disagree", "multiple_choice"] },
          "options": { "type": ["array", "null"] },
          "anonymous": { "type": "boolean" }
        },
        "required": ["text", "type"]
      },
      "minItems": 1
    },
    "version": { "const": 1 }
  },
  "required": ["name", "questions", "version"]
}
```

### Database Additions (Supabase)

New tables needed (not stack changes, but noted for context):
- `collections` - Named question groups
- `collection_questions` - Questions belonging to collections
- `batch_sessions` - Self-paced session instances
- `batch_progress` - Per-participant progress tracking

---

## Installation Summary

**Required:**
```bash
npm install zod@^4.0.0
```

**Already have (no install needed):**
- motion v12.29.2 (gestures)
- zustand v5.0.5 (persist middleware built-in)
- React 19 (keyboard events)
- Supabase (final sync)

**Total new dependencies:** 1

---

## Sources

- [Motion Gestures Documentation](https://motion.dev/docs/react-gestures)
- [Motion Drag Guide](https://motion.dev/docs/react-drag)
- [Motion Swipe Actions Tutorial](https://motion.dev/tutorials/react-swipe-actions)
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist)
- [Zod Official Documentation](https://zod.dev/)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod GitHub Releases](https://github.com/colinhacks/zod/releases)
- [@use-gesture/react npm](https://www.npmjs.com/package/@use-gesture/react)
- [PowerSync + Supabase](https://www.powersync.com/blog/bringing-offline-first-to-supabase)
