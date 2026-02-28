# Architecture — QuickVote v1.5 Bugfix & Polish

## Current State

### Tech Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (@tailwindcss/vite)
- React Router v7 (useBlocker available)
- Supabase (Realtime broadcast for live sync)
- Zustand stores (session, template-editor, template)
- Tiptap rich text editor (slide notes)
- Framer Motion (animations)

### No New Tables or API Routes
This milestone is entirely frontend. No database schema changes, no new API endpoints.

---

## Changes by Requirement

### R1: Presenter tab switching (Bug fix)

**What changes:**
- `src/components/PresentationControls.tsx` — `handleSelectQuestion` must also broadcast `reason_highlight` with null payload to clear highlighted reason

**What stays the same:**
- `BatchResultsProjection.tsx` logic is correct — it just needs the stale `highlightedReason` cleared
- Broadcast channel setup, presenter subscription — all unchanged

**Risk:** Low. One additional broadcast call.

---

### R2: Template save overwrite (Bug fix)

**What changes:**
- `src/lib/session-template-api.ts` — add `findSessionTemplateByName(name)` query
- `src/components/editor/EditorToolbar.tsx` — `handleSave` flow:
  1. If no templateId and name exists in DB → show ConfirmDialog
  2. On confirm → call `overwriteSessionTemplate` with existing ID
  3. On cancel → return to editor
  4. Update store `templateId` after overwrite

**What stays the same:**
- `overwriteSessionTemplate` already exists and works
- ConfirmDialog component already exists
- Template unique constraint stays

**Risk:** Low. The overwrite API already exists.

---

### R3: Unsaved changes warning (Bug fix)

**What changes:**
- `src/pages/TemplateEditorPage.tsx` — add `useBlocker` from react-router when `isDirty`
- Add a ConfirmDialog (or browser-native confirm) for the blocked navigation

**What stays the same:**
- `isDirty` flag in template-editor-store — already correct
- `beforeunload` handler — stays for browser close/refresh
- `markClean()` on save — already clears dirty flag

**Risk:** Low. `useBlocker` is stable in React Router v7.

---

### R4: Caption/notes trimming (Bug fix)

