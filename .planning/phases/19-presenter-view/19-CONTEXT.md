# Phase 19: Presenter View - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can operate the session from a control view while a separate presentation window shows clean projected output, synced across devices via Supabase Realtime. Includes QR overlay control, extended keyboard shortcuts, black screen mode, and admin-controlled result reveal during batches. Session templates and export/import are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Presentation window launch & content
- Both: "Open Presentation" button does `window.open()`, BUT the presentation URL also works standalone for cross-device use
- Background: dark #1a1a1a (matches existing Phase 18 slide letterbox)
- Minimal chrome: no controls visible, but a subtle "Press F for fullscreen" hint appears on first open, then disappears
- Reconnection: keep showing last content but display a subtle pulsing reconnecting indicator in a corner until Realtime connection restores

### Admin control view layout
- Replaces current admin view entirely when entering presentation mode (dedicated control panel, not an overlay)
- Shows current + next item side by side: left is live mirror of what's currently projected, right is mini projection preview of the next item
- Full scrollable sequence list visible (all items, current highlighted)
- Navigation controls (Next/Previous) alongside the sequence list

### Batch control & result reveal
- Admin-controlled reveal: audience sees question first, admin clicks to reveal results when ready
- One question at a time: admin steps through questions within a batch, presentation shows one chart/result set at a time
- Admin control view: full current batch experience (charts, reasons, all scrollable lists) PLUS a "Reveal to audience" toggle per question
- Chart stays visible at all times on projection once revealed
- Reasons: admin scrolls through reasons on control view, clicks a reason to project it alongside the chart (side-by-side layout: chart left, reason right)
- One reason at a time: clicking a reason replaces the previous one on projection
- Click same reason again to dismiss (toggle behavior) — returns to chart-only view
- Each reason card shows vote option via color-coded left border/stripe matching the option's color

### QR overlay
- Two modes controlled from admin control view:
  1. **Small corner QR** — bottom-right corner overlay, toggle on/off. Persistent, out of the way of main content
  2. **Full-screen QR** — large centered QR with "Scan to join" text. For "join now" moments, like current QR functionality but controlled from the control window
- Hidden by default — admin toggles on when needed
- QR graphic only (no URL text below)

### Black screen & keyboard shortcuts
- B key: fade to/from black (~0.5s smooth transition). Toggle behavior
- Escape: exits browser fullscreen only (presentation window stays open and synced)
- F key: toggle browser fullscreen in presentation window
- Keyboard shortcuts work in BOTH windows (control view and presentation window)
- ? key: shows translucent overlay listing all shortcuts, press again or Escape to dismiss

### Claude's Discretion
- Exact layout proportions and spacing of control view panels
- Transition animations for result reveal
- Reconnection retry strategy and indicator design
- Sequence list item styling in control view
- How "Press F for fullscreen" hint appears and disappears
- Keyboard shortcut help overlay design

</decisions>

<specifics>
## Specific Ideas

- Batch result projection is a "spotlight" UX — admin curates what the audience sees in real time by clicking through questions and reasons
- Reason cards on projection should feel like a call-out/highlight, with the vote option color stripe giving immediate context
- The control view should feel like a presentation tool control room (think: PowerPoint presenter view, OBS Studio controls)
- Current QR functionality should translate 1:1 to the presentation window, just controlled remotely from the admin view

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-presenter-view*
*Context gathered: 2026-02-11*
