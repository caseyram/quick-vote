# Pitfalls — QuickVote v1.5

## P1: Theme conversion scope creep
**Risk:** Medium
**Description:** Converting participant views from hardcoded dark classes to theme-aware requires touching many class strings across multiple components. Easy to miss spots, creating visual inconsistencies (dark text on dark background in one state).
**Mitigation:** Define CSS variables first, then do a systematic find-replace per component. Visual regression check after each component conversion.

## P2: Prose plugin side effects
**Risk:** Low-Medium
**Description:** Installing `@tailwindcss/typography` applies default prose styles that may affect other elements using the `prose` class. The Tiptap editor area uses `prose prose-sm` — the editor's editable area styling could change.
**Mitigation:** After installing, visually check the Tiptap editor in SlideNotesEditor and the presenter notes panel. If prose conflicts exist, scope with `prose` only on the render output, not the editor input.

## P3: useBlocker browser compatibility
**Risk:** Low
**Description:** React Router's `useBlocker` works for in-app navigation but doesn't cover all edge cases (e.g., programmatic navigation via `navigate()` within the app). The existing `beforeunload` covers browser-level exits.
**Mitigation:** Test both: clicking browser back, clicking in-app links, and the save-then-navigate flow.

## P4: Theme toggle placement on participant view
**Risk:** Low
**Description:** The participant voting screen is designed to be minimal and focused. Adding a theme toggle needs to be unobtrusive — can't compete with voting buttons for attention.
**Mitigation:** Small icon button in the top corner, similar to the connection pill placement.

## P5: ARIA changes and motion animations
**Risk:** Low
**Description:** Vote buttons use `<motion.button>` from Framer Motion. Adding `role="radio"` and `aria-checked` to motion components should work but needs verification that Framer Motion passes through ARIA attributes.
**Mitigation:** Verify in browser DevTools that ARIA attrs render on the DOM element. Framer Motion forwards unknown props to the underlying element, so this should work.

## P6: Stale highlighted reason in other scenarios
**Risk:** Low
**Description:** The R1 fix clears `highlightedReason` when switching question tabs. But there may be other scenarios where stale state causes similar issues (e.g., switching batches while a reason is highlighted).
**Mitigation:** Check if `batch_activated` handler already clears `highlightedReason` — it does (line ~242 in PresentationView.tsx sets it to null). The only gap was the tab-switch path.

## P7: Template overwrite race condition
**Risk:** Low
**Description:** Between checking "does this name exist" and performing the overwrite, another user could delete or rename the template. This is a personal tool with single-user admin, so the risk is negligible.
**Mitigation:** Accept the risk. If the overwrite fails, the error handler catches it.
