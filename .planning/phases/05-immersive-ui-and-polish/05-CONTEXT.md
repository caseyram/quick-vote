# Phase 5: Immersive UI and Polish - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the functional voting tool into an app-like, tactile experience. Full-screen mobile voting with animations, responsive layout across phone and desktop, and connection status feedback. The underlying functionality (voting, realtime, session management) is complete from Phases 1-4 -- this phase is purely visual/interaction polish.

</domain>

<decisions>
## Implementation Decisions

### Vote interaction feel
- Color fill + pulse on vote tap -- option fills with color and pulses once to confirm selection (bold, confident feel)
- Instant swap when changing vote -- old option instantly loses color, new option fills immediately (snappy, no hesitation)
- Haptic feedback on both tap and lock-in -- light vibration on vote tap, stronger vibration on lock-in
- Lock-in animation: Claude's discretion (should complement the color-fill-and-pulse style)

### Full-screen takeover
- 100% full-screen takeover when question is active -- no header, no nav, just question text and vote buttons
- Dark/charcoal background with bright vote buttons -- dramatic, presentation-room feel, options pop against dark
- Slide-left transition between questions -- current question slides out left, new one slides in from right (card-swiping feel)
- Agree/disagree layout: Claude's discretion (optimize for large tap targets on mobile)

### Responsive split
- Light admin, dark participant -- admin stays light/functional for managing, participants get immersive dark experience
- Admin results display: large & bold -- bigger bar chart, larger fonts, more padding, optimized for projection/readability from distance
- Desktop participants get adapted layout -- centered card (not edge-to-edge) for larger screens, still dark themed
- Admin management: desktop-first is fine -- don't spend effort making admin setup perfect on mobile

### Connection indicator
- Small floating pill in top-right corner -- green dot when connected, red with text when disconnected
- Always visible when connected -- constant reassurance via green dot in corner
- Red pill + disable voting when disconnected -- pill turns red with "Disconnected" text, vote buttons disabled until reconnected
- Position: top-right corner of the full-screen voting view

### Claude's Discretion
- Lock-in animation style (should complement color-fill-and-pulse vote selection)
- Agree/disagree layout choice (stacked vertical vs side by side -- optimize for mobile tap targets)
- Exact animation timing and easing curves
- Multiple choice option sizing and layout in full-screen mode
- Loading/transition skeleton treatment
- Exact dark theme color values and contrast ratios

</decisions>

<specifics>
## Specific Ideas

- Vote selection feel is "bold and confident" -- color fill, not subtle highlights
- The full-screen dark view should feel like a presentation room / event experience
- Slide-left transitions give the feel of swiping through a deck of cards
- Blue/orange color palette from Phase 4 (agree/disagree) should pop against the charcoal background
- Haptics reinforce both the casual tap (light) and the commitment moment (strong on lock-in)
- Admin projected view should be readable from the back of a room

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-immersive-ui-and-polish*
*Context gathered: 2026-01-27*
