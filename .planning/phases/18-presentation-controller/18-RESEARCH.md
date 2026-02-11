# Phase 18: Presentation Controller - Research

**Researched:** 2026-02-11
**Domain:** React state management, keyboard navigation, animation transitions, realtime broadcast
**Confidence:** HIGH

## Summary

Phase 18 implements a presentation controller for advancing through a unified sequence of slides and batches during a live session. The phase leverages existing Motion.dev (v12.29.2) for animations, Zustand for state management, and Supabase Realtime Broadcast for participant synchronization.

The research confirms that the project's existing patterns provide a solid foundation:
- Motion.dev's AnimatePresence with "wait" mode and spring/tween transitions
- Keyboard event handling with repeat prevention (event.repeat check)
- Broadcast-based participant control (voting_opened, voting_closed, batch_activated)
- Zustand store with activeQuestionId and activeBatchId patterns

The controller state machine has three primary states: slide projection, batch voting, and navigation controls. Participant waiting state uses simple broadcast events to show/hide content.

**Primary recommendation:** Add activeSessionItemId to session-store, use keyboard event handlers with repeat prevention, implement slide/crossfade transitions via Motion AnimatePresence mode="wait", and broadcast slide_activated events for participant waiting state.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.29.2 | React animations, transitions | Already in use for participant slide transitions (BatchVotingCarousel) |
| zustand | 5.0.5 | State management | Project standard for session state |
| @supabase/supabase-js | 2.93.1 | Realtime Broadcast | Already used for voting_closed, batch_activated events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React keyboard events | Built-in | Keyboard shortcuts | Native browser API, no library needed |
| CSS object-fit | Built-in | Image letterboxing | Native CSS property for contain behavior |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion.dev | Framer Motion | Motion.dev is Framer Motion's successor, already in package.json |
| Custom state machine | XState (@xstate/react) | Overkill for simple forward/back navigation; adds dependency |
| Broadcast events | Database polling | Broadcast is real-time, already in use |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
```

## Architecture Patterns

### Recommended State Structure
```typescript
// Add to session-store.ts
interface SessionState {
  // Existing state...
  activeSessionItemId: string | null;         // Current item being projected

  // Actions
  setActiveSessionItemId: (id: string | null) => void;
  navigateToSessionItem: (itemId: string) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;
}
```

### Pattern 1: Keyboard Navigation with Repeat Prevention
**What:** Window-level keyboard event listener with event.repeat check
**When to use:** For global navigation shortcuts (arrow keys, Space)
**Example:**
```typescript
// Source: MDN KeyboardEvent.repeat + project BatchVotingCarousel pattern
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    // Prevent auto-repeat for navigation commands
    if (event.repeat) return;

    // Don't navigate if user is typing in input/textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === ' ') {
      navigateNext();
    } else if (event.key === 'ArrowLeft') {
      navigatePrevious();
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [navigateNext, navigatePrevious]);
```

### Pattern 2: Motion AnimatePresence with Mode="wait"
**What:** Sequential transitions where entering element waits for exiting element to finish
**When to use:** Slide-to-slide transitions (prevents visual overlap)
**Example:**
```typescript
// Source: Motion.dev docs + project BatchVotingCarousel.tsx
const slideVariants = {
  enterLeft: { x: '-100%', opacity: 0 },
  enterRight: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitLeft: { x: '-100%', opacity: 0 },
  exitRight: { x: '100%', opacity: 0 },
};

const slideTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={currentItemId}
    variants={slideVariants}
    initial={direction === 'forward' ? 'enterRight' : 'enterLeft'}
    animate="center"
    exit={direction === 'forward' ? 'exitLeft' : 'exitRight'}
    transition={slideTransition}
  >
    {/* Slide content */}
  </motion.div>
</AnimatePresence>
```

### Pattern 3: Crossfade Transition for Batch Items
**What:** Opacity-only fade transition
**When to use:** Any transition involving a batch (slide-to-batch, batch-to-slide, batch-to-batch)
**Example:**
```typescript
// Source: Motion.dev Crossfade example
const crossfadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const crossfadeTransition = {
  duration: 0.35, // 350ms
  ease: 'easeInOut',
};
```

### Pattern 4: Broadcast Event for Participant Control
**What:** Send slide_activated broadcast to show waiting state on participant devices
**When to use:** When admin navigates to a slide item
**Example:**
```typescript
// Source: AdminSession.tsx handleActivateBatch pattern
async function handleActivateSlide(itemId: string) {
  setActiveSessionItemId(itemId);

  // Close any active voting
  await closeActiveVoting();

  // Broadcast to participants
  channelRef.current?.send({
    type: 'broadcast',
    event: 'slide_activated',
    payload: { itemId },
  });
}
```

### Pattern 5: Image Projection with object-fit: contain
**What:** Full-screen image with letterboxing
**When to use:** Displaying slide images in projection area
**Example:**
```typescript
// Source: SlideManager.tsx + MDN object-fit docs
<div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
  <img
    src={slideImageUrl}
    alt={slideCaption || 'Slide'}
    className="max-w-full max-h-full object-contain"
  />
