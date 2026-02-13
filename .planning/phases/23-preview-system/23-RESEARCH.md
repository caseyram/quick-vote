# Phase 23: Preview System - Research

**Researched:** 2026-02-12
**Domain:** React preview modal, multi-view simulation, session preview UI
**Confidence:** HIGH

## Summary

Phase 23 replaces the existing simple content preview with a full-page session preview overlay that shows synchronized views of all three audiences: projection screen, admin controls, and participant voting interface. This is a session simulation (not live component reuse), built with styled approximations using the project's existing stack: React 19, Motion (formerly Framer Motion), Tailwind CSS 4, and URL-based mode switching.

The current implementation uses URL search params (`?mode=preview`) to toggle between edit and preview modes, displaying a simple slideshow-like preview. The new preview will be a modal overlay with three side-by-side panels, each showing approximations of what the live experience looks like, with mock data and synchronized navigation.

**Primary recommendation:** Build purpose-built preview components that mimic the visual appearance of live components without rendering the actual live components. Use Motion for the full-page overlay transition and crossfade animations. Leverage existing modal/overlay patterns (ConfirmDialog, KeyboardShortcutHelp) for the full-page takeover approach. Generate mock vote data statically or with simple randomization to populate result previews.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual fidelity:**
- Styled approximation — purpose-built preview components that mimic look & feel, not actual live components rendered in sandbox
- All light theme — keep everything light since preview lives within the editor context (don't use dark participant theme)
- No device frame around participant view — just render at phone-like proportions
- Show sample data — pre-populated fake votes, participant counts, and results to give a feel for the live experience

**View layout:**
- Full-page overlay — preview takes over the entire page like a modal, with a close button to return to editor
- Side-by-side — all 3 views visible simultaneously (projection, control, participant)
- Each panel has a text label header ("Projection View", "Admin Controls", "Participant View")
- Replaces existing Edit/Preview toggle — one preview experience, not two separate ones

**Mock interactions:**
- Control view navigation is interactive — clicking next/prev advances all 3 views simultaneously
- Show mock vote results for each question (fake distribution bars/percentages)
- Projection view animates transitions between items (crossfade, matching live behavior)

**Preview navigation:**
- Full keyboard support — arrow keys navigate, Escape closes, matching live presentation shortcuts
- Allow starting at both beginning and currently selected item (e.g., "Preview from here" and "Preview all")
- Entry point replaces the current Preview segment in the Edit/Preview segmented control

### Claude's Discretion

- View panel proportions (equal thirds vs weighted)
- Participant voting interactivity level (clickable no-op vs static mockup)
- Mock data generation approach (hardcoded vs randomized)
- Exact transition animation style

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.29.2 | Animation library (formerly Framer Motion) | Already used for AnimatePresence, transitions in PresentationView, AdminSession, ParticipantSession |
| react | 19.0 | UI framework | Project standard |
| react-router | 7.6.1 | URL management | Already used for search params mode switching |
| tailwindcss | 4.1.18 | Styling | Project standard, all components use Tailwind utility classes |
| zustand | 5.0.5 | State management | Already used for template-editor-store |

### Supporting (Already Available)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| nanoid | Generating preview state IDs | If needed for keying mock data |
| @dnd-kit/core | Drag-and-drop | NOT needed for preview (read-only) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Purpose-built preview components | Iframe sandbox with live components | User decision: styled approximations avoid complexity of sandboxing, easier to control styling |
| Motion animations | CSS transitions only | Motion provides declarative AnimatePresence and variant patterns already established in codebase |
| Mock data generation | Connect to real session data | Preview is explicitly a simulation, not a live session connection |

**Installation:**
No new packages needed — all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── editor/
│       ├── PreviewMode.tsx           # EXISTING - to be replaced
│       ├── SessionPreviewOverlay.tsx # NEW - full-page overlay container
│       ├── PreviewProjection.tsx     # NEW - projection screen approximation
│       ├── PreviewControls.tsx       # NEW - admin controls approximation
│       ├── PreviewParticipant.tsx    # NEW - participant view approximation
│       └── preview-mock-data.ts      # NEW - mock data generation utilities
```

### Pattern 1: Full-Page Modal Overlay with AnimatePresence

**What:** A full-screen overlay that slides in/out using Motion's AnimatePresence, matching the project's existing overlay patterns.

**When to use:** For preview mode activation/deactivation, providing smooth entrance/exit animations.

**Example:**
```typescript
// Source: Existing patterns from KeyboardShortcutHelp.tsx and QROverlay.tsx
import { motion, AnimatePresence } from 'motion/react';

export function SessionPreviewOverlay({ isOpen, onClose, startIndex }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-gray-50 z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4">
            Close
          </button>

          {/* Three-panel layout */}
          <div className="flex-1 flex gap-4 p-6">
            <PreviewPanel title="Projection View" />
            <PreviewPanel title="Admin Controls" />
            <PreviewPanel title="Participant View" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Pattern 2: Synchronized Multi-View State

**What:** A single preview navigation state that updates all three panels simultaneously when the control panel's next/prev buttons are clicked.

**When to use:** To maintain synchronization between projection, control, and participant previews.

**Example:**
```typescript
// Shared preview state
const [currentIndex, setCurrentIndex] = useState(startIndex);
const currentItem = items[currentIndex];

// All three panels consume the same currentItem and currentIndex
<PreviewProjection item={currentItem} />
<PreviewControls
  item={currentItem}
  onNext={() => setCurrentIndex(i => Math.min(items.length - 1, i + 1))}
  onPrev={() => setCurrentIndex(i => Math.max(0, i - 1))}
/>
<PreviewParticipant item={currentItem} />
```

### Pattern 3: Mock Data Generation

**What:** Simple utilities to generate realistic-looking vote distributions and participant counts for preview purposes.

**When to use:** To populate preview charts and counts without connecting to real database.

**Example:**
```typescript
// preview-mock-data.ts
export function generateMockVotes(questionType: VoteType, sampleSize = 25) {
  if (questionType === 'agree_disagree') {
    return {
      'Agree': Math.floor(sampleSize * 0.6),
      'Disagree': Math.floor(sampleSize * 0.3),
      'Sometimes': Math.floor(sampleSize * 0.1),
    };
  } else {
    // Multiple choice - distribute across options
    // Can be hardcoded or use simple randomization
  }
}

export function getMockParticipantCount() {
  return 12; // Fixed for consistency, or randomize 8-20
}
```

### Pattern 4: Keyboard Navigation (Following Live Patterns)

**What:** Arrow key navigation and Escape to close, matching PresentationView keyboard shortcuts.

**When to use:** For preview navigation consistency with live presentation experience.

**Example:**
```typescript
// Source: PresentationView.tsx lines 258-299
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat) return;

    // Skip if typing in input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      onClose();
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentIndex, items.length, onClose]);
```

### Pattern 5: Crossfade Animation for Projection Transitions

**What:** Crossfade variant matching live PresentationView behavior (lines 319-323).

**When to use:** For projection panel transitions between items.

**Example:**
```typescript
// Source: PresentationView.tsx crossfadeVariants
const crossfadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

<AnimatePresence mode="wait">
  <motion.div
    key={currentItem.id}
    variants={crossfadeVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ duration: 0.35, ease: 'easeInOut' }}
  >
    {/* Projection content */}
  </motion.div>
</AnimatePresence>
```

### Anti-Patterns to Avoid

- **Rendering actual live components in preview:** User explicitly wants styled approximations, not live component sandboxing. Keep preview components separate and simplified.
- **Using dark theme for participant preview:** User decision is all light theme to match editor context.
- **Adding device frames:** User explicitly rejected device frames around participant view.
- **Connecting to real data:** Preview is a simulation with mock data, not a live connection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-page modal overlay | Custom z-index stacking, manual animation timing | Motion AnimatePresence with fixed inset-0 positioning | Project already uses this pattern in KeyboardShortcutHelp and QROverlay |
| Keyboard event handling | Raw addEventListener with complex state tracking | React useEffect hook with cleanup, following PresentationView pattern | Prevents memory leaks, matches existing live presentation code |
| Vote result visualization | Custom bar chart rendering | Simplified version of existing BarChart component | Reuse existing visual language, ensure consistency |
| Animation variants | Manual CSS transitions, setTimeout chains | Motion variants with declarative initial/animate/exit | Already project standard, type-safe, cleaner |

**Key insight:** The project has established patterns for overlays, animations, and keyboard navigation. Reusing these patterns ensures consistency and reduces complexity. Mock data generation is the only truly new domain.

## Common Pitfalls

### Pitfall 1: Stale Closure in Keyboard Handlers

**What goes wrong:** Keyboard event listeners capture old state values when dependencies aren't properly specified, leading to navigation bugs (e.g., always advancing from index 0).

**Why it happens:** useEffect dependencies not including all state variables used in the handler.

**How to avoid:** Include all state variables in useEffect dependencies (see PresentationView.tsx line 21 pattern).

**Warning signs:** Preview navigation doesn't update correctly, or always starts from the same position.

### Pitfall 2: Animation Flicker During Panel Updates

**What goes wrong:** All three panels re-render with animations simultaneously, causing visual jank.

**Why it happens:** Animating content that shouldn't animate (e.g., static labels) or using layout animations where opacity/transform suffice.

**How to avoid:** Only animate the projection panel content (crossfade). Control and participant panels should update without animation, or use subtle opacity transitions only.

**Warning signs:** Choppy preview experience, panels "jumping" during navigation.

### Pitfall 3: Z-Index Conflicts with Existing Editor UI

**What goes wrong:** Preview overlay appears behind editor elements, or close button is unreachable.

**Why it happens:** Insufficient z-index on overlay, or competing z-index values.

**How to avoid:** Use z-50 or higher (following ConfirmDialog z-50 pattern, or QROverlay z-100 for fullscreen). Test with all editor UI elements visible.

**Warning signs:** Close button not clickable, editor elements visible through overlay.

### Pitfall 4: Inconsistent Mock Data Between Renders

**What goes wrong:** Vote distributions change on every re-render, making preview feel unstable.

**Why it happens:** Generating random mock data inline without memoization.

**How to avoid:** Either use fixed hardcoded mock data, or memoize randomized data based on item ID.

**Warning signs:** Result bars change values when navigating back to a previously viewed question.

### Pitfall 5: Preview State Not Reset on Close

**What goes wrong:** Reopening preview shows wrong position or stale state.

**Why it happens:** Not resetting local preview state on unmount or close.

**How to avoid:** Reset currentIndex in cleanup function or on close handler. Support "Preview from here" vs "Preview all" by accepting startIndex prop.

**Warning signs:** Preview always opens at last viewed position instead of start/current as expected.

## Code Examples

Verified patterns from existing codebase:

### URL Search Params for Mode Toggle

```typescript
// Source: EditorToolbar.tsx lines 16, 52, 178-183
const [searchParams, setSearchParams] = useSearchParams();
const mode = searchParams.get('mode') || 'edit';

const handleModeChange = (newMode: string) => {
  if (newMode === 'preview') {
    setSearchParams({ mode: 'preview' });
  } else {
    setSearchParams({});
  }
};
```

### Full-Page Overlay with Close Button

```typescript
// Source: KeyboardShortcutHelp.tsx lines 25-41
<AnimatePresence>
  {visible && (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

### EditorItem Data Structure

```typescript
// Source: template-editor-store.ts lines 14-26
export interface EditorItem {
  id: string;
  item_type: 'batch' | 'slide';
  batch?: {
    name: string;
    questions: EditorQuestion[];
    timer_duration: number | null;
  };
  slide?: {
    image_path: string;
    caption: string | null;
  };
}
```

### Simple Slideshow Navigation (Current Preview Pattern)

```typescript
// Source: PreviewMode.tsx lines 23-29
const handlePrevious = () => {
  setCurrentIndex((prev) => Math.max(0, prev - 1));
};

const handleNext = () => {
  setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1));
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Framer Motion | Motion (v12.29.2) | 2024-2025 | Same API, different package name. Project uses `motion/react` import path |
| Class-based animations | Declarative variants with Motion | Established pattern | More maintainable, type-safe animation definitions |
| Manual modal z-index stacking | Fixed z-index tiers (z-50, z-100, z-200, z-300) | Project convention | Prevents z-index conflicts, predictable layering |
| Dark participant theme in preview | Light theme everywhere (user decision) | Phase 23 context | Simpler implementation, maintains editor context |

**Deprecated/outdated:**
- Using `framer-motion` package import paths — project now uses `motion/react` (check package.json line 22)
- Rendering live components in iframe for preview — user rejected this approach in favor of styled approximations

## Open Questions

1. **Mock data consistency approach**
   - What we know: User allows "hardcoded vs randomized" as Claude's discretion
   - What's unclear: Preference for deterministic (same every time) vs pseudo-random (seed-based per question)
   - Recommendation: Start with hardcoded fixed percentages for simplicity and consistency. Can add subtle randomization later if needed, seeded by question text hash for determinism.

2. **Panel proportions**
   - What we know: User allows this as Claude's discretion
   - What's unclear: Whether equal thirds works well or if control panel needs more space
   - Recommendation: Start with equal thirds (33% each). Control panel content is similar complexity to projection, and participant view is simple. Can adjust if visual balance is off.

3. **Participant voting interactivity**
   - What we know: User allows "clickable no-op vs static mockup" as discretion area
   - What's unclear: Whether static is sufficient or if clickable no-ops provide better "feel"
   - Recommendation: Static mockup with visual states (e.g., pre-selected "Agree" button) is simpler and sufficient for preview. Clickable no-ops add complexity without value.

4. **Entry point mechanism**
   - What we know: Need "Preview from here" and "Preview all" functionality
   - What's unclear: UI placement (separate buttons vs dropdown vs context menu)
   - Recommendation: Replace existing Preview toggle with two-segment control: "Preview All" | "Preview from Here", or add a small dropdown arrow to existing Preview button. Two-segment is clearer but takes more space.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection:**
  - `src/components/editor/PreviewMode.tsx` - Current preview implementation
  - `src/pages/PresentationView.tsx` - Live projection view with animations
  - `src/pages/AdminSession.tsx` - Live admin control view
  - `src/pages/ParticipantSession.tsx` - Live participant view
  - `src/components/KeyboardShortcutHelp.tsx` - Full-page overlay pattern
  - `src/components/QROverlay.tsx` - Fixed overlay positioning pattern
  - `src/components/ConfirmDialog.tsx` - Modal dialog pattern
  - `src/stores/template-editor-store.ts` - EditorItem data structure
  - `package.json` - Motion 12.29.2, React 19, Tailwind 4

### Secondary (MEDIUM confidence)

- Motion library documentation patterns (variants, AnimatePresence) — verified against actual codebase usage

### Tertiary (LOW confidence)

None — all research based on codebase inspection and user-provided context.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, version numbers verified in package.json
- Architecture: HIGH - Patterns extracted directly from existing overlay and preview implementations
- Pitfalls: HIGH - Identified from common React animation and event handling issues, plus specific project patterns

**Research date:** 2026-02-12
**Valid until:** 60 days (stable dependencies, no fast-moving ecosystem changes expected)
