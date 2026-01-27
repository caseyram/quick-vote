# Phase 5: Immersive UI and Polish - Research

**Researched:** 2026-01-27
**Domain:** Animation library (Motion), responsive layout, haptic feedback, dark theme
**Confidence:** HIGH

## Summary

This phase transforms the functional QuickVote app into a tactile, app-like experience. The primary addition is the `motion` npm package (formerly Framer Motion) for gesture animations, page transitions, and micro-interactions. The existing codebase already has a dark theme on the participant side, haptic feedback via `useHaptic`, and 100dvh viewport handling -- this phase replaces CSS transitions with Motion-powered animations and adds the full-screen immersive experience.

The research confirms: (1) the package name is `motion`, imported from `"motion/react"`, version 12.x is stable and React 19 compatible; (2) `AnimatePresence` with `mode="wait"` and the `custom` prop provides direction-aware slide transitions; (3) `whileTap` (not `whilePress`) is the correct gesture prop; (4) Tailwind CSS v4 has built-in `h-dvh` class and `dark:` variant support; (5) `navigator.vibrate()` does NOT work on iOS Safari -- the existing `useHaptic` hook is already correctly guarded.

**Primary recommendation:** Install `motion` (v12.x), use `motion.button` with `whileTap` + `animate` for vote interactions, `AnimatePresence mode="wait"` with directional variants for question transitions, and Tailwind `h-dvh` + `dark:` for layout/theme.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.26 | React animation (gestures, transitions, exit animations) | The dominant React animation library (12M+ monthly npm downloads), renamed from framer-motion. Declarative API, hardware-accelerated, tree-shakable. |

### Already Installed (no new dependencies needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `tailwindcss` | ^4.1.18 | CSS utility framework with `h-dvh`, `dark:` variant, responsive breakpoints | Already in project, has all features needed |
| `react` | ^19.0.0 | UI framework | Motion v12.9.5+ is fully compatible with React 19 strict mode |
| `zustand` | ^5.0.5 | State management | Already manages connection status used by connection indicator |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `motion` | Pure CSS animations/transitions | CSS cannot do exit animations, conditional gesture states, or direction-aware page transitions. The existing crossfade in ParticipantSession is already CSS-based and limited. |
| `motion` | `react-spring` | Less batteries-included for gestures, no AnimatePresence equivalent for exit animations |
| `motion` full | `motion` LazyMotion | Could reduce bundle from ~34kb to ~4.6kb+15kb, but adds complexity. Not needed for this app size. |

**Installation:**
```bash
npm install motion
```

## Architecture Patterns

### Recommended Component Changes

The existing codebase needs these structural changes:

```
src/
  components/
    VoteAgreeDisagree.tsx    # Refactor: motion.button with whileTap, animate for color fill
    VoteMultipleChoice.tsx   # Refactor: motion.button with whileTap, animate for color fill
    VoteConfirmation.tsx     # Refactor: motion.div with AnimatePresence for lock-in animation
    ConnectionBanner.tsx     # Replace: new ConnectionPill component (floating pill, not banner)
    BarChart.tsx             # Enhance: larger admin projection layout variant
    ConnectionPill.tsx       # NEW: floating pill indicator (top-right, green/red)
  pages/
    ParticipantSession.tsx   # Refactor: AnimatePresence for question slide transitions,
                             #           full-screen dark layout, hide header during voting
    AdminSession.tsx         # Refactor: light theme, large projection-friendly results
```

### Pattern 1: Motion Vote Button with Color Fill + Pulse

**What:** Replace CSS `transition-all` on vote buttons with Motion's `animate` + `whileTap` for the "color fill + pulse" interaction.
**When to use:** All vote option buttons (agree, disagree, multiple choice options).

```typescript
// Source: motion.dev/docs/react-gestures + motion.dev/docs/react-animation
import { motion } from "motion/react";

// Vote button with color fill and single pulse on selection
<motion.button
  disabled={isLockedIn || submitting}
  onClick={() => handleTap('agree')}
  // Animate background color based on selection state
  animate={{
    backgroundColor: selectedValue === 'agree' ? '#3B82F6' : 'rgba(55, 65, 81, 0.5)',
    scale: 1,
  }}
  // Tap gesture: scale down slightly for tactile press feel
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
  className="flex-1 flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold"
  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
>
  Agree
</motion.button>
```

For the "pulse once on selection" effect, use `useAnimate` imperatively:

```typescript
import { useAnimate } from "motion/react";

const [scope, animate] = useAnimate();

// Called when vote value changes
const triggerSelectionPulse = async () => {
  await animate(scope.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
};
```