**What changes:**
- `src/components/editor/SlideEditor.tsx` — remove `.trim()` from `handleCaptionChange` and `handleNotesChange` onChange handlers
- Add onBlur handler (or trim in the store's save path) that trims and nullifies empty values

**What stays the same:**
- Input elements, store update pattern

**Risk:** Low. Need to ensure null handling still works for empty captions on save.

---

### R5: Save as response template (Feature)

**What changes:**
- `src/components/editor/QuestionRow.tsx` — add "Save as Template" button below custom options
  - Only visible when: type=multiple_choice, no template_id, has options
  - On click: show inline name input or small modal
  - On confirm: call `createTemplate(name, options)` from existing `template-api.ts`
  - On success: update question's `template_id` to new template, store refreshes

**What stays the same:**
- `createTemplate()` API — already works
- `useTemplateStore` — already reactive
- Template dropdown — already reads from store

**Risk:** Low. Reuses existing API entirely.

---

### R6: Theme system (Enhancement)

**What changes:**

1. `src/context/ThemeContext.tsx`:
   - Add `'system'` to Theme type
   - Add `resolvedTheme` (actual dark/light after resolving system preference)
   - Default to `'system'` instead of `'dark'`
   - Add `matchMedia('(prefers-color-scheme: dark)')` listener for live OS changes
   - Set `data-theme` attribute to resolved value

2. `src/index.css`:
   - Add CSS custom properties scoped to `[data-theme="dark"]` and `[data-theme="light"]`
   - Define semantic tokens: `--bg-primary`, `--bg-surface`, `--text-primary`, `--text-secondary`, etc.

3. `src/components/ThemeToggle.tsx`:
   - Support 3-way toggle: dark → light → system → dark
   - Show current mode with icon (moon/sun/auto)

4. Participant views (`ParticipantSession.tsx`, `VoteAgreeDisagree.tsx`, `VoteMultipleChoice.tsx`, `BatchVotingCarousel.tsx`):
   - Replace hardcoded `bg-gray-950`, `text-white`, `bg-gray-800` etc. with theme-aware classes or CSS variables
   - Add ThemeToggle component (small, non-intrusive placement)

5. `src/pages/PresentationView.tsx`:
   - Replace hardcoded `backgroundColor = '#1a1a2e'` with theme-resolved value
   - Update `textColorClass` derivation

6. `src/components/BatchResultsProjection.tsx`:
   - Accept theme from context instead of hardcoded `backgroundColor` prop

**Risk:** Medium. Largest change in this milestone. Many files touched. Incremental approach: define CSS variables first, then convert components one at a time.

**Migration strategy:**
- Phase 1: Add system preference detection, CSS variables, 3-way toggle
- Phase 2: Convert participant views to use CSS variables
- Phase 3: Convert presentation view

---

### R7: Screen reader accessibility (Enhancement)

**What changes:**

1. `src/components/VoteAgreeDisagree.tsx`:
   - Wrap buttons in `<div role="radiogroup" aria-labelledby="question-heading">`
   - Add `role="radio"` and `aria-checked={selected === value}` to each button
   - Add `id="question-heading"` to the h2

2. `src/components/VoteMultipleChoice.tsx`:
   - Same radiogroup/radio pattern

3. Both voting components:
   - Add `aria-live="polite"` region for submission confirmation
   - Add `aria-label` to reason textarea
   - Replace `focus:outline-none` with visible focus ring (`focus-visible:ring-2`)

4. `src/components/BatchVotingCarousel.tsx`:
   - Add `aria-label` with position ("Question 2 of 5")
   - Add `aria-live="polite"` for question transitions

**Risk:** Low. Additive changes only — no behavioral change for sighted users.

---

### R8: Slide notes bullet spacing (Enhancement)

**What changes:**

**Option A:** Install `@tailwindcss/typography` so `prose` classes work properly. This gives correct list styling out of the box.

**Option B:** Add custom CSS for list styling in notes containers without the plugin.

**Recommendation:** Option A. The `prose` class is already used in two places but does nothing because the plugin isn't installed. Installing it fixes bullet spacing and gives proper typography for all rich text content.

**Files:**
- `package.json` — add `@tailwindcss/typography`
- `src/index.css` — import the plugin (Tailwind v4 style)
- Verify existing `prose prose-sm` classes render correctly

**Risk:** Low. But need to check that prose styles don't conflict with existing custom styling elsewhere.

---

## Phasing Recommendation

**Phase 1 — Bug fixes (R1, R2, R3, R4, R5):** All low-risk, isolated changes. Can be done in one build run.

**Phase 2 — Notes display + accessibility (R7, R8):** Additive, no overlap with theme work. R8 may be as simple as installing the typography plugin.

**Phase 3 — Theme system (R6):** Largest change, touches the most files. Benefits from bugs being fixed first so testing is clean.

---

## Files Modified (complete list)

| File | Requirements |
|------|-------------|
| `src/components/PresentationControls.tsx` | R1 |
| `src/lib/session-template-api.ts` | R2 |
| `src/components/editor/EditorToolbar.tsx` | R2 |
| `src/pages/TemplateEditorPage.tsx` | R3 |
| `src/components/editor/SlideEditor.tsx` | R4 |
| `src/components/editor/QuestionRow.tsx` | R5 |
| `src/context/ThemeContext.tsx` | R6 |
| `src/components/ThemeToggle.tsx` | R6 |
| `src/index.css` | R6, R8 |
| `src/pages/ParticipantSession.tsx` | R6 |
| `src/pages/PresentationView.tsx` | R6 |
| `src/components/VoteAgreeDisagree.tsx` | R6, R7 |
| `src/components/VoteMultipleChoice.tsx` | R6, R7 |
| `src/components/BatchVotingCarousel.tsx` | R6, R7 |
| `src/components/BatchResultsProjection.tsx` | R6 |
| `src/components/SlideNotesEditor.tsx` | R8 |
| `package.json` | R8 |
