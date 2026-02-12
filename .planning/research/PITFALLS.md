# Pitfalls Research

**Domain:** Template authoring workflow, team-based voting, presentation polish (subsequent milestone features)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Template Preview Diverges from Live Behavior

**What goes wrong:**
Templates saved in the editor render differently when activated in a live session. Vote components behave inconsistently, slides display incorrectly, or timers fail to start. Users lose trust in the template system because "what you see is not what you get."

**Why it happens:**
Preview and production components don't share the same rendering path. Preview components mock runtime state (activeQuestion, realtime channel, participant presence) instead of using the actual production components in a read-only mode. Differences in props, context providers, or feature flags cause divergence over time.

**How to avoid:**
- **Share components, not duplicate them.** Render `VoteAgreeDisagree`, `VoteMultipleChoice`, `SlideDisplay` in both preview and live modes with a `previewMode` prop that disables submission/interaction.
- **Preview must use the same Zustand store structure.** Don't mock state with local useState - use a separate preview store instance with the same selectors.
- **Visual regression testing.** Screenshot tests comparing template preview renders to live session renders for the same template data.
- **Regular cross-checks.** Every release, load a template in preview, activate it live, and verify visual parity.

**Warning signs:**
- Developers say "preview is broken again" after unrelated feature changes.
- User reports: "timer showed 30s in template but didn't start in session."
- CSS classes differ between preview and live DOM inspection.
- Preview rendering requires separate component files (`PreviewVote.tsx` vs `VoteAgreeDisagree.tsx`).

**Phase to address:**
Phase 22 (Template Preview) - Establish shared component architecture from day one. Phase 23 (Template Editor UI) - Validate preview parity before shipping editor.

---

### Pitfall 2: Session Template Migration Timing Failure

**What goes wrong:**
User loads the template editor UI, but the `session_templates` table doesn't exist yet. Application crashes with "relation 'session_templates' does not exist" errors. PostgREST returns 404 for template RPC calls until schema cache refreshes (known issue already documented).

**Why it happens:**
Migration `20250211_050_session_templates.sql` exists but must be applied manually. Developers test locally with migrated database but production/staging environments lack the table. PostgREST caches schema metadata for 10-60 seconds, causing RPC 404s even after migration runs.

**How to avoid:**
- **Fail gracefully on missing table.** Wrap all `session_templates` queries in try-catch. If error code is `42P01` (undefined table), show user-friendly message: "Template feature requires database migration."
- **Schema validation on app load.** Query `information_schema.tables` for `session_templates` existence. If missing, disable template UI and log warning.
- **PostgREST cache workaround.** After migration, call `/rpc/claim_session` (or any RPC) with retry logic. Wait for non-404 response before enabling template features.
- **Migration checklist in deployment docs.** Explicit step: "Run migration 050 before deploying template features."

**Warning signs:**
- Console errors: `relation "session_templates" does not exist`.
- PostgREST 404 on `/rest/v1/rpc/save_template` immediately after migration.
- Template panel shows spinner indefinitely or crashes app.
- Works in dev, fails in production (migration state mismatch).

**Phase to address:**
Phase 20 (Session Templates) - Add error handling and schema validation. Phase 21 (Template UI Integration) - Verify migration prerequisite in deployment checklist.

---

### Pitfall 3: Team Assignment Data Model Error

**What goes wrong:**
Team assignments are stored with question_id foreign key, but questions can be deleted or moved between batches. Team assignments become orphaned, causing vote aggregation to fail. Results show "Team A: 0 votes" when members did vote, because votes aren't linked to team assignments anymore.

**Why it happens:**
Premature normalization. Storing team assignments as separate rows (`team_assignments` table with `question_id`, `team_name`, `participant_ids[]`) creates foreign key dependencies that break when questions are edited. QuickVote's existing architecture doesn't have question deletion (questions persist even when sessions end), but template editing introduces question deletion/reordering.

