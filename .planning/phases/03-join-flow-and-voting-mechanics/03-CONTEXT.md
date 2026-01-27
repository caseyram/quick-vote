# Phase 3: Join Flow and Voting Mechanics - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Participants can join a session via QR code and cast votes (agree/disagree or multiple choice) that persist correctly. The complete vote lifecycle works end-to-end without realtime updates. Covers: QR join, lobby, voting UI, lock-in, admin question activation, anonymous/named config, mid-session join, and session end state.

</domain>

<decisions>
## Implementation Decisions

### Voting interaction
- Agree/disagree: Two large buttons with thumbs up/down icons, filling the screen
- Multiple choice: Claude's discretion on layout (stacked cards vs grid based on option count)
- Vote confirmation: Haptic feedback (phone vibration) plus visual highlight on the selected option
- Lock-in: Double-tap pattern — first tap selects (can still change), second tap on same option locks it in
- No manual "Lock In" button; the double-tap is the lock-in gesture

### Admin controls
- Admin screen is the **presentation screen** (projected/shared during the session)
- Question activation: One at a time, sequential. Admin clicks "Start" on a question.
- Anonymous/named voting: Session-wide default with per-question override available
- Admin view during voting: Toggleable — live vote breakdown OR simple count ("4/50 voted")
- Close voting reveals results immediately to admin (no separate reveal step)
- Persistent QR code: Small QR code fixed in bottom-right corner of admin screen with join text for latecomers, toggleable on/off

### Session state & edge cases
- Mid-session join: Drop participant straight into the currently active question
- No backtracking: Once a question is closed, participants cannot go back to vote on it
- Lobby screen: Session title + participant count ("Waiting for host to start...")
- Session end: Scrollable results summary of all questions (not just a thank-you screen)

### Claude's Discretion
- Multiple choice layout approach (stacked vs grid based on option count)
- Admin view default state (live breakdown vs count — just needs to be toggleable)
- QR code size and exact placement styling
- Haptic feedback implementation details
- Loading and transition states between questions
- Error handling for failed vote submissions

</decisions>

<specifics>
## Specific Ideas

- Admin screen is a shared/projected display — all admin UI decisions should account for readability at distance
- The QR code in bottom-right is for latecomers joining mid-session — should be unobtrusive but scannable
- Double-tap lock-in should feel intentional — distinct from accidental double-tap (visual state change between first and second tap)
- "4/50 voted" style count gives admin a sense of participation rate before revealing results

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-join-flow-and-voting-mechanics*
*Context gathered: 2026-01-27*
