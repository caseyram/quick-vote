# Project Research Summary

**Project:** QuickVote v1.4 - Template Authoring & Teams
**Domain:** Real-time voting with template workflow, team-based voting, and presentation polish
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

QuickVote v1.4 extends the existing real-time voting platform with three major capability sets: template authoring (PowerPoint-like edit/preview workflow), team-based voting (multi-team QR codes with filtered results), and presentation polish (crossfade transitions, background colors, batch cover images). Research confirms these are table stakes features for professional polling tools — Mentimeter, Slido, and Poll Everywhere all implement similar patterns, but QuickVote's immersive/tactile positioning enables differentiation through seamless workflows rather than gamification.

The recommended approach leverages the existing validated stack (Motion for transitions, dnd-kit for multi-select, qrcode.react for team QR codes) with minimal additions (polished for color contrast, isomorphic-dompurify for inline editing security). Architecture follows discriminated union patterns for mode separation (edit vs preview vs live), React Context for theme propagation, and single Realtime channel per session with team metadata filtering. This avoids the complexity of separate preview components or per-team Realtime channels.

Critical risks center on template preview divergence (preview must render identically to live mode), team aggregation performance (requires server-side RPC and composite indexes), and inline editing scroll preservation (needs stable keys and debounced state). All pitfalls have documented prevention strategies and are addressable with existing patterns. Overall confidence is HIGH — this is a well-understood problem space with established solutions.

## Key Findings

### Recommended Stack

**No major stack additions required.** Existing stack (React 19, Supabase, Motion, dnd-kit, qrcode.react) handles all new features. Only two utility libraries needed: polished for WCAG contrast validation (2kB) and isomorphic-dompurify for inline editing XSS prevention (4kB). Total bundle addition: ~6kB gzipped.

**Core technologies:**
- **polished** (4.3.1): WCAG contrast checking for background color feature — industry standard for color utilities, provides readableColor() for auto text contrast and getLuminance() for WCAG AA compliance (4.5:1 normal text)
- **isomorphic-dompurify** (3.0.0-rc.2): XSS prevention for contenteditable inline editing — OWASP-recommended sanitizer with server-side support needed for template import/export flows
- **Motion** (existing): AnimatePresence with mode="wait" for crossfade transitions — no new library needed, existing installation supports sequential fade pattern
- **dnd-kit** (existing): Multi-select via custom selection state layer — no built-in multi-select, but GitHub issue #120 confirms pattern of moving all selected items in onDragEnd handler
- **qrcode.react** (existing): Per-team QR code generation — already supports React 19, generates multiple QR codes with team parameter in URL

**What NOT to add:**
- react-contenteditable (unmaintained 3 years, React 19 compatibility unverified) — use native contenteditable with DOMPurify instead
- color-contrast-checker (4 years old, limited features) — polished provides broader utilities with active maintenance
- Separate preview component library — reuse existing components with PreviewContext to inject mock data

### Expected Features

**Must have (table stakes):**
- **Edit/preview mode toggle** — PowerPoint/Google Slides standard workflow, users separate editing from presenting
- **Inline editing in sequence** — Modern UI expectation (Notion, Airtable, Trello), edit where items appear not separate panel
- **Team voting with QR codes** — Poll Everywhere, Easy Poll (Teams), Boardable all support group segmentation for education/corporate use cases
- **Timer on batches** — Slido, Mentimeter, Kahoot standard feature for live polling momentum
- **Visual drag affordances** — 44px+ touch targets with dedicated handles for mobile users
- **Customizable branding** — Background color with WCAG contrast validation (4.5:1 normal, 3:1 large text)
- **Multi-select for bulk actions** — Standard pattern (Gmail, file managers) for managing lists
- **Smooth slide transitions** — Professional presentations need subtle transitions, not abrupt cuts

**Should have (competitive differentiation):**
- **Template-first authoring workflow** — Shifts from "create sessions" to "design templates, run instances" matching PowerPoint reuse model
- **Batch cover image** — Visual context during voting, shows relevant slide while batch active (immersive feel)
- **Seamless crossfade** — Both slides visible during transition (premium feel vs instant swap)
- **Free-form timer input** — Flexibility over dropdown presets (90s, 2.5m, 3:30) matches QuickVote's tactile philosophy
- **Per-team QR codes** — Each team gets dedicated code (scan = auto-assigned) vs single QR + team selection
- **Drag handles only in edit mode** — Prevents accidental moves during live presentation