**How to avoid:**
- **Denormalize team assignment into session-level metadata.** Store team roster in `sessions` table JSONB column: `{ "teams": [{"name": "Red", "members": ["user1", "user2"]}] }`.
- **Don't FK team assignments to questions.** Questions reference team mode (`team_voting_enabled: boolean`), but team-to-participant mapping is session-wide.
- **Vote table already has participant_id.** Join votes to session team roster at query time, not via static assignment rows.
- **Schema design review.** Before adding `team_assignments` table, validate it against template edit workflows (question deletion, batch reordering, session cloning).

**Warning signs:**
- Orphaned assignment rows in database after question deletion.
- Vote aggregation queries have complex LEFT JOINs to reconstruct team membership.
- "Team not found" errors when loading results for questions that were edited.
- Team member list differs between template preview and activated session.

**Phase to address:**
Phase 24 (Team Data Model) - Design team storage as session-level JSONB, not question-level FK. Phase 25 (Team Voting Results) - Validate aggregation queries handle session cloning and question edits.

---

### Pitfall 4: Result Aggregation Performance Collapse Under Team Voting

**What goes wrong:**
When team voting is enabled with 10 teams and 50 questions, the results page takes 30+ seconds to load or times out. Database query executes thousands of row scans. Admin abandons the feature because it's unusable at scale.

**Why it happens:**
Naive aggregation: `GROUP BY team_name, question_id` without indexes. QuickVote's existing client-side aggregation (Phase 4 research) works for 100 users, but team-based aggregation introduces cross-product explosion. 10 teams × 50 questions × 100 participants = 50,000 vote rows to scan per aggregation.

**How to avoid:**
- **Materialized aggregation table.** Create `team_vote_aggregates` with triggers that update on vote INSERT/UPDATE. Trade write latency for read speed.
- **Composite index on (session_id, question_id, participant_id).** Covering index for team aggregation queries.
- **Server-side aggregation RPC.** Move aggregation from client JavaScript to PostgreSQL RPC function. Use window functions to aggregate votes by team in single query.
- **Lazy load results per question.** Don't compute aggregates for all 50 questions upfront - fetch only the active question's team results.
- **Load testing before shipping.** Benchmark with 100 users, 10 teams, 50 questions. If query time >2s, optimize before Phase ships.

**Warning signs:**
- `EXPLAIN ANALYZE` shows Seq Scan on votes table for team aggregation.
- Results API response time >5 seconds in production logs.
- Database CPU spikes to 100% when admin opens results page.
- Query timeout errors on sessions with >20 questions or >5 teams.

**Phase to address:**
Phase 25 (Team Voting Results) - Implement server-side aggregation RPC and composite indexes. Phase 26 (Team Results Polish) - Load test and optimize based on realistic data volumes.

---

### Pitfall 5: QR Code Regeneration Breaks Active Sessions

**What goes wrong:**
Admin regenerates session QR code to invalidate old join links, but active participants are disconnected. They lose their vote history and see "Session not found" errors. Session becomes unusable mid-presentation.

**Why it happens:**
Session ID is embedded in QR code URL (`/session/{sessionId}`), and "regenerate QR" changes the session ID to a new UUID. Existing participants' browser URLs now point to old ID. Supabase Realtime channel subscription is tied to old session ID, so Broadcast events don't reach them.

**How to avoid:**
- **QR code is generated, not regenerated.** Session ID is immutable. QR codes can be disabled/paused (session status = 'paused'), but never changed.
- **Access tokens instead of session ID rotation.** If invalidation is needed, use short-lived access tokens in QR code URL parameter (`/session/{sessionId}?token={jwt}`). Rotate token, not session ID.
- **Warning on QR regeneration.** If regeneration is implemented, show modal: "Regenerating will disconnect all active participants. Continue?"
- **Graceful session migration.** If session ID must change, Broadcast a `session_migrated` event with new ID. Clients auto-redirect to new URL before disconnect.

**Warning signs:**
- User reports: "Everyone got kicked out when I refreshed the QR code."
- Participants see "reconnecting..." banner permanently after QR regeneration.
- Session store has orphaned participant presence records for old session ID.
- Vote counts drop to zero after QR code is "refreshed."