### Pattern 2: Direction-Aware Slide Transition Between Questions

**What:** When the active question changes, the old question slides out left and the new one slides in from the right (card-swiping feel).
**When to use:** ParticipantSession voting view when `activeQuestion` changes.

```typescript
// Source: motion.dev/docs/react-animate-presence, sinja.io/blog/direction-aware-animations-in-framer-motion
import { motion, AnimatePresence } from "motion/react";

const slideVariants = {
  enter: {
    x: '100%',
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: '-100%',
    opacity: 0,
  },
};

// In ParticipantSession -- replace the current crossfade with AnimatePresence
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={activeQuestion.id}  // Key change triggers exit/enter
    variants={slideVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    }}
    className="flex-1 flex flex-col"
  >
    {activeQuestion.type === 'agree_disagree' ? (
      <VoteAgreeDisagree ... />
    ) : (
      <VoteMultipleChoice ... />
    )}
  </motion.div>
</AnimatePresence>
```

Note: Since questions always progress forward (slide-left only), we do NOT need the `custom` direction prop. The variants above always slide new content from right and exit to left, which matches the "card-swiping through a deck" feel specified in CONTEXT.md.

### Pattern 3: Lock-In Animation with AnimatePresence

**What:** When vote is locked in, show a confirmation overlay with animated entrance.
**When to use:** VoteConfirmation component.