**Defer (v2+ or anti-featured):**
- Real-time collaborative template editing — conflict resolution complexity, ownership unclear, accidental overwrites
- Nested teams (hierarchies) — exponential UI complexity for minimal value, single-level teams + Excel pivot sufficient
- Per-question timers — fragmented experience, batch-level timer keeps model simple
- Animated transitions beyond crossfade — feature bloat, one high-quality crossfade beats 50 mediocre options
- Team leaderboards/gamification — wrong positioning, QuickVote is immersive voting not game show (Kahoot territory)
- Auto-save templates — unclear version stability, explicit save button gives user control

### Architecture Approach

**Mode separation via discriminated unions** enables type-safe component behavior (edit/preview/live modes). Template editor uses mode='template' variant of SequenceManager, preview uses PreviewContext to inject mock data into existing presentation components (no duplication), and live mode operates unchanged. Single Realtime channel per session with team as Presence metadata (no per-team channels). Background colors propagate via ThemeContext to avoid prop drilling through 5+ components.

**Major components:**
1. **TemplateEditor** — mode='template' variant of SequenceManager with DnD + inline batch editing, saves to session_templates.blueprint JSONB instead of session_items
2. **PreviewContext** — React Context providing mock data (activeItemId, votes, participant count) with isPreview flag to disable Realtime subscriptions during preview
3. **Team voting layer** — URL routing (/session/:id/:team), single Realtime channel with teamId in Presence metadata, vote.team_id column for filtering, composite indexes for aggregation performance
4. **Inline batch editing** — Collapsible nested lists in SequenceItemCard with expanded state map, QuestionEditCard compact editor, replaces bottom-scrolled batch form
5. **Multi-select DnD** — Selection state (Set<string>) layered over dnd-kit, Cmd/Ctrl+click for toggle, onDragEnd moves all selected items as group
6. **ThemeContext** — Global backgroundColor + itemColors Record<string, string> for per-item overrides, persisted in session_items.bg_color column
7. **Batch-slide association** — batches.cover_slide_id FK to session_items (type='slide'), two-stage activation (cover → questions) with optional skip

### Critical Pitfalls

1. **Template Preview Diverges from Live Behavior** — Preview and live components render differently due to separate rendering paths. **Avoid:** Share components with previewMode prop to disable interaction, use same Zustand store structure with preview instance, visual regression testing comparing preview to live renders.

2. **Team Aggregation Performance Collapse** — 10 teams × 50 questions × 100 participants = 50,000 vote rows to scan causes 30s+ load times. **Avoid:** Server-side PostgreSQL RPC with window functions, composite index on (session_id, question_id, participant_id), lazy load results per question not all upfront.

3. **Inline Editing Loses Scroll Position** — Component re-renders on keystroke trigger React reconciliation, list scrolls to top mid-edit. **Avoid:** Stable keys (question.id not array index), debounced state updates (300ms), store scrollTop in ref before render and restore after.

4. **Multi-Select Drag-Drop State Desync** — dnd-kit doesn't natively support multi-select, custom implementation risks items disappearing or appearing in wrong order. **Avoid:** Store selectedIds in Zustand not component state, batch database updates transactionally via RPC, optimistic update only after DB success.

5. **Background Color Contrast Failures** — User sets gold background + black text, invisible on projection. **Avoid:** WCAG contrast validation on save (4.5:1 normal text, 3:1 large), live contrast ratio display below color picker, preset palette of accessible combinations, warning (not blocking) for low contrast.

## Implications for Roadmap

Based on research, suggested phase structure emphasizes foundational patterns first (mode separation, preview system) before building features that depend on them (team voting, inline editing). Architecture research confirms mode discrimination and preview context are dependencies for all other features.

### Phase 1: Template Foundation & Mode Separation
**Rationale:** Establishes discriminated union pattern for component modes (edit/preview/live). All subsequent features depend on template creation and mode-aware rendering. Must come first to avoid rework.

**Delivers:**
- session_templates table migration (blueprint JSONB, serializeSession RPC)
- Discriminated union types for SequenceManager modes
- TemplateEditor page using mode='template'
- Template CRUD (create, list, load into session)