**Phase to address:**
Phase 27 (QR Code Management) - Document that session IDs are immutable. If rotation is required, implement session migration broadcast protocol.

---

### Pitfall 6: Inline Editing Loses Scroll Position

**What goes wrong:**
User edits question text in the sequence list, types a few characters, and the entire list scrolls back to top. Cursor jumps to different input. Edits are lost or applied to wrong question. Feature is unusable for sessions with >10 questions.

**Why it happens:**
Component re-renders on every keystroke (controlled input), triggering React's reconciliation. If list items don't have stable `key` props, React unmounts/remounts DOM nodes, resetting scroll. Alternatively, focus management calls `scrollIntoView` on the active input, fighting with user's manual scroll.

**How to avoid:**
- **Stable keys on list items.** Use `question.id` or `sessionItem.id` as key, never array index.
- **Debounced state updates.** Local state for input value, debounced sync to Zustand store (300ms). This limits re-renders to every 300ms instead of every keystroke.
- **Controlled scroll container ref.** Store `scrollTop` in ref before render, restore after render if editing state changes.
- **Focus trap during edit.** Don't call `scrollIntoView` or `focus()` unless user explicitly clicked the edit button.
- **Virtual list for >50 items.** Use `react-window` or `@tanstack/react-virtual` if sequence can exceed 50 items.

**Warning signs:**
- User types in question input, list scrolls unexpectedly.
- Cursor jumps to different question's input mid-edit.
- React DevTools shows excessive renders (>10/sec) on SequenceManager during typing.
- Console warnings about non-unique keys in list.

**Phase to address:**
Phase 17 (Unified Sequence) or Phase 23 (Template Editor) - Implement stable keys and debounced editing state. Phase 28 (Inline Edit Polish) - Add scroll position preservation.

---

### Pitfall 7: Multi-Select Drag-and-Drop State Desync

**What goes wrong:**
User selects 3 questions, drags one, but all 3 disappear from the list. On drop, only 1 question moves, other 2 are lost. Or all 3 move but appear in wrong order. State becomes corrupted, requiring page refresh.

**Why it happens:**
dnd-kit doesn't natively support multi-select (confirmed by GitHub discussions). Custom implementation stores selected IDs in state, but `onDragEnd` handler receives only the dragged item's ID (not the full selection). Developers try to patch this by moving all selected items in `onDragEnd`, but the optimistic UI update (removing items during drag) conflicts with the re-fetch after drop. Race condition between local state and database state.

**How to avoid:**
- **Don't implement multi-select in v1.** Ship single-item drag-and-drop first. Validate user demand before building complex multi-select.
- **If multi-select is required, use visual-only selection.** Shift+click to highlight items, then drag ONE item to move ALL highlighted items. Store `selectedIds[]` in Zustand, pass to `onDragEnd`.
- **Batch database updates transactionally.** Use Supabase RPC function to update sequence_number for all selected items in single transaction.
- **Optimistic update only after DB success.** Don't remove items from UI during drag - wait for drop and DB confirmation before updating local state.
- **Comprehensive testing.** Test drag-drop with 1, 2, 5, 10 selected items. Verify order preservation and no data loss.

**Warning signs:**
- GitHub issue search: "dnd-kit multi-select" returns no official examples.
- Selected items don't move together during drag.
- Database shows sequence_number gaps or duplicates after multi-select drop.
- User reports: "I selected 5 questions but only 1 moved."

**Phase to address:**
Phase 29 (Multi-Select DnD) - Defer to Phase 30+ if not critical for MVP. If shipped, implement as visual selection with single-drag-moves-all pattern.

---

### Pitfall 8: Background Color Contrast Failures

**What goes wrong:**
User sets slide background to `#FFD700` (gold), admin adds black text, projects to screen. Text is invisible. Accessibility audit fails WCAG 2.1 AA contrast requirements. Users with low vision cannot read content.

**Why it happens:**
Color picker allows any hex value without validation. No runtime contrast checking against text color. Admin previews on high-contrast monitor, doesn't notice issue until projecting to low-quality screen in conference room.

