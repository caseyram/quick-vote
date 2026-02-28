# Verification Plan — QuickVote v1.5

## R1: Presenter view tab switching

**AC-R1-1:** Clicking a question tab broadcasts question_selected AND clears reason_highlight
- Method: Code check
- Verify: `handleSelectQuestion` in PresentationControls.tsx contains both broadcasts (question_selected and reason_highlight with empty reasonId)
- Run after: Phase 1

**AC-R1-2:** Projection updates within 1 second
- Method: Behavioral check (UAT)
- Steps: Open admin + presentation in separate windows. Activate batch, reveal all. Highlight a reason on Q1. Click Q2 tab. Verify projection switches to Q2 within 1 second.
- Run after: Phase 1

**AC-R1-3:** Highlighted reason on Q1 doesn't block Q2
- Method: Behavioral check (UAT)
- Steps: Same as AC-R1-2 — specifically verify Q1's reason is no longer displayed after clicking Q2.
- Run after: Phase 1

---

## R2: Session template save overwrite

**AC-R2-1:** Confirm dialog on name collision
- Method: Behavioral check (UAT)
- Steps: Create template "Test". Create new session, save as template with name "Test". Verify ConfirmDialog appears with overwrite option.
- Run after: Phase 1

**AC-R2-2:** Overwrite updates blueprint and item count
- Method: Behavioral check + query check
- Steps: Confirm overwrite in dialog. Query `session_templates` table — verify the existing row's `blueprint` and `item_count` are updated (not a new row created).
- Run after: Phase 1

**AC-R2-3:** Cancel returns to editor unchanged
- Method: Behavioral check (UAT)
- Steps: Trigger name collision dialog, click Cancel. Verify editor state is unchanged, name field still editable.
- Run after: Phase 1

**AC-R2-4:** After overwrite, templateId updated
- Method: Code check + behavioral check
- Verify: After overwrite, subsequent saves use `overwriteSessionTemplate` (not insert). Test: overwrite, make a change, save again — verify no second collision dialog.
- Run after: Phase 1

---

## R3: Unsaved changes warning

**AC-R3-1:** In-app navigation while dirty shows dialog
- Method: Behavioral check (UAT)
- Steps: Open editor, make a change (add a question). Click browser back button or a nav link. Verify ConfirmDialog appears.
- Run after: Phase 1

**AC-R3-2:** Confirm/cancel behavior
- Method: Behavioral check (UAT)
- Steps: Trigger dialog. Click Cancel — verify stays in editor. Trigger again. Click Leave — verify navigates away.
- Run after: Phase 1

**AC-R3-3:** Browser refresh still triggers beforeunload
- Method: Behavioral check (UAT)
- Steps: Make a change, press F5/Cmd+R. Verify browser-native "Leave site?" dialog appears.
- Run after: Phase 1

**AC-R3-4:** Saving clears dirty flag
- Method: Behavioral check (UAT)
- Steps: Make a change, save. Navigate away. Verify no dialog appears.
- Run after: Phase 1

---

## R4: Caption/notes trimming

**AC-R4-1:** Trailing space preserved in caption while typing
- Method: Behavioral check (UAT)
- Steps: Open editor, select a slide. Type "Hello " (with trailing space) in caption. Verify the space is visible/retained in the input.
- Run after: Phase 1

**AC-R4-2:** Trailing space preserved in notes while typing
- Method: Behavioral check (UAT)
- Steps: Type "Hello " in the notes field. Verify space retained.
- Run after: Phase 1

**AC-R4-3:** Trimmed on blur/save
- Method: Behavioral check (UAT)
- Steps: Type "  Hello  " in caption. Click outside the field. Verify value is "Hello" (trimmed).
- Run after: Phase 1

**AC-R4-4:** Whitespace-only resolves to null
- Method: Behavioral check (UAT)
- Steps: Type "   " in caption. Click outside. Verify caption shows placeholder (null state).
- Run after: Phase 1

---

## R5: Save as response template

**AC-R5-1:** Save as Template visible on MC with custom options
- Method: Code check + behavioral check
- Verify: Button rendered only when type=multiple_choice AND template_id is null AND options exist.
- Run after: Phase 1

**AC-R5-2:** Prompts for name
- Method: Behavioral check (UAT)
- Steps: Click "Save as Template". Verify inline name input appears.
- Run after: Phase 1