</div>
```

### Anti-Patterns to Avoid
- **Don't use AnimatePresence without mode="wait" for slides:** Causes visual overlap during transitions
- **Don't forget event.repeat check:** Holding Space/arrow keys will rapid-fire navigation
- **Don't broadcast on every position change:** Only broadcast when changing item types (slide vs batch)
- **Don't use transition="layout" for slide changes:** Layout animations are for size/position changes within same element, not content swaps

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation timing curves | Custom bezier math | Motion's transition presets or CSS easing keywords | Motion handles spring physics, easing presets tested across browsers |
| Keyboard shortcut library | Custom event aggregator | Native addEventListener with event.repeat check | Simple use case, library adds weight and API surface |
| Image aspect-ratio preservation | Canvas resize math | CSS object-fit: contain | Native CSS property handles all aspect ratios, no JS needed |
| Participant state sync | Custom polling | Supabase Broadcast events | Already in use, real-time, proven reliable |

**Key insight:** The project already has all necessary primitives (Motion for animations, native keyboard events, Broadcast for sync). Custom solutions would duplicate existing, tested code.

## Common Pitfalls

### Pitfall 1: Forgetting to Disable Controls When Phase 19 Controller Connects
**What goes wrong:** Admin sees duplicate controls (sidebar + controller window), can desync state
**Why it happens:** Phase 18 controls are designed to be replaced by Phase 19 Presenter View
**How to avoid:** Add conditional rendering: `{!controllerConnected && <NavigationControls />}`
**Warning signs:** User reports "two sets of Next buttons" or "controls not working"

### Pitfall 2: Batch Activation Breaking When Called from Sequence Navigation
**What goes wrong:** Existing handleActivateBatch assumes click from BatchCard, may not integrate cleanly with sequential navigation
**Why it happens:** handleActivateBatch sets activeBatchId but doesn't track activeSessionItemId
**How to avoid:** Create unified activateItem(itemId) that checks item_type and delegates to batch/slide logic
**Warning signs:** Batch voting works from BatchCard but not from sequence Next button

### Pitfall 3: Animation Direction Not Matching Navigation Direction
**What goes wrong:** Pressing "Previous" slides content left (wrong direction)
**Why it happens:** AnimatePresence doesn't know navigation direction unless you track it
**How to avoid:** Store lastNavigationDirection in state, use it to pick enter/exit variants
**Warning signs:** Slide transitions feel "backwards" when using Previous button

### Pitfall 4: Participant Waiting State Not Clearing When Batch Activates
**What goes wrong:** Participant stuck on "Waiting for next question..." when admin activates batch
**Why it happens:** ParticipantSession needs to listen for batch_activated to exit waiting view
**How to avoid:** Ensure batch_activated broadcast handler transitions from waiting to batch-voting view
**Warning signs:** Manual page refresh needed to see batch questions

### Pitfall 5: Next Button Not Disabled at Last Item
**What goes wrong:** Clicking Next on last item either errors or wraps to first
**Why it happens:** Navigation logic doesn't check if currentIndex === sessionItems.length - 1
**How to avoid:** Disable Next button when on last item: `disabled={isLastItem}`
**Warning signs:** User clicks Next on last slide, gets unexpected behavior

## Code Examples

Verified patterns from official sources and existing project code:

### Navigation State in Zustand Store
```typescript
// Source: session-store.ts pattern
interface SessionState {
  // ... existing state

  // Presentation controller state
  activeSessionItemId: string | null;
  lastNavigationDirection: 'forward' | 'backward' | null;

  setActiveSessionItemId: (id: string | null) => void;
  setLastNavigationDirection: (direction: 'forward' | 'backward' | null) => void;
}

// In store implementation
setActiveSessionItemId: (id) => set({ activeSessionItemId: id }),
setLastNavigationDirection: (direction) => set({ lastNavigationDirection: direction }),
```

### Navigation Controls Component
```typescript
// Source: BatchVotingCarousel.tsx keyboard pattern + AdminControlBar.tsx button pattern
interface NavigationControlsProps {
  currentIndex: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export function NavigationControls({
  currentIndex,
  totalItems,
  onPrevious,
  onNext,
  disabled = false,
}: NavigationControlsProps) {
  const isFirstItem = currentIndex === 0;
  const isLastItem = currentIndex === totalItems - 1;

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || disabled) return;

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((event.key === 'ArrowRight' || event.key === ' ') && !isLastItem) {
        event.preventDefault(); // Prevent Space from scrolling page
        onNext();
      } else if (event.key === 'ArrowLeft' && !isFirstItem) {
        onPrevious();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFirstItem, isLastItem, onNext, onPrevious, disabled]);

  return (
    <div className="flex gap-2">
      <button
        onClick={onPrevious}
        disabled={isFirstItem || disabled}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
      >
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={isLastItem || disabled}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
      >
        Next
      </button>
    </div>
  );
}
```

### Slide Projection Component
```typescript
// Source: SlideManager.tsx image display + MDN object-fit
interface SlideDisplayProps {
  imagePath: string;
  caption: string | null;
}

