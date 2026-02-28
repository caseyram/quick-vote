# Adversarial Review — QuickVote v1.5

Assuming this plan was executed exactly as written and it failed. Working backward.

---

## Failure Scenarios

### F1: CSS variable approach creates Tailwind class conflicts
**Likelihood:** Medium
**Impact:** Medium — visual inconsistencies, some elements wrong color

When replacing `bg-gray-950` with `bg-[var(--bg-primary)]`, Tailwind generates the class at build time. However, if any component also has responsive variants or state variants (e.g., `hover:bg-gray-800`), those hardcoded hover states won't match the theme. The plan specifies replacing the base colors but doesn't explicitly list every hover/active/disabled state variant.

**Mitigation:** During implementation, grep for ALL gray-shade classes in each converted file (not just the ones listed). Include hover:, focus:, disabled:, and active: variants in the conversion. Add this as an implementation note in the Phase 3 plan.

**Status:** Needs addition to plan.

---

### F2: Tiptap editor styling breaks when typography plugin is installed
**Likelihood:** Low-Medium
**Impact:** Low — editor looks different but functions correctly

The Tiptap editor in SlideNotesEditor uses `prose prose-sm` on the editable area. Installing @tailwindcss/typography will apply default styles to all elements inside prose containers — including paragraph spacing, heading sizes, and link colors. The editor might look different than before (e.g., more spacing between paragraphs).

**Mitigation:** Already noted in PITFALLS.md (P2). Check editor visually after install. If needed, use `prose` only on the read-only render in PresentationControls and add a separate class for the editor.

**Status:** Mitigated by P2.

---

### F3: PresentationThemeContext broadcast creates circular updates
**Likelihood:** Low
**Impact:** Low — theme flickers

The plan says the admin broadcasts `presentation_theme_changed` when toggling. If the presentation view receives this and also sets its local state, and that somehow triggers a re-broadcast, you get a loop.

**Mitigation:** The presentation view should only RECEIVE the broadcast, never send it. The admin is the only sender. One-way broadcast pattern. Make this explicit in implementation.

**Status:** Needs explicit note in Phase 3 plan.

---

### F4: useBlocker doesn't fire on programmatic navigate()
**Likelihood:** Low
**Impact:** Low — data loss in edge case

React Router's useBlocker may not intercept all programmatic navigation (e.g., `navigate('/somewhere')` called from a button handler). The main risk: the "Start Session" button in EditorToolbar calls `navigate` to go to the session page.

**Mitigation:** Check if "Start Session" triggers the blocker. If not, add a manual isDirty check before programmatic navigation in that handler. The existing `handleStartSession` should already save before navigating, which clears isDirty.

**Status:** Low risk, verify during implementation.

---

### F5: Theme toggle on participant view distracts from voting
**Likelihood:** Low
**Impact:** Low — UX annoyance

A visible toggle on the voting screen might get tapped accidentally or distract from the voting task.

**Mitigation:** Already addressed by P4 — small button in top corner, same visual weight as the connection status pill. Use a subtle opacity/size that doesn't compete with vote buttons.

**Status:** Mitigated by P4.

---

### F6: CSS variables not supported in all Tailwind contexts
**Likelihood:** Low
**Impact:** Medium — broken styles

Tailwind's `bg-[var(--bg-primary)]` arbitrary value syntax works in Tailwind v4, but some edge cases exist with opacity modifiers. For example, `bg-gray-950/50` (50% opacity) can't be directly replicated with `bg-[var(--bg-primary)]/50` because CSS variables in color functions require specific formats.

**Mitigation:** Audit the converted files for any opacity modifiers on the replaced classes. If found, define the CSS variables as RGB or HSL values and use `rgba(var(--bg-primary-rgb), 0.5)` format instead. Or use separate variables for opacity variants.

**Status:** Needs audit during implementation.

---

### F7: Presentation theme localStorage conflicts with participant theme
**Likelihood:** Low
**Impact:** Low — wrong theme on load

Both themes use localStorage. If the keys are too similar or if code accidentally reads the wrong key, themes could cross-contaminate.

**Mitigation:** Keys are distinct: `quickvote-theme` for participant, `quickvote-presentation-theme` for presentation. Separate contexts enforce separation. Low risk.

**Status:** Mitigated by design.

---

### F8: System theme detection fails on older browsers
**Likelihood:** Low
**Impact:** Low — falls back to dark

`window.matchMedia('(prefers-color-scheme: dark)')` is supported in all modern browsers (96%+ global support). If it fails, the code should default to dark.

**Mitigation:** The `getInitialPreference` function defaults to 'system', and the matchMedia state defaults to 'dark' if the query fails. Graceful degradation.

**Status:** Mitigated by design.

---

## Summary

| Scenario | Likelihood | Impact | Status |
|----------|-----------|--------|--------|
| F1: CSS var + hover/state conflicts | Medium | Medium | **Needs plan addition** |
| F2: Tiptap prose side effects | Low-Medium | Low | Mitigated (P2) |
| F3: Broadcast loop | Low | Low | **Needs plan note** |
| F4: useBlocker programmatic nav | Low | Low | Verify during implementation |
| F5: Toggle distraction | Low | Low | Mitigated (P4) |
| F6: CSS var opacity modifiers | Low | Medium | **Needs audit during implementation** |
| F7: localStorage key conflict | Low | Low | Mitigated by design |
| F8: matchMedia browser support | Low | Low | Mitigated by design |

**Blocking items:** None. F1, F3, and F6 need implementation-time attention but don't block the plan.

**Additions needed:**
1. Phase 3 plan: note to grep for ALL Tailwind state variants (hover/active/disabled/focus) when converting, not just base classes
2. Phase 3 plan: note that presentation theme broadcast is one-way (admin → projection only)
3. Phase 3 plan: note to audit opacity modifiers on converted classes