**Addresses (from FEATURES.md):**
- Template-first authoring workflow (differentiator)
- Foundation for edit/preview mode toggle (table stakes)

**Avoids (from PITFALLS.md):**
- Session Template Migration Timing Failure — includes error handling for missing table, schema validation on load

### Phase 2: Preview System
**Rationale:** Enables testing template rendering without creating live sessions. Depends on template creation (Phase 1). Provides foundation for validating all subsequent features in preview mode before live deployment.

**Delivers:**
- PreviewContext provider with mock data generation
- useRealtimeChannel respects isPreview flag
- Preview routes (/templates/:id/preview/presentation, /participant)
- Mock vote generation using template response options

**Addresses:**
- Edit/preview mode toggle (table stakes, second half)
- Validates template rendering matches live rendering

**Avoids:**
- Template Preview Divergence — shared components from day one, visual regression testing established early

**Research flag:** Standard pattern (React Context well-documented), no additional research needed.

### Phase 3: Background Color Theming
**Rationale:** Independent feature with no dependencies on other new features. Can be developed in parallel with Phase 4. ThemeContext pattern used here informs other context-based features.

**Delivers:**
- ThemeContext provider for color propagation
- bg_color column in session_items table
- Color picker UI with WCAG contrast validation
- SlideDisplay and BatchResultsProjection use context colors

**Addresses:**
- Customizable branding (table stakes)
- WCAG AA contrast compliance (4.5:1 normal, 3:1 large text)

**Avoids:**
- Background Color Contrast Failures — polished library provides getLuminance() and readableColor() for validation

**Uses (from STACK.md):**
- polished ^4.3.1 for contrast checking
- Context API for theme propagation (no prop drilling)

**Research flag:** Standard pattern (theme context well-documented), no additional research needed.

### Phase 4: Inline Batch Editing
**Rationale:** Requires template mode (Phase 1) but independent of teams/preview. Modern UX expectation replaces bottom-scrolled batch form with edit-in-place pattern. Can be developed in parallel with Phase 3.

**Delivers:**
- Expand/collapse state in SequenceManager (expandedBatches map)
- Nested question list rendering in SequenceItemCard
- QuestionEditCard compact editor component
- Question CRUD within expanded batch

**Addresses:**
- Inline editing in sequence (table stakes)
- Replaces bottom-scrolled batch form (UX improvement)

**Avoids:**
- Inline Editing Loses Scroll Position — stable keys, debounced state updates (300ms), scroll preservation with ref

**Uses:**
- isomorphic-dompurify ^3.0.0-rc.2 for contenteditable XSS prevention
- Native contenteditable (no react-contenteditable dependency)

**Research flag:** Standard pattern (collapsible nested lists well-documented), no additional research needed.

### Phase 5: Team-Based Voting
**Rationale:** Most complex feature, benefits from preview system (Phase 2) for testing. Foundational for per-team QR codes and filtered results. Database schema changes affect vote insertion and aggregation.

**Delivers:**
- Team schema (votes.team_id, sessions.teams_enabled, sessions.team_ids JSONB)
- Team selection UI in session setup
- Per-team QR code generation with URL routing (/session/:id/:team)
- Team metadata in Realtime Presence tracking
- Team filter in results view with aggregation
- Team-filtered CSV export

**Addresses:**
- Team voting with QR codes (table stakes)
- Per-team QR codes (differentiator)
- Export filtered by segment (table stakes)

**Avoids:**
- Team Aggregation Performance Collapse — server-side RPC, composite index (session_id, question_id, participant_id)
- Team Assignment Data Model Error — session-level JSONB roster, not question-level FK

**Uses:**
- qrcode.react ^4.2.0 (existing) for QR generation
- Single Realtime channel with team as Presence metadata

**Research flag:** **Needs deeper research during planning** — team aggregation RPC implementation, composite index optimization, load testing with 100 users/10 teams/50 questions to validate performance.

### Phase 6: Presentation Polish (Crossfade, Cover Images, Timer)
**Rationale:** Polish features after core template and team functionality validated. Crossfade uses existing Motion, cover images extend batch model, timer stored in batch JSONB.

