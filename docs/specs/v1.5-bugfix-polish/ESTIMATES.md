# Estimates — QuickVote v1.5

## Phase 1 — Bug Fixes (R1-R5)
- **Build runs:** 1
- **Risk:** Low
- **Dependencies:** None
- **Casey review time:** 15 min (quick UAT of each fix)
- **Notes:** All 5 fixes are isolated. R1 is a one-liner. R2-R5 are small component changes. Should complete in a single Kit run.

## Phase 2 — Notes Display + Accessibility (R7, R8)
- **Build runs:** 1
- **Risk:** Low
- **Dependencies:** None (independent of Phase 1)
- **Casey review time:** 15 min (visual check of bullets, screen reader spot-check)
- **Notes:** R8 might be as simple as installing the typography plugin. R7 is additive ARIA attributes. Could run in parallel with Phase 1 but sequential is fine.

## Phase 3 — Theme System (R6)
- **Build runs:** 2
- **Risk:** Medium (most files touched, visual conversion across many components)
- **Dependencies:** Should run after Phase 2 (accessibility focus styles need to work with both themes)
- **Casey review time:** 20-30 min (visual check of all participant states in both themes, presentation theme independence)
- **Notes:** Run 1: CSS vars + context + toggle + Home page conversion. Run 2: participant views + presentation view conversion. Split reduces risk of a single massive change.

## Total
- **Build runs:** 4 (can likely compress to 3)
- **Wall clock:** One evening session (phases 1+2 back-to-back, phase 3 after review)
- **Casey review time:** ~1 hour total across all phases
- **Estimated tokens:** ~50-80k per Kit run, ~200-300k total
