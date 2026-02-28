# Phase 2 — Notes Display + Accessibility

**Objective:** Fix slide notes bullet spacing and add screen reader support to participant voting.

---

## R8: Slide notes bullet spacing

### Files to modify
- `package.json`
- `src/index.css`

### Changes

**Install @tailwindcss/typography:**
```bash
npm install @tailwindcss/typography
```

**src/index.css** — Add the plugin import (Tailwind v4 style):
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

The existing `prose prose-sm` classes on `SlideNotesEditor.tsx` (line 137) and `PresentationControls.tsx` (line 433) will now apply proper typography styles including list bullet spacing, indentation, and nested list handling.

### Verification after install
- Check SlideNotesEditor: bullets should have spacing between marker and text
- Check presenter notes panel: same
- Check Tiptap editor area: editable area uses `prose prose-sm` — verify it still looks correct for editing (not just rendering)

### AC mapping
- AC-R8-1: ✓ Typography plugin provides proper `list-style` + `padding-left` on `<li>` within `prose`
- AC-R8-2: ✓ Both locations use `prose prose-sm` already
- AC-R8-3: ✓ Typography plugin handles nested lists by default

### Pitfalls addressed
- P2 (prose plugin side effects): Check Tiptap editor area after install. If editor styling changes undesirably, scope prose to render-only containers.

---

## R7: Screen reader accessibility

### Files to modify
- `src/components/VoteAgreeDisagree.tsx`
- `src/components/VoteMultipleChoice.tsx`
- `src/components/BatchVotingCarousel.tsx`

### Changes

**VoteAgreeDisagree.tsx:**

1. Add `id` to question heading:
```tsx
<h2 id={`question-${question.id}`} className="text-2xl font-bold text-white">
  {question.text}
</h2>
```

2. Wrap vote buttons in radiogroup:
```tsx
<div
  role="radiogroup"
  aria-labelledby={`question-${question.id}`}
  className="flex flex-col gap-3 px-4"
>
```

3. Add ARIA attrs to each vote button:
```tsx
<motion.button
  role="radio"
  aria-checked={pendingSelection === 'agree'}
  ...
>
```

4. Replace `focus:outline-none` with `focus-visible:ring-2 focus-visible:ring-indigo-500` on vote buttons.

5. Add aria-live region for submission confirmation:
```tsx
<div aria-live="polite" className="sr-only">
  {submitted ? 'Vote submitted' : ''}
</div>
```

6. Add `aria-label="Why? (optional)"` to reason textarea.

**VoteMultipleChoice.tsx:**

Same pattern as VoteAgreeDisagree:
- radiogroup wrapper with aria-labelledby
- role="radio" + aria-checked on each option button
- focus-visible ring
- aria-live region for submission
- aria-label on reason textarea

**BatchVotingCarousel.tsx:**

1. Add position announcement:
```tsx
<div aria-live="polite" className="sr-only">
  Question {currentIndex + 1} of {totalQuestions}
</div>
```

2. Add `aria-label` to navigation buttons:
```tsx
<button aria-label="Previous question" ...>
<button aria-label="Next question" ...>
```

3. Add `aria-label` to submit button with context.

### AC mapping
- AC-R7-1: ✓ radiogroup with aria-labelledby on both voting components
- AC-R7-2: ✓ role="radio" + aria-checked on all vote buttons
- AC-R7-3: ✓ aria-live="polite" region with submission status
- AC-R7-4: ✓ aria-label on reason textarea
- AC-R7-5: ✓ focus-visible:ring-2 replaces outline-none (keyboard-only visible)
- AC-R7-6: ✓ aria-live position announcement in carousel
- AC-R7-7: ✓ aria-labelledby links question text to radiogroup

### Pitfalls addressed
- P5 (ARIA on motion components): Framer Motion forwards unknown props. Verify in DevTools during UAT.

---

## Files to create
None.

## Files to delete
None.

## Database changes
None.