```typescript
import { motion, AnimatePresence } from "motion/react";

<AnimatePresence>
  {isLockedIn && (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-lg"
    >
      {/* Checkmark with draw-in animation */}
      <motion.svg
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-16 h-16 text-green-400 mb-3"
        ...
      />
      <p className="text-white text-xl font-semibold">Locked in!</p>
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 4: Connection Status Pill (Floating)

**What:** Replace the full-width ConnectionBanner with a small floating pill in the top-right corner.
**When to use:** Participant full-screen voting view. Always visible.

```typescript
import { motion, AnimatePresence } from "motion/react";

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const isConnected = status === 'connected';
  const isDisconnected = status === 'disconnected';

  return (
    <div className="fixed top-3 right-3 z-50">
      <motion.div
        layout
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          isDisconnected
            ? 'bg-red-900/90 text-red-200'
            : 'bg-gray-800/80 text-gray-400'
        }`}
      >
        {/* Animated dot */}
        <motion.span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400' : isDisconnected ? 'bg-red-400' : 'bg-yellow-400'
          }`}
          animate={isConnected ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <AnimatePresence>
          {isDisconnected && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
            >
              Disconnected
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Animating layout properties with Motion when CSS suffices:** The admin side is light-themed and functional. Do NOT add Motion animations to admin controls -- keep them simple Tailwind transitions.
- **Using `layout` prop everywhere:** Motion's `layout` prop is powerful but impacts performance. Only use it on the connection pill where layout shift matters. Do not use it on vote buttons or question containers.
- **Mixing CSS transitions with Motion animate:** When converting a component to use `motion.div`, remove conflicting CSS `transition-*` classes. Having both CSS transitions and Motion animations on the same property causes jank.
- **Forgetting `key` on AnimatePresence children:** AnimatePresence REQUIRES a unique `key` on its direct child to track presence. Without it, exit animations silently fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exit animations | Manual opacity/display toggling with `setTimeout` | `AnimatePresence` from `motion/react` | Properly handles React unmounting, prevents memory leaks, coordinates enter/exit timing |
| Gesture press feedback | `onPointerDown`/`onPointerUp` manual state | `whileTap` prop on `motion.button` | Handles touch, mouse, keyboard, cancellation, focus ring automatically |
| Slide page transitions | Manual `translateX` + `setTimeout` crossfade (current approach) | `AnimatePresence mode="wait"` with variants | Coordinates exit before enter, handles interrupted transitions, spring physics |
| Imperative animation triggers | `requestAnimationFrame` loops | `useAnimate` hook from `motion/react` | Promise-based, composable, hardware-accelerated, handles cleanup |
| Viewport height on mobile | `style={{ minHeight: '100dvh' }}` inline (current approach) | `h-dvh` or `min-h-dvh` Tailwind class | Cleaner, consistent, Tailwind v4 built-in since v3.4 |

**Key insight:** The existing codebase uses CSS transitions and manual `setTimeout`-based crossfade for question changes. Motion replaces ALL of this with a declarative approach that handles edge cases (interrupted animations, unmount timing, gesture cancellation) automatically.

## Common Pitfalls

### Pitfall 1: AnimatePresence Requires Direct Child with `key`

**What goes wrong:** AnimatePresence silently does nothing if its direct child lacks a unique `key` or if there are wrapper elements between AnimatePresence and the animated child.
**Why it happens:** AnimatePresence tracks presence by key. Conditional rendering (`{show && <motion.div />}`) works, but the motion element must be the DIRECT child.
**How to avoid:** Always structure as:
```tsx
<AnimatePresence mode="wait">
  {condition && (
    <motion.div key={uniqueId} initial="..." animate="..." exit="...">
      ...
    </motion.div>
  )}
</AnimatePresence>
```
**Warning signs:** Exit animation never plays; component just disappears instantly.

### Pitfall 2: React 19 Strict Mode Double-Mount with Motion

**What goes wrong:** In development, React 19 strict mode double-mounts components. Early Motion versions had bugs where AnimatePresence and drag gestures broke under strict mode.
**Why it happens:** React 19 has stricter ref forwarding and useEffect timing.
**How to avoid:** Use Motion v12.9.5+ (current is v12.26.x, well past the fixes). All critical React 19 strict mode bugs were fixed:
  - v12.1.0: Fixed AnimatePresence in React 19 strict mode
  - v12.9.5: Fixed drag undefined error in React 19 strict mode
  - v12.9.3: Fixed memory leak when unmounting motion components
**Warning signs:** Animations not replaying on route change, whileTap not working, console errors about undefined.

### Pitfall 3: navigator.vibrate() Does NOT Work on iOS

**What goes wrong:** Haptic feedback silently fails on iPhones.
**Why it happens:** Safari/WebKit has never implemented the Vibration API. This affects ALL iOS browsers (Chrome on iOS uses WebKit too).
**How to avoid:** The existing `useHaptic` hook already guards with `'vibrate' in navigator`. This is correct. Do NOT add any iOS-specific workarounds or promises of haptic on iOS -- it simply will not work on the web. Visual feedback (color fill + pulse animation) is the primary feedback mechanism; haptic is enhancement for Android only.
**Warning signs:** None (it fails silently by design). Just ensure the visual animation is satisfying enough to stand on its own without haptics.

### Pitfall 4: Conflicting CSS Transitions and Motion Animations

**What goes wrong:** Janky, doubled animations when Motion's `animate` prop and Tailwind's `transition-*` classes both animate the same CSS property.
**Why it happens:** Motion uses JavaScript-driven animations (WAAPI). Tailwind's `transition-all` adds CSS transitions. Both fire simultaneously.
**How to avoid:** When converting a component to use `motion.*`:
  1. Remove `transition-all`, `transition-colors`, `duration-150`, etc. from className
  2. Remove `scale-[1.02]` from className (Motion handles scale via animate/whileTap)
  3. Let Motion own ALL animated properties (scale, backgroundColor, opacity)
  4. Tailwind classes for static properties (padding, border-radius, font-size) are fine
**Warning signs:** Animations look "doubled" or "fighting", visual stutter on state change.

### Pitfall 5: Bundle Size Awareness

**What goes wrong:** Motion's full `motion` component adds ~34kb to bundle.
**Why it happens:** The declarative API includes animation, gesture, and layout engines.
**How to avoid:** For QuickVote this is acceptable -- the app is animation-heavy and 34kb is justified. If bundle size becomes a concern later, Motion offers `LazyMotion` with `m` component (~4.6kb base + ~15kb `domAnimation` features). For now, use the standard `motion` import.
**Warning signs:** Lighthouse performance score drops (unlikely for 34kb on modern connections).

### Pitfall 6: Full-Screen Takeover Breaking Scrollable Content

**What goes wrong:** Setting `h-dvh` (100dvh) on a container makes multiple-choice questions with many options unscrollable.
**Why it happens:** Fixed height prevents overflow scrolling.
**How to avoid:** Use `h-dvh` on the outermost container, but use `flex-1 overflow-y-auto` on the scrollable options list. The existing VoteMultipleChoice already has `overflow-y-auto` on the compact view -- preserve this.
**Warning signs:** Options get cut off at bottom of screen on smaller phones.

## Code Examples

### Complete Vote Button Animation Pattern

```typescript
// Source: motion.dev/docs/react-gestures, motion.dev/docs/react-animation
import { motion, useAnimate } from "motion/react";
import { useCallback, useEffect, useRef } from 'react';

// Color constants from BarChart.tsx
const COLORS = { agree: '#3B82F6', disagree: '#F97316' };
const UNSELECTED = 'rgba(55, 65, 81, 0.5)';  // gray-700/50

function VoteButton({
  value,
  label,
  isSelected,
  isLockedIn,
  submitting,
  onTap,
  color,
}: {
  value: string;
  label: string;
  isSelected: boolean;
  isLockedIn: boolean;
  submitting: boolean;
  onTap: (value: string) => void;
  color: string;
}) {
  const [scope, animate] = useAnimate();
  const prevSelected = useRef(isSelected);

  // Trigger pulse when newly selected
  useEffect(() => {
    if (isSelected && !prevSelected.current) {
      animate(scope.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
    }
    prevSelected.current = isSelected;
  }, [isSelected, animate, scope]);

  return (
    <motion.button
      ref={scope}
      disabled={isLockedIn || submitting}
      onClick={() => onTap(value)}
      animate={{
        backgroundColor: isSelected ? color : UNSELECTED,
      }}
      whileTap={!isLockedIn && !submitting ? { scale: 0.97 } : undefined}
      transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
      className="flex-1 flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      {label}
      {isSelected && !isLockedIn && (
        <span className="text-sm font-normal mt-1 opacity-80">
          Tap again to lock in
        </span>
      )}
    </motion.button>
  );
}
```

### AnimatePresence Slide Transition Wrapper

```typescript
// Source: motion.dev/docs/react-animate-presence
import { motion, AnimatePresence } from "motion/react";

const questionSlideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
};

const questionTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

// Usage in ParticipantSession voting view:
<AnimatePresence mode="wait" initial={false}>
  {displayedQuestion && (
    <motion.div
      key={displayedQuestion.id}
      variants={questionSlideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={questionTransition}
      className="flex-1 flex flex-col"
    >
      {/* Vote component here */}
    </motion.div>
  )}
</AnimatePresence>
```

### Full-Screen Participant Layout

```typescript
// Participant voting full-screen takeover
<div className="h-dvh bg-gray-950 flex flex-col overflow-hidden">
  {/* Connection pill - always visible */}
  <ConnectionPill status={connectionStatus} />

  {/* Minimal top bar - only timer if active */}
  {isRunning && (
    <div className="flex justify-end px-4 py-2">
      <CountdownTimer remainingSeconds={remaining} isRunning={isRunning} />
    </div>
  )}

  {/* Full-screen voting area with slide transitions */}
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={displayedQuestion.id}
      variants={questionSlideVariants}
      initial="enter" animate="center" exit="exit"
      transition={questionTransition}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Question + vote buttons fill remaining space */}
    </motion.div>
  </AnimatePresence>
</div>
```

### Admin Projection-Friendly Results Layout

```typescript
// Desktop participants: centered card, dark theme
<div className="h-dvh bg-gray-950 flex items-center justify-center p-8">
  <div className="w-full max-w-2xl">
    {/* Centered card for desktop, still dark */}
  </div>
</div>

// Admin results: large & bold, light theme for management
<div className="min-h-screen bg-white py-8 px-4">
  <div className="max-w-5xl mx-auto">
    {/* Bigger bar chart, larger fonts, more padding */}
    <BarChart data={data} totalVotes={total} size="large" />
  </div>
</div>
```

### Tailwind v4 Dark Theme Setup (CSS-first)

```css
/* src/index.css */
@import "tailwindcss";

/* Custom theme tokens for dark participant experience */
@theme {
  --color-surface-dark: oklch(0.205 0.015 264);    /* charcoal: ~#1C1C1E */
  --color-surface-elevated: oklch(0.27 0.015 264);  /* lighter charcoal: ~#2C2C2E */
  --color-vote-agree: oklch(0.637 0.18 243);        /* blue: #3B82F6 */
  --color-vote-disagree: oklch(0.702 0.17 48);      /* orange: #F97316 */
}
```

Usage: `bg-surface-dark`, `bg-surface-elevated`, `bg-vote-agree`, `bg-vote-disagree`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install framer-motion` | `npm install motion` | 2024 rebrand | Import from `"motion/react"` not `"framer-motion"` |
| `import { motion } from "framer-motion"` | `import { motion } from "motion/react"` | 2024 | Subpath export, tree-shakable |
| `style={{ minHeight: '100dvh' }}` | `className="min-h-dvh"` | Tailwind v3.4 / v4 | Built-in utility class, no inline style needed |
| `tailwind.config.js` dark mode config | `@custom-variant dark (...)` in CSS | Tailwind v4 | CSS-first, no config file |
| `motion()` factory for custom components | `motion.create()` | Motion v11.5 | `motion()` deprecated in favor of `motion.create()` |
| `whileTap` considered for rename | `whileTap` remains canonical | n/a | Despite docs mentioning "press" gestures, the prop is `whileTap` in v12.x |

**Deprecated/outdated:**
- `framer-motion` package: Still published but deprecated in favor of `motion`
- `motion()` function: Use `motion.create()` instead (v11.5+)
- `useAnimation()`: Renamed to `useAnimationControls()` (old name is backward-compatible alias)

## Open Questions

1. **Exact dark theme color values**
   - What we know: Context specifies "dark/charcoal background with bright vote buttons." The existing codebase uses `bg-gray-950` (#030712) everywhere on participant side.
   - What's unclear: Whether to keep gray-950 or switch to a warmer charcoal. The existing palette already works.
   - Recommendation: Keep `bg-gray-950` for consistency. It IS a very dark charcoal. Define semantic color tokens via `@theme` only if we add distinct surface levels (elevated cards, etc.). This is Claude's discretion per CONTEXT.md.

2. **Agree/Disagree button layout: stacked vs side-by-side**
   - What we know: Context says "Claude's discretion, optimize for large tap targets on mobile." Current layout is stacked vertical (`flex-col`), each button takes half the screen height.
   - What's unclear: Whether side-by-side would be better on wider phones/landscape.
   - Recommendation: Keep stacked vertical. Two full-width buttons give the largest possible tap targets. Side-by-side halves the width on narrow phones. This is the right call for mobile-first. Desktop participants get centered card layout.

3. **Motion import strategy: `motion` vs `LazyMotion` + `m`**
   - What we know: Full `motion` component is ~34kb. LazyMotion + domAnimation is ~4.6kb + 15kb = ~19.6kb.
   - What's unclear: Whether the 14kb savings matters for this app.
   - Recommendation: Use standard `motion` import. The app is animation-heavy (every vote button, every transition). LazyMotion saves ~14kb but adds code complexity. Not worth optimizing at this stage.

## Sources

### Primary (HIGH confidence)
- [motion npm package](https://www.npmjs.com/package/motion) - Version 12.26.2, confirmed current
- [motion GitHub repository](https://github.com/motiondivision/motion) - MIT license, 30.9k stars, React 18.2+ compatible
- [Motion installation docs](https://motion.dev/docs/react-installation) - Confirmed `motion/react` import path
- [Motion AnimatePresence docs](https://motion.dev/docs/react-animate-presence) - mode="wait", custom prop, key requirements
- [Motion gestures docs](https://motion.dev/docs/react-gestures) - whileTap, whileHover, keyboard accessibility
- [Tailwind CSS dark mode docs](https://tailwindcss.com/docs/dark-mode) - dark: variant, @custom-variant
- [Tailwind CSS height docs](https://tailwindcss.com/docs/height) - h-dvh, min-h-dvh utilities
- [Tailwind CSS responsive design docs](https://tailwindcss.com/docs/responsive-design) - Mobile-first breakpoints
- [MDN Navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) - API specification
- [Can I Use: Vibration API](https://caniuse.com/vibration) - Browser support matrix

### Secondary (MEDIUM confidence)
- [Direction-aware animations in Framer Motion (OlegWock)](https://sinja.io/blog/direction-aware-animations-in-framer-motion) - custom prop pattern for directional slides
- [Motion changelog](https://motion.dev/changelog) - React 19 fixes timeline
- [GitHub issue #2668: React 19 compatibility](https://github.com/motiondivision/motion/issues/2668) - Fixed in v12.x
- [Motion bundle size guide](https://motion.dev/docs/react-reduce-bundle-size) - 34kb full, LazyMotion alternative

### Tertiary (LOW confidence)
- WebSearch results for `whilePress` vs `whileTap` - No evidence of rename found, but motion.dev renders as JS-only so could not verify directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - npm package confirmed v12.26.2, React 19 compatible, import path verified
- Architecture patterns: HIGH - AnimatePresence, whileTap, variants are well-documented core Motion features
- Animation code examples: MEDIUM - Patterns assembled from docs + community sources, may need minor adjustments
- Dark theme / Tailwind: HIGH - Built-in Tailwind v4 features, already partially used in codebase
- Haptic feedback: HIGH - navigator.vibrate browser support is well-documented (no iOS, yes Android)
- Pitfalls: HIGH - React 19 strict mode issues are documented with specific fix versions

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (Motion v12 is stable, no breaking changes expected)