**Delivers:**
- Crossfade transitions (AnimatePresence mode="wait")
- Batch cover image (batches.cover_slide_id FK to session_items)
- Two-stage batch activation (cover → questions)
- Timer in batch JSONB with free-form input parsing
- Countdown display during active batch

**Addresses:**
- Smooth slide transitions (table stakes)
- Batch cover image (differentiator)
- Timer on batches (table stakes)
- Free-form timer input (differentiator)

**Avoids:**
- Batch Timer Template Override — session state authoritative, template provides defaults only
- Image Preloading Layout Shift — aspect ratio reservation, preload next slide

**Uses:**
- Motion ^12.29.2 (existing) AnimatePresence
- Existing batch activation flow extended for two-stage display

**Research flag:** Standard patterns (AnimatePresence mode="wait" documented, FK constraints standard), no additional research needed.

### Phase 7: Multi-Select & Drag Enhancements
**Rationale:** Final polish feature, least critical path. Requires stable sequencing from earlier phases. Multi-select is custom implementation over dnd-kit (no built-in support).

**Delivers:**
- Selection state (Set<string>) in SequenceManager
- Cmd/Ctrl+Click selection toggle
- Shift+click range selection
- Drag-end moves all selected items as group
- Bulk action toolbar (delete selected)
- Visual drag handles only in edit mode

**Addresses:**
- Multi-select for bulk actions (table stakes)
- Visual drag affordances (table stakes)
- Drag handles only in edit mode (differentiator)

**Avoids:**
- Multi-Select Drag-Drop State Desync — selection state in Zustand, batch position updates via RPC, test with 5 selected items

**Uses:**
- dnd-kit ^6.3.1 (existing) with custom multi-select layer
- Pattern from dnd-kit GitHub issue #120 (move all selected in onDragEnd)

**Research flag:** **Needs validation during planning** — dnd-kit multi-select pattern requires testing with 5+ selected items, verify order preservation and no data loss. GitHub issue #120 confirms approach but not an official feature.

### Phase Ordering Rationale

- **Foundation first:** Template creation (Phase 1) and preview system (Phase 2) are dependencies for all other features. Mode separation and shared component architecture established early avoids rework.
- **Parallel development:** Background color (Phase 3) and inline editing (Phase 4) are independent, can be developed simultaneously after foundation.
- **Complexity sequenced:** Team voting (Phase 5) most complex, deferred until foundation stable and preview system available for testing without live sessions.
- **Polish last:** Crossfade transitions and multi-select (Phases 6-7) are refinements, not blockers. Validated user demand before building complex multi-select.
- **Pitfall prevention:** Order ensures preview divergence testing established early (Phase 2), team performance optimization addressed during implementation (Phase 5), inline editing scroll issues prevented via stable keys from start (Phase 4).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Team Voting):** Server-side aggregation RPC implementation needs PostgreSQL window function research, composite index optimization testing, load testing with realistic data volumes (100 users, 10 teams, 50 questions) to validate performance under PITFALLS.md scenarios.
- **Phase 7 (Multi-Select DnD):** dnd-kit multi-select pattern from GitHub issue #120 needs validation testing — drag 5 selected items, verify order preservation, confirm no data loss. Not an official dnd-kit feature, requires custom state management.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Template Foundation):** session_templates schema, JSONB blueprint storage, serializeSession RPC — standard PostgreSQL patterns already used in QuickVote v1.3.
- **Phase 2 (Preview System):** React Context for mock data injection — well-documented pattern, Preview.js precedent.
- **Phase 3 (Background Color):** ThemeContext pattern, polished library usage — standard React context for theming, polished has comprehensive docs.
- **Phase 4 (Inline Editing):** Collapsible nested lists, debounced contenteditable — established patterns, LogRocket and Tania Rascia guides available.
- **Phase 6 (Presentation Polish):** Motion AnimatePresence mode="wait", FK constraints for cover images — Motion docs cover sequential transitions, database FK standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack handles all features, only 2 utility libraries needed (polished, isomorphic-dompurify). Context7 docs + npm package research confirm versions and patterns. |
| Features | MEDIUM | Competitor feature analysis (Mentimeter, Slido, Kahoot) confirms table stakes, but QuickVote differentiation via non-gamified team voting is positioning bet not validated pattern. MVP definition clear. |
| Architecture | HIGH | Discriminated unions for modes, Context for preview/theme, single Realtime channel with metadata — all validated patterns with TypeScript/React precedent. Component integration points documented from existing codebase. |
| Pitfalls | HIGH | 10 critical pitfalls identified with prevention strategies from OWASP (XSS), WCAG (contrast), dnd-kit GitHub (multi-select), Supabase docs (RLS performance). Recovery steps documented. |