**How to avoid:**
- **WCAG contrast validation on save.** Calculate contrast ratio between background and text colors. Require 4.5:1 for normal text, 3:1 for large text (WCAG AA standard).
- **Live contrast ratio display.** Show "Contrast: 6.2:1 ✓" below color picker. Update in real-time as user adjusts colors.
- **Preset palette of accessible combinations.** Offer 10 pre-validated background/text pairs (e.g., white/black, navy/white, dark-gray/yellow).
- **Warning, not blocking.** Allow admin to override ("I know this is low contrast but I need brand colors"), but show warning badge.
- **Preview on multiple backgrounds.** Template preview should show slide on both white and dark backgrounds to catch edge cases.

**Warning signs:**
- Color picker allows selection without contrast feedback.
- No warning when user sets yellow background + white text.
- Accessibility audit report flags contrast violations.
- Participant feedback: "Couldn't read the text on slide 3."

**Phase to address:**
Phase 30 (Background Color Feature) - Implement WCAG contrast validation before shipping color picker. Phase 31 (Accessibility Polish) - Add preset palette and live ratio display.

---

### Pitfall 9: Batch Timer in Template Overrides Runtime Timer

**What goes wrong:**
Admin saves template with batch timer set to 30 seconds. During live session, admin wants to extend timer to 60 seconds for this run only. Changes timer in UI, but template's 30s value overrides it. Participants still see 30s countdown. Admin frustrated by lack of control.

**Why it happens:**
Template data has `timerSeconds: 30` in blueprint JSONB. On batch activation, code reads `timerSeconds` from template instead of from current session state. Template becomes the source of truth, shadowing runtime overrides.

**How to avoid:**
- **Template provides defaults, session provides overrides.** On template load, copy `timerSeconds` to session state. All runtime code reads from session state, never from template blueprint.
- **Clear separation: `templateTimerSeconds` vs `runtimeTimerSeconds`.** Store both in session store. UI shows runtime value, template panel shows template default.
- **"Revert to template default" button.** Allow admin to reset runtime timer to template value if they want, but make it explicit action.
- **Template as initialization only.** Template data populates session on creation, then template is read-only reference. Session state is mutable and authoritative during runtime.

**Warning signs:**
- Timer shows template value even after admin changes it in session controls.
- Session state has `timerSeconds: 60` but Broadcast sends `timerSeconds: 30` (from template).
- User reports: "I changed the timer but it didn't work."
- Code reads `template.blueprint.batches[0].timerSeconds` during session runtime.

**Phase to address:**
Phase 20 (Session Templates) - Document that templates initialize session state but don't override runtime. Phase 32 (Template Runtime Separation) - Refactor to ensure session state is authoritative.

---

### Pitfall 10: Image Preloading Causes Layout Shift

**What goes wrong:**
Admin advances to next slide, participant sees text appear instantly, then 2 seconds later image pops in, pushing text down 300px. CLS (Cumulative Layout Shift) score fails Core Web Vitals. Presentation looks janky.

**Why it happens:**
Slide images aren't preloaded. When `SlideDisplay` renders, `<img src={slideUrl}>` starts fetching. Browser doesn't know image dimensions until download completes, so it reserves 0px height initially. Image load triggers reflow.

**How to avoid:**
- **Reserve aspect ratio space.** Store image dimensions in `session_items.slide` JSONB (`width`, `height`). Render container with `aspect-ratio: {width}/{height}` CSS before image loads.
- **Preload next slide image.** When admin is on slide N, prefetch slide N+1 image: `<link rel="prefetch" as="image" href={nextSlideUrl}>`.
- **Optimize images at upload.** browser-image-compression already in use (Phase 16). Ensure max dimensions (1920x1080) and WebP format.
- **Suspense boundary with skeleton.** Wrap `<img>` in Suspense, show skeleton with correct aspect ratio while loading.
- **Test on slow connection.** Throttle network to "Slow 3G" in Chrome DevTools. Verify no layout shift when advancing slides.

