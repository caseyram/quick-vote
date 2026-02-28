# Requirements — QuickVote v1.5 Bugfix & Polish

## R1: Presenter view reflects admin question tab selection

When the admin clicks a question tab (Q1, Q2, etc.) after results are revealed, the presenter projection must switch to show that question's results.

- **AC-R1-1:** Clicking a question tab broadcasts `question_selected` AND clears any active `reason_highlight` on the presenter
- **AC-R1-2:** The projection displays the selected question's chart and results within 1 second of tab click
- **AC-R1-3:** If a reason was highlighted on Q1 and admin clicks Q2, the projection shows Q2's results (not Q1)

---

## R2: Session template save offers overwrite on name collision

When saving a new session template with a name that already exists, the system must prompt the user to overwrite instead of showing an error.

- **AC-R2-1:** On name collision, a confirm dialog appears asking "A template with this name already exists. Overwrite?"
- **AC-R2-2:** Confirming overwrites the existing template's blueprint and item count
- **AC-R2-3:** Canceling returns to the editor with no changes, name still editable
- **AC-R2-4:** After overwrite, the editor's templateId is updated to the existing template's ID (subsequent saves update in place)

---

## R3: Unsaved changes warning on navigation

Navigating away from the template editor with unsaved changes must prompt the user to confirm.

- **AC-R3-1:** In-app navigation (back button, clicking a link) while `isDirty` shows a confirmation dialog
- **AC-R3-2:** User can confirm (navigate away, losing changes) or cancel (stay in editor)
- **AC-R3-3:** Browser refresh/close continues to trigger the existing `beforeunload` warning
- **AC-R3-4:** Saving clears the dirty flag — subsequent navigation proceeds without prompt

---

## R4: Caption and notes input preserves trailing spaces while typing

Text input for slide captions and presenter notes must not strip trailing whitespace on every keystroke.

- **AC-R4-1:** Typing "Hello " (with trailing space) in the caption field retains the trailing space in the input value
- **AC-R4-2:** Typing "Hello " in the notes field retains the trailing space
- **AC-R4-3:** Leading/trailing whitespace is trimmed on save or blur, not on every change event
- **AC-R4-4:** Empty input (only whitespace) still resolves to null on blur/save

---

## R5: Save MC question options as response template from session editor

Users can save a multiple choice question's custom options as a reusable response template without leaving the session editor.

- **AC-R5-1:** When a MC question has custom options (no template selected), a "Save as Template" action is visible
- **AC-R5-2:** Clicking it prompts for a template name
- **AC-R5-3:** On confirm, the options are saved as a new response template via the existing `createTemplate()` API
- **AC-R5-4:** The question is automatically linked to the newly created template (`template_id` set)
- **AC-R5-5:** The new template appears in the template dropdown immediately (store updated)
- **AC-R5-6:** If the name collides with an existing template, show an error (consistent with `createTemplate` behavior)

---

## R6: Light/dark/system theme for participant and presentation views

Theme preference should default to OS setting and be overridable by the user across all views.

- **AC-R6-1:** Theme type supports `'dark'` | `'light'` | `'system'`
- **AC-R6-2:** Default is `'system'` — resolves to OS preference via `prefers-color-scheme`
- **AC-R6-3:** User can toggle between dark/light/system; preference persists in localStorage
- **AC-R6-4:** Theme toggle is accessible on: Home page, participant session view, presentation view
- **AC-R6-5:** Participant voting views (`VoteAgreeDisagree`, `VoteMultipleChoice`, `ParticipantSession`) respect the active theme — no hardcoded dark classes
- **AC-R6-6:** Presentation view respects the active theme instead of hardcoded `#1a1a2e` background
- **AC-R6-7:** When set to `'system'`, theme updates live if OS preference changes (media query listener)

---

## R7: Screen reader accessibility for participant voting

Participant voting must be usable with screen readers (VoiceOver, NVDA, JAWS).

- **AC-R7-1:** Vote option buttons are wrapped in a container with `role="radiogroup"` and an accessible label (the question text)
- **AC-R7-2:** Each vote button has `role="radio"` and `aria-checked` reflecting selection state
- **AC-R7-3:** Vote submission confirmation is announced via an `aria-live="polite"` region
- **AC-R7-4:** Reason textarea has an explicit `aria-label`
- **AC-R7-5:** Keyboard focus indicators are visible on all interactive elements (no `outline-none` without a visible alternative)
- **AC-R7-6:** Batch carousel announces current position (e.g., "Question 2 of 5")
- **AC-R7-7:** Question text is associated with the vote group via `aria-labelledby`

---

## R8: Slide notes bullet display spacing

Presenter notes rendered with bullets must have proper visual spacing between bullet markers and text.

- **AC-R8-1:** Bullet list items in slide notes have visible spacing between the bullet marker and the text content
- **AC-R8-2:** Applies to both the editor preview and the presenter notes panel in admin controls
- **AC-R8-3:** Nested lists maintain consistent indentation and spacing

---

## Out of Scope

- Slide delete discoverability (hover-to-reveal X) — noted but not addressed this milestone
- Response template CRUD beyond "Save as Template" in the session editor (edit/delete stay on the standalone page)
- Admin view theming (admin pages stay as-is)
- Presentation view background color customization per session (future milestone)
