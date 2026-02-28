# Retro Board / In-Experience Feedback

## Vision

Support real-time, participant-initiated feedback collection during sessions. A new "Retro Set" batch type that follows the same facilitator-led flow as question sets, but replaces fixed-choice voting with free-text multi-submit responses, response grouping, and live facilitator notes.

Serves two use cases:
1. **Side feedback** — retro categories available alongside a normal slide/question session via a persistent feedback button in a participant menu bar
2. **Standalone retro** — entire session is a retro, facilitator picks a format, participants submit, facilitator guides the review

## Key Design Decisions (from discussion)

- Participants do NOT see others' responses until facilitator reveals — standard retro practice
- Participants CAN see, edit, and remove their own submissions before time expires
- Anonymous by default
- One timer for all categories (not per-category)
- Facilitator reveals category by category, same flow as revealing questions today
- Categories function like questions — "Liked", "Loved", "Longed For" ARE the questions
- No chart needed — responses displayed as cards/wall since there's nothing to aggregate
- Facilitator can group related/duplicate responses for side-by-side display
- Facilitator captures notes/takeaways/action items in real-time, displayed live to participants and presentation view

## User Journeys

### Facilitator — Standalone Retro
1. Creates a session with a Retro Set (picks a format or defines custom categories)
2. Starts session, sets timer duration
3. Participants submit responses across categories during timed window
4. Timer ends → submissions lock
5. Facilitator selects which category to review first (or lets audience choose)
6. Reveals category → sees all response cards
7. Spotlights individual responses for group discussion
8. Groups related/duplicate responses together (displayed side by side)
9. Captures notes, takeaways, and action items in an open text area — displayed live on participant view and presentation view
10. Moves to next category when ready

### Facilitator — Side Feedback (alongside normal session)
1. Creates a session with slides, question sets, AND a retro set
2. Retro set is available to participants throughout the session via menu bar feedback icon
3. Normal session runs facilitator-paced as usual
4. At any point, facilitator switches to retro board view to review captured feedback
5. Same reveal/spotlight/notes flow as standalone

### Participant — Standalone Retro
1. Joins session
2. Sees categories with a countdown timer
3. Submits multiple free-text responses to any category
4. Can review, edit, remove own submissions before timer ends
5. Timer ends → submissions lock, waiting for facilitator
6. When facilitator reveals a category, participant sees responses and spotlight
7. Sees facilitator's notes/action items update live

### Participant — Side Feedback
1. Joins session as normal
2. Menu bar at top: theme toggle, feedback icon, team name, connection status
3. Taps feedback icon → drawer opens with retro categories
4. Submits responses anytime during session
5. Closes drawer, returns to facilitator-led content
6. When facilitator switches to retro review, participant view updates accordingly

## Participant Menu Bar
Consolidate floating elements into a proper header bar:
- Theme toggle
- Feedback icon (opens retro drawer when retro set is active)
- Team name (centered)
- Connection status

Replaces current scattered layout (theme toggle top-left, team badge top-center, connection pill).

## Pre-Built Retro Templates
First-class retro formats available as quick-start options:
- Start, Stop, Continue
- Rose, Thorn, Bud
- Liked, Loved, Longed For
- 4Ls (Liked, Learned, Lacked, Longed For)
- Mad, Sad, Glad
- Custom (define your own categories)

## Data Model

**Retro Set** = batch with `type: 'retro'`
**Categories** = questions with `type: 'free_response'`
**Submissions** = votes with multi-submit allowed per participant per question (value = response text, no separate reason field needed)
**Response groups** = new linkage between votes (group_id or parent/child) for related/duplicate clustering
**Facilitator notes** = new field per question/category for capturing discussion outcomes, takeaways, action items — broadcast live via realtime

## Presentation View

When a category is revealed:
- Response cards fill the available space (no chart — nothing to aggregate)
- Facilitator spotlights one → displayed large/centered for discussion
- Grouped responses cluster together (side by side or stacked)
- Notes/action items area visible, updating live as facilitator types
- Smooth transitions between spotlight responses

## Requirements

### R1: Retro Set Batch Type
- New batch type alongside existing question sets
- Contains categories (like questions) but with `free_response` type
- No fixed options/choices
- Template editor gets a "Retro Set" item type with category configuration

### R2: Free-Text Multi-Submit
- Participants can submit multiple responses per category
- Each submission stored as a vote row
- No duplicate prevention (multiple submissions expected)
- Participant can review, edit, remove own submissions before lock

### R3: Timed Capture Window
- Facilitator sets a timer duration for the retro set
- One timer covers all categories
- Countdown visible to participants
- When timer ends, submissions lock — no more edits
- Facilitator can also manually close submissions early

### R4: Facilitator Reveal + Discussion
- Facilitator reveals one category at a time (same pattern as question reveal)
- Can choose order (or let audience decide)
- Sees all responses for revealed category
- Can spotlight individual responses for group discussion
- Spotlight displayed prominently on presentation view

### R5: Response Grouping
- Facilitator can select multiple responses and group them as related or duplicate
- Grouped responses displayed side by side or clustered
- Groups persist for the session review

### R6: Live Notes / Takeaways / Action Items
- Open text area on admin view per category
- Facilitator types notes, takeaways, action items during discussion
- Content broadcasts live to participant view and presentation view
- Displayed in the open space where a chart would normally be
- Persisted with the session for later review/export

### R7: Standalone Retro Mode
- Session can consist of only retro set(s)
- Pre-built retro format selection at creation
- Simplest possible retro experience

### R8: Side Feedback Integration
- Retro set available alongside normal slides/question sets
- Participant menu bar with feedback icon
- Drawer-based submission UI that doesn't interrupt facilitator-led flow

### R9: Template + Export Support
- Retro sets included in session templates
- Import/export includes retro configuration and responses
- Session review shows retro responses with facilitator notes and groups

## Phases

### Phase 1: Foundation (~2 build runs)
- Retro set batch type in template editor
- `free_response` question type with multi-submit
- Timed capture window with participant review/edit/remove
- Submission lock on timer end
- Basic card/wall renderer in presentation view (no spotlight yet)

### Phase 2: Facilitator Discussion Mode (~2-3 build runs)
- Category-by-category reveal (same flow as questions)
- Spotlight individual responses on presentation view
- Response grouping (related/duplicate)
- Live notes/takeaways/action items with realtime broadcast
- Participant menu bar consolidation

### Phase 3: Templates + Integration (~1-2 build runs)
- Pre-built retro format templates
- Side feedback pattern (drawer + FAB alongside normal sessions)
- Export retro results with notes and groups
- Visual polish (sticky note style, animations, category colors)

## Open Questions
- Should facilitator notes be per-category or per-session? (Leaning per-category)
- Should response grouping be drag-and-drop or multi-select? (Probably multi-select for simplicity)
- Color coding for categories? (Could match retro format conventions)