**Warning signs:**
- Lighthouse reports CLS >0.1.
- Visual jump when slide image loads.
- Image dimensions not stored in database (only URL).
- No `width`/`height` attributes on `<img>` tags in SlideDisplay.

**Phase to address:**
Phase 16 (Image Slides) - Store dimensions in JSONB during upload. Phase 18 (Presentation Controller) - Implement preload and aspect ratio reservation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate preview components instead of sharing | Faster to build preview without props complexity | Every feature change requires updating 2+ components; divergence bugs | Never - pay the upfront cost of shared components |
| Client-side team aggregation in JavaScript | No database schema changes | Unusable performance with >5 teams or >20 questions; blocks scaling | Only for prototype/demo; refactor before v1 |
| Skip WCAG contrast validation | Ship color picker faster | Accessibility violations, legal risk (ADA compliance), user complaints | Never - contrast validation is 20 lines of code |
| Template blueprint stored as unstructured JSONB | Schema flexibility, no migrations | No foreign key constraints, orphaned data, hard to query | Acceptable if Zod validation enforced at application layer |
| Inline editing without debounce | Immediate visual feedback | Excessive re-renders (>10/sec), poor performance, scroll bugs | Never - debounce is 5 lines, solves multiple issues |
| Hard-code team names instead of user-defined | No UI for team management | Users can't customize teams for their use case; feature feels incomplete | Only in Phase 1 spike; must allow custom teams in v1 |
| Store selected items in drag-drop component state | Self-contained component | Selection state lost on unmount; can't share selection across components | Never - use Zustand for any state that affects multiple components |

---

## Integration Gotchas

Common mistakes when integrating template features with existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgREST schema cache | Assume RPC available immediately after migration | Wrap RPC calls in try-catch, retry on 404, validate schema before enabling features |
| Realtime Broadcast + Templates | Send full template blueprint in Broadcast payload | Send template ID only, fetch blueprint from database (Broadcast has 256KB payload limit) |
| Supabase Storage + Templates | Store absolute Storage URLs in blueprint | Store relative paths (`session_id/slide_id.webp`), construct full URL at display time |
| Motion animations + Template preview | Animate preview renders on load | Disable Motion animations in preview (`animate={false}` prop) to avoid distracting motion |
| dnd-kit + Zustand | Read drag state from Zustand in onDragEnd | Store dragged item ID in dnd-kit's active state, only update Zustand on drop success |
| Zod validation + Template import | Trust imported JSON structure | Validate with `.passthrough()` for forward compatibility; handle missing fields gracefully |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Client-side team vote aggregation | Results page slow to load | Server-side PostgreSQL RPC with window functions | >5 teams or >20 questions |
| No index on team assignment lookups | Database CPU spikes when loading results | Composite index on (session_id, participant_id, question_id) | >100 participants with teams |
| Inline editing re-renders entire sequence | UI freezes during typing | Debounced state updates (300ms), React.memo on list items | >20 items in sequence |
| Preload all slide images on session start | Slow initial load, wasted bandwidth | Lazy preload (N+1 only), browser-image-compression to <1MB each | >10 slides per session |
| Real-time vote updates without throttling | React re-renders 50+ times/sec during voting | Zustand subscribeWithSelector, batch updates every 200ms | >50 concurrent voters |
| Deep JSONB queries on every render | High database latency for template loads | Cache blueprint in Zustand, invalidate on template update | >50 templates or >100 items/template |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Store participant team assignments in localStorage | User can edit localStorage, join any team, skew results | Store team roster in Supabase sessions table with RLS; participant_id mapped server-side |
| Allow template import without validation | Malicious JSON could inject scripts or break app | Zod schema validation with `.strict()`, sanitize all text fields before rendering |
| Session ID in QR code is predictable (sequential) | Attacker can enumerate active sessions, join without permission | Use UUIDs (already implemented in QuickVote) |
| No rate limiting on template save | User can spam template creation, fill database | Supabase RLS + rate limiting RPC; limit 10 templates/min per user |
| Template blueprint includes sensitive data | PII leakage if templates are shared | Never store participant names/emails in templates; store question/batch structure only |