export function SlideDisplay({ imagePath, caption }: SlideDisplayProps) {
  const imageUrl = getSlideImageUrl(imagePath);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      <img
        src={imageUrl}
        alt={caption || 'Slide'}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}
```

### Participant Waiting State Component
```typescript
// Source: ParticipantSession.tsx waiting view pattern
export function WaitingState() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <p className="text-xl text-gray-400">
        Waiting for next question...
      </p>
    </div>
  );
}
```

### Transition Logic with Direction Tracking
```typescript
// Source: Motion.dev AnimatePresence + BatchVotingCarousel pattern
const {
  activeSessionItemId,
  sessionItems,
  lastNavigationDirection
} = useSessionStore();

const currentItem = sessionItems.find(item => item.id === activeSessionItemId);
const direction = lastNavigationDirection ?? 'forward';

// Determine transition variants based on item type
const shouldSlide =
  currentItem?.item_type === 'slide' &&
  // Check if previous/next item is also a slide
  (direction === 'forward'
    ? sessionItems[currentIndex + 1]?.item_type === 'slide'
    : sessionItems[currentIndex - 1]?.item_type === 'slide');

const variants = shouldSlide ? slideVariants : crossfadeVariants;
const transition = shouldSlide ? slideTransition : crossfadeTransition;

<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={currentItem?.id}
    variants={variants}
    initial={direction === 'forward' ? variants.enterRight : variants.enterLeft}
    animate="center"
    exit={direction === 'forward' ? variants.exitLeft : variants.exitRight}
    transition={transition}
  >
    {/* Current item content */}
  </motion.div>
</AnimatePresence>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Framer Motion | Motion.dev | 2024 (Motion v11+) | Same API, better performance, smaller bundle |
| event.keyCode | event.key | ES6 (2015+) | Simpler, more readable key detection |
| Custom spring math | Spring physics props (stiffness, damping) | Framer Motion 1.0 (2019) | Declarative, natural-feeling animations |
| Separate slide/batch state | Unified sessionItems sequence | Phase 17 (v1.3) | Single source of truth for presentation order |

**Deprecated/outdated:**
- `event.keyCode`: Use `event.key === 'ArrowRight'` instead of `event.keyCode === 39`
- Manual transition timing math: Use Motion's spring physics or duration/ease presets
- Polling for participant updates: Supabase Broadcast provides real-time events

## Open Questions

1. **Active item highlight styling in sidebar**
   - What we know: SequenceItemCard already exists, supports highlighting
   - What's unclear: Exact visual treatment (background color, border, icon?)
   - Recommendation: Use bg-blue-100 border-blue-500 (light theme) to match project's admin theme

2. **How batch activation integrates with sequence navigation**
   - What we know: handleActivateBatch exists, sets activeBatchId and broadcasts
   - What's unclear: Should navigating to batch auto-activate or require explicit "Start Voting" action?
   - Recommendation: Auto-activate when navigating to batch item (matches slide auto-display behavior)

3. **Keyboard shortcut edge cases (holding keys, repeat rate)**
   - What we know: event.repeat property prevents auto-repeat
   - What's unclear: Should rapid sequential key presses be throttled?
   - Recommendation: No throttling needed — navigation state changes are quick, event.repeat is sufficient

## Sources

### Primary (HIGH confidence)
- Motion.dev official docs (AnimatePresence, transitions) - https://motion.dev/docs/react-animate-presence
- MDN KeyboardEvent.repeat - https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
- Project codebase: BatchVotingCarousel.tsx (keyboard nav + slide transitions), AdminSession.tsx (broadcast patterns)
- MDN object-fit - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit

### Secondary (MEDIUM confidence)
- [AnimatePresence — React exit animations | Motion](https://motion.dev/docs/react-animate-presence)
- [React transitions — Configure Motion animations | Motion](https://motion.dev/docs/react-transitions)
- [KeyboardEvent: repeat property - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat)
- [Keyboard: keydown and keyup](https://javascript.info/keyboard-events)
- [A Deep Dive Into object-fit And background-size In CSS — Smashing Magazine](https://www.smashingmagazine.com/2021/10/object-fit-background-size-css/)
- [object-fit - CSS | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit)

### Tertiary (LOW confidence)
- [State machines in React – The Same Tech](https://thesametech.com/state-machines-in-react/) - General pattern, not specific to this use case
- [How to Design Keyboard Accessibility for Complex React Experiences](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/) - Broad accessibility guide

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions confirmed in package.json
- Architecture: HIGH - Patterns verified in existing codebase (BatchVotingCarousel, AdminSession, ParticipantSession)
- Pitfalls: MEDIUM - Inferred from codebase structure and user requirements, not battle-tested yet

**Research date:** 2026-02-11
**Valid until:** ~30 days (stable libraries, unlikely API changes)