**Overall confidence:** HIGH

Research leveraged Context7 libraries (official docs), GitHub issues (dnd-kit multi-select community patterns), and competitor analysis (Mentimeter/Slido feature sets). All major technical patterns have documented precedent. Confidence reduced to MEDIUM for Features due to positioning bet on non-gamified team voting (differentiator not validated with users yet).

### Gaps to Address

**Multi-select drag-drop performance at scale:** dnd-kit GitHub issue #120 confirms pattern (move all selected items in onDragEnd), but no official examples with 10+ selected items. Need to validate during Phase 7 planning that batch position updates via RPC handle large selection sets without timeout. Mitigation: Start with 5-item limit, increase after load testing.

**Team aggregation query optimization:** PITFALLS.md identifies risk of 30s+ load times with 10 teams × 50 questions × 100 participants. Composite index (session_id, question_id, participant_id) recommended but not benchmarked. Need to implement server-side RPC during Phase 5 and load test with realistic data before shipping. Mitigation: Lazy load results per question initially, add materialized aggregation table if RPC insufficient.

**Template preview parity enforcement:** Research recommends shared components + visual regression testing, but no specific tooling identified. Need to select screenshot testing library (Percy, Chromatic, or playwright screenshot comparison) during Phase 2 planning. Mitigation: Manual cross-checks every release until automated testing established.

**WCAG contrast edge cases:** polished library provides getLuminance() and readableColor(), but research doesn't cover large text (18pt+) vs normal text threshold handling. Need to clarify during Phase 3 implementation whether polished distinguishes 4.5:1 (normal) vs 3:1 (large). Mitigation: Enforce stricter 4.5:1 for all text sizes if unclear.

## Sources

### Primary (HIGH confidence)
- [Motion AnimatePresence Documentation](https://motion.dev/docs/react-animate-presence) — mode="wait" for sequential transitions, confirmed crossfade pattern
- [dnd-kit GitHub Repository](https://github.com/clauderic/dnd-kit) — Multi-select via custom selection state (issue #120), sortable list patterns
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) — DOMPurify sanitization best practices
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime) — Broadcast, Presence, single channel per session patterns
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — Type narrowing for component modes
- [React Context API](https://legacy.reactjs.org/docs/context.html) — Context propagation for preview and theme
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — WCAG AA contrast ratios (4.5:1 normal, 3:1 large)

### Secondary (MEDIUM confidence)
- [polished npm](https://www.npmjs.com/package/polished) — readableColor() and getLuminance() utilities, version 4.3.1
- [isomorphic-dompurify npm](https://www.npmjs.com/package/isomorphic-dompurify) — Server-side sanitization support, version 3.0.0-rc.2
- [qrcode.react GitHub](https://github.com/zpao/qrcode.react) — React 19 compatibility, version 4.2.0
- [Mentimeter vs Slido comparison](https://www.capterra.com/compare/154051-160936/Slido-vs-Mentimeter) — Competitor feature analysis
- [Kahoot vs Poll Everywhere](https://www.wooclap.com/en/blog/poll-everywhere-vs-kahoot/) — Team mode gamification patterns
- [LogRocket: Inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/) — contenteditable patterns
- [react-collapsed](https://blog.logrocket.com/create-collapsible-react-components-react-collapsed/) — Collapsible component hooks
- [TypeScript Discriminated Unions for React](https://oneuptime.com/blog/post/2026-01-15-typescript-discriminated-unions-react-props/view) — Mode-aware component props

### Tertiary (LOW confidence, project-specific)
- QuickVote v1.3 codebase — Existing SequenceManager, session_store, Realtime patterns
- QuickVote Phase 16 implementation — browser-image-compression, Storage path conventions
- QuickVote Phase 17 implementation — PostgREST schema cache 404 workaround
- Internal testing observations — VoteAgreeDisagree batch mode props, CountdownTimer timing

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
