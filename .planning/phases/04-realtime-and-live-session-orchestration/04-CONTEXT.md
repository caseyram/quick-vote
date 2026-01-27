# Phase 4: Realtime and Live Session Orchestration - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can run a live voting session where participants see questions in real-time, votes update live, and results are revealed on command. Replaces Phase 3's polling bridge with Supabase Realtime subscriptions. Covers: admin question advancement, live vote streaming, countdown timer, results reveal, and participant presence tracking. Does NOT include immersive UI/animations (Phase 5) or vote reasons/highlighting (deferred).

</domain>

<decisions>
## Implementation Decisions

### Session flow choreography
- Brief crossfade (~300ms) between questions when admin advances — fade-out/fade-in
- Results are admin-only — participants see a "results shown" message, not the bar chart
- After the last question, admin sees a summary screen of all questions and results; participants see a "session complete" message
- Forward-only question flow, but admin can revisit past results without reopening voting

### Results visualization
- Vertical bar chart (bars grow bottom-to-top, labels below)
- Smooth growth animation as votes arrive in real-time — fluid, continuous motion
- Each bar shows both raw vote count and percentage
- Neutral color palette for agree/disagree (e.g., blue/orange) — avoids implying right/wrong
- Multiple choice questions use distinct but non-judgmental colors per option

### Countdown timer behavior
- On-the-fly timer choice — admin picks from quick options (15s, 30s, 60s, no timer) when activating a question
- Subtle timer indicator for participants — small, non-distracting, in the corner
- Auto-close + auto-reveal on timer expiry — voting closes and results reveal automatically when timer hits zero
- Last 5 seconds: timer indicator pulses or changes color to signal urgency

### Participant presence
- Admin sees connected count with a pulsing dot/icon indicator showing the connection is live
- Participants also see participant count ("X people in this session") — creates social proof
- Disconnection shows an inline banner at the top: "Reconnecting..." that auto-dismisses when back online
- ~10 second grace period before removing disconnected participants from count — avoids flicker from brief network blips

### Claude's Discretion
- Exact crossfade implementation technique (CSS transitions vs animation library)
- Bar chart implementation approach (CSS, SVG, or canvas)
- Specific neutral color values for agree/disagree and multiple choice
- Timer UI element design (progress ring, number, progress bar)
- Reconnection retry strategy and backoff
- Summary screen layout and information hierarchy

</decisions>

<specifics>
## Specific Ideas

- Results are a presentation tool for the admin (projected screen) — participants don't need to see charts, just a confirmation that results are being shown
- The timer should feel low-pressure — subtle indicator, not a big countdown clock dominating the screen
- Participant count creates energy and social proof — participants knowing others are in the session makes it feel alive

</specifics>

<deferred>
## Deferred Ideas

- **Vote reasons with admin highlighting:** Participants can optionally provide a text reason alongside their vote. Reasons displayed in columns per option. Admin can click to highlight specific reasons to guide conversation flow. This is a significant new capability — own phase or backlog item.

</deferred>

---

*Phase: 04-realtime-and-live-session-orchestration*
*Context gathered: 2026-01-27*
