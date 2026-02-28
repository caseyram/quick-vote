# Retro Board / In-Experience Feedback

## Vision

Support real-time, participant-initiated feedback collection during sessions. Participants capture thoughts as they go (like digital sticky notes), while the facilitator can selectively display and discuss individual responses.

Serves two use cases:
1. **Walk-out retro** — participants submit feedback throughout the session, board is reviewed at the end
2. **Standalone retro** — session is purely a retro, facilitator picks categories, participants submit, facilitator selects responses for group discussion

## User Journeys

### Facilitator
1. Creates a session with one or more retro categories (e.g. "Liked", "Loved", "Longed For")
2. Optionally runs a normal slide/question session alongside
3. At any point, switches to the retro board view in presentation mode
4. Sees all submitted responses grouped by category
5. Selects individual responses to display for group discussion (one at a time or batch)
6. Can moderate (hide) inappropriate responses
7. Can use retro as standalone — no slides or question sets needed

### Participant
1. Joins session as normal
2. Sees a persistent "Add feedback" button available at all times during the session
3. Taps it → picks a category → types their thought → submits → back to session
4. Can submit as many entries as they want, whenever they want
5. Can see their own submissions
6. When facilitator selects a response for discussion, participant view updates (optional)

## Requirements

### R1: Free Response Question Type
- New question type: `free_response`
- Allows multiple submissions per participant per question
- No fixed options — participant provides free text
- Each submission stored as a vote row (value = category name, reason = response text)
- Results render as a categorized list, not a bar chart

### R2: Retro Board Session Item
- New session item type: `retro_board` (alongside `batch` and `slide`)
- Contains one or more categories (like questions in a batch)
- Active for the entire session duration (not facilitator-paced)
- Participants can submit to it at any time

### R3: Participant Capture UI
- Floating action button always visible when a retro board is active in the session
- Tap → category picker → text input → submit
- Shows count of participant's own submissions
- Doesn't interrupt the current facilitator-led flow

### R4: Facilitator Discussion Mode
- Facilitator can switch to retro board view in presentation controls
- Sees all responses grouped by category
- Can select an individual response to "spotlight" on the presentation view
- Spotlight shows the response text prominently for group discussion
- Can navigate through responses one by one within a category
- Existing moderation (eye icon) works on retro responses

### R5: Presentation Board View
- New presentation renderer for retro board
- Default: all responses grouped by category (card wall / sticky note layout)
- Spotlight mode: single response displayed large and centered
- Smooth transitions between spotlight responses

### R6: Template Support
- Retro board can be part of a session template
- Template editor gets a "Retro Board" item type with category configuration
- Import/export includes retro board configuration

### R7: Standalone Retro Mode
- Session can consist of only a retro board (no slides, no question sets)
- Facilitator creates session, participants join, submit feedback, facilitator reviews
- Simplest possible retro experience

## Phases

### Phase 1: Foundation
- `free_response` question type
- Multi-submit per participant
- List/wall renderer in presentation view
- Facilitator response selection for discussion

### Phase 2: Always-On Capture
- Retro board as session-level feature
- Floating participant capture button
- Runs alongside normal session flow
- Board presentation view with spotlight mode

### Phase 3: Polish
- Sticky note visual style
- Animations/transitions
- Category color coding
- Export retro results
- Standalone retro session template

## Open Questions
- Should participants see other participants' submissions in real-time, or only when facilitator reveals?
- Should there be a time limit or submission cap per participant?
- Anonymous by default, or option for named responses?