---

## UX Pitfalls

Common user experience mistakes when adding these features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback on template save | User clicks Save, nothing happens, clicks 5 more times, creates duplicates | Show spinner, disable button, toast notification "Template saved!" |
| Template editor doesn't show item count | User doesn't know if template is empty or failed to load | Display "12 items" in template card, "Empty template" if 0 items |
| Inline edit loses focus on auto-save | User types, input blurs mid-sentence, must re-click | Debounce save, preserve focus, only blur on explicit "done" action |
| No undo for sequence reorder | User drags question to wrong position, can't revert | Add "Undo" toast after drag-drop, store previous sequence in memory for 10s |
| QR code too small on mobile | Admin can't scan QR from their own phone to test | Responsive QR size: 256px on desktop, 192px on mobile, fullscreen modal option |
| Team assignment UI doesn't show current assignments | Admin forgets which participants are in which team | Show team roster with participant names, color-code teams in results |
| Contrast warning blocks color picker | User can't override warning, stuck with default colors | Show warning + "Use anyway" button; log override for accessibility audit trail |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Template Preview:** Preview components share code with live components - verify both render identically for same data
- [ ] **Team Voting Results:** Aggregation queries have composite indexes - run EXPLAIN ANALYZE on 100-user dataset
- [ ] **QR Code Management:** Session IDs are immutable or migration broadcast is implemented - verify active participants aren't disconnected
- [ ] **Inline Editing:** Scroll position preserved during edit - test with >20 items, type in item #15
- [ ] **Multi-Select Drag-Drop:** All selected items move together - test with 5 items selected, verify order and no data loss
- [ ] **Background Color Picker:** WCAG contrast validation implemented - verify 4.5:1 ratio enforced for normal text
- [ ] **Batch Timer:** Runtime timer overrides template default - verify admin can change timer during live session
- [ ] **Image Slides:** Dimensions stored in JSONB, aspect ratio reserved - verify no layout shift on slow network
- [ ] **Template Import:** Zod validation with `.passthrough()` - test import of template from future version (unknown fields)
- [ ] **PostgREST Schema Cache:** RPC calls wrapped in try-catch with retry - verify template panel doesn't crash on 404

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Preview divergence shipped to production | HIGH | 1. Screenshot regression suite to detect future divergence 2. Refactor to shared components (2-3 days) 3. Add integration tests |
| Team aggregation performance collapse | MEDIUM | 1. Add composite index (immediate) 2. Implement server-side RPC (1 day) 3. Materialize aggregates if still slow (2 days) |
| QR regeneration disconnects participants | MEDIUM | 1. Add migration broadcast protocol (1 day) 2. Document session ID immutability 3. Add UI warning before regeneration |
| Inline editing scroll bugs | LOW | 1. Add stable keys (immediate) 2. Implement debounce (1 hour) 3. Store scrollTop in ref (1 hour) |
| Multi-select drag-drop state corruption | HIGH | 1. Roll back multi-select feature 2. Ship single-item drag only 3. Rebuild multi-select with Zustand state management (3 days) |
| Contrast violations in production | LOW | 1. Add WCAG validation (1 day) 2. Audit existing slides, notify admins of failures 3. Provide preset palette |
| Template timer conflict | LOW | 1. Document session state is authoritative 2. Add "Revert to template default" button 3. Separate templateTimerSeconds vs runtimeTimerSeconds |
| Layout shift from images | MEDIUM | 1. Store dimensions during upload (1 day) 2. Add aspect-ratio CSS 3. Implement preload for next slide |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Template Preview Divergence | Phase 22-23 (Template Preview + Editor) | Screenshot regression tests, shared component audit |
| Session Template Migration Timing | Phase 20 (Session Templates) | Schema validation on load, PostgREST retry logic |
| Team Assignment Data Model Error | Phase 24 (Team Data Model) | Schema review, validate against template edit workflows |
| Team Aggregation Performance | Phase 25 (Team Results) | EXPLAIN ANALYZE with 100 users, 10 teams, 50 questions |
| QR Code Regeneration Breaks Sessions | Phase 27 (QR Code Management) | Test QR regeneration with active participants connected |
| Inline Editing Scroll Position | Phase 17 or 23 (Sequence/Template Editor) | Scroll preservation test with >20 items |
| Multi-Select DnD State Desync | Phase 29 (Multi-Select DnD) | Drag 5 selected items, verify order + no data loss |
| Background Color Contrast | Phase 30 (Background Color) | WCAG validation test, contrast ratio <4.5:1 blocked |
| Batch Timer Template Override | Phase 20 or 32 (Templates/Runtime) | Change timer during live session, verify participant sees new value |
| Image Preloading Layout Shift | Phase 16 + 18 (Image Slides + Controller) | Lighthouse CLS <0.1 on slow network |