**AC-R5-3:** Saves via createTemplate API
- Method: Behavioral check + query check
- Steps: Enter name, click Save. Query `response_templates` table — verify new row with correct name and options.
- Run after: Phase 1

**AC-R5-4:** Question linked to new template
- Method: Behavioral check (UAT)
- Steps: After saving template, verify the question's template dropdown shows the new template selected. Verify options become read-only (template-linked display).
- Run after: Phase 1

**AC-R5-5:** Template appears in dropdown immediately
- Method: Behavioral check (UAT)
- Steps: After saving, check the template dropdown on another question in the same session. Verify new template is listed.
- Run after: Phase 1

**AC-R5-6:** Name collision shows error
- Method: Behavioral check (UAT)
- Steps: Save a template with a name that already exists. Verify error message appears in the inline UI.
- Run after: Phase 1

---

## R6: Theme system

**AC-R6-1:** Theme type supports system
- Method: Code check
- Verify: ThemePreference type includes 'dark' | 'light' | 'system' in ThemeContext.tsx
- Run after: Phase 3

**AC-R6-2:** Default is system
- Method: Code check + behavioral check
- Verify: getInitialPreference returns 'system' when no localStorage value. Clear localStorage, reload — theme matches OS setting.
- Run after: Phase 3

**AC-R6-3:** 3-way toggle persists
- Method: Behavioral check (UAT)
- Steps: Click toggle through dark → light → system. Verify icon changes (🌙→☀️→💻). Reload page — verify preference persisted.
- Run after: Phase 3

**AC-R6-4:** Toggle on Home, participant, presentation
- Method: Code check + behavioral check
- Verify: ThemeToggle rendered on Home.tsx, ParticipantSession.tsx, PresentationView.tsx (or admin controls for presentation).
- Run after: Phase 3

**AC-R6-5:** Participant views respect theme
- Method: Behavioral check (UAT)
- Steps: Set theme to light. Open participant session. Verify light background, dark text. Switch to dark — verify dark background, light text.
- Run after: Phase 3

**AC-R6-6:** Presentation view uses independent theme
- Method: Behavioral check (UAT)
- Steps: Set participant theme to light. Set presentation theme to dark via admin controls. Verify participant view is light, projection is dark.
- Run after: Phase 3

**AC-R6-7:** System theme updates live
- Method: Behavioral check (UAT)
- Steps: Set preference to system. Change OS dark/light mode. Verify app theme updates without page reload.
- Run after: Phase 3

---

## R7: Screen reader accessibility

**AC-R7-1:** radiogroup with aria-labelledby
- Method: Code check
- Verify: Vote button container has role="radiogroup" and aria-labelledby pointing to the question heading id.
- Run after: Phase 2

**AC-R7-2:** role="radio" + aria-checked
- Method: Code check
- Verify: Each vote button has role="radio" and aria-checked reflecting selection state.
- Run after: Phase 2

**AC-R7-3:** aria-live for submission
- Method: Code check
- Verify: An aria-live="polite" region exists that updates text on vote submission.
- Run after: Phase 2

**AC-R7-4:** aria-label on textarea
- Method: Code check
- Verify: Reason textarea has aria-label attribute.
- Run after: Phase 2

**AC-R7-5:** Visible focus indicators
- Method: Code check
- Verify: Vote buttons use focus-visible:ring-2 instead of focus:outline-none without visible alternative.
- Run after: Phase 2

**AC-R7-6:** Carousel announces position
- Method: Code check
- Verify: aria-live region with "Question N of M" text exists in BatchVotingCarousel.
- Run after: Phase 2

**AC-R7-7:** aria-labelledby links question to group
- Method: Code check (same as AC-R7-1)
- Run after: Phase 2

---

## R8: Slide notes bullet spacing

**AC-R8-1:** Bullet spacing visible
- Method: Behavioral check (UAT)
- Steps: Create a slide with bulleted notes. Verify visible gap between bullet marker and text in editor preview.
- Run after: Phase 2

**AC-R8-2:** Applies to editor and presenter panel
- Method: Behavioral check (UAT)
- Steps: Check both SlideNotesEditor and the presenter notes panel in admin controls. Both should show proper bullet spacing.
- Run after: Phase 2

**AC-R8-3:** Nested lists consistent
- Method: Behavioral check (UAT)
- Steps: Create nested bullet list in notes. Verify indentation and spacing are consistent across levels.
- Run after: Phase 2