---

## Sources

### Primary (HIGH confidence)
- [Supabase Row Level Security (RLS): Complete Guide (2026)](https://designrevision.com/blog/supabase-row-level-security) - RLS policy performance patterns
- [Postgres RLS Implementation Guide - Best Practices, and Common Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide) - Performance impact, indexing strategies
- [Color Contrast for Accessibility: WCAG Guide (2026)](https://www.webability.io/blog/color-contrast-for-accessibility) - WCAG 2.1 contrast ratios, 4.5:1 for normal text
- [WebAIM: Contrast and Color Accessibility](https://webaim.org/articles/contrast/) - Accessibility violations, testing tools
- [Support for multi-select and drag? · Issue #120 · clauderic/dnd-kit](https://github.com/clauderic/dnd-kit/issues/120) - dnd-kit multi-select not built-in, custom implementation required
- [Multiple draggable elements with React dnd-kit? · Discussion #1313](https://github.com/clauderic/dnd-kit/discussions/1313) - State management complexity for multi-select
- [Optimizing Web Performance: Preventing Layout Shifts with Image Preloading](https://medium.com/@devsolopreneur/optimizing-web-performance-preventing-layout-shifts-with-image-preloading-in-react-and-next-js-8885bb4ebf0a) - Width/height attributes, aspect ratio reservation
- [QR code trends for 2026: What to expect](https://qrcodekit.com/news/qr-code-trends/) - Dynamic vs static QR security patterns
- [QR Code Login, Without the Risk: Enterprise Patterns and Quishing Defenses](https://www.wwpass.com/blog/qr-code-login-without-the-risk-enterprise-patterns-quishing-defenses/) - Session ID security, 60-180s TTL patterns

### Secondary (MEDIUM confidence)
- [Realtime Limits | Supabase Docs](https://supabase.com/docs/guides/realtime/limits) - Broadcast payload 256KB limit, 100 messages/sec
- [Scalable QR Code Solutions for Enterprises](https://scanova.io/features/enterprise-qr-code-generator/) - Multi-team centralized governance patterns
- [Sharing State Between Components – React](https://react.dev/learn/sharing-state-between-components) - Component state sharing patterns
- [Shared State Complexity in React – A Complete Handbook](https://www.freecodecamp.org/news/shared-state-complexity-in-react-handbook/) - State management anti-patterns
- QuickVote Phase 4 Research (internal) - Client-side aggregation performance limits, Realtime Postgres Changes patterns
- QuickVote Phase 16 implementation - browser-image-compression, Storage path conventions
- QuickVote Phase 17 implementation - PostgREST schema cache 404 workaround, claim_session RPC retry

### Tertiary (LOW confidence, project-specific)
- QuickVote v1.3 milestone known issues - session_templates migration pending, PostgREST cache delay, 16 test failures
- QuickVote existing architecture - Single Realtime channel per session, Zustand for state, dnd-kit for drag-drop, Motion for animations
- Internal testing observations - VoteAgreeDisagree batch mode props, CountdownTimer remainingSeconds timing, session template serializeSession implementation

---

*Pitfalls research for: Template authoring workflow, team-based voting, presentation polish*
*Researched: 2026-02-12*
