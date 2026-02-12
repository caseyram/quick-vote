# Feature Research

**Domain:** Template authoring, team-based voting, presentation polish
**Researched:** 2026-02-12
**Context:** Milestone 22 - enhancing existing QuickVote v1.3 with template workflow, team features, and UX polish
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Edit/preview mode toggle | PowerPoint/Google Slides standard workflow - users separate editing from presenting. "Edit mode shows controls, preview shows clean view" is universal pattern | MEDIUM | Edit mode: drag handles, inline forms, controls visible. Preview: clean participant/presenter view. Requires mode state + conditional rendering |
| Inline editing in sequence | Modern UI expectation - users edit where items appear, not scrolled to separate panel. "Edit in place" is standard (Notion, Airtable, Trello) | MEDIUM | Replace bottom-scrolled batch form with inline edit state per sequence item. Toggle edit/view per item with save/cancel |
| Timer on batches/questions | Slido, Mentimeter, Kahoot all have countdown timers. "Keeps momentum, prevents polls from dragging" - standard feature for live polling | LOW | Free-form input (not presets) matches QuickVote flexibility. Store in template, display countdown during active batch |
| Visual drag affordances | Touch/mobile users need clear indicators items are draggable. 44px+ touch targets, dedicated handles standard on mobile | LOW | Drag handles visible only in edit mode (not live). Prevents accidental moves during presentation |
| Image preview (lightbox) | Click-to-enlarge is universal image interaction pattern. Users expect full-size view before presenting | LOW | Lightbox overlay with dimmed background, ESC to close, keyboard navigation. Standard UX pattern |
| Team/group segmentation | Polling for teams/classrooms needs group results. Poll Everywhere, Easy Poll (Teams), Boardable all support group voting | MEDIUM | Team config, separate QR per team, filtered results view, team column in export. Core feature for education/corporate use cases |
| Export filtered by segment | If teams exist, users expect per-team exports. "Download team A results" is natural follow-on to team voting | LOW | Add team filter to existing CSV export. Single team or all teams with team column |
| Customizable branding | Professional presentations need color matching. Background color customization is minimum branding need | LOW | Color picker for session background with WCAG contrast validation (4.5:1 normal text, 3:1 large). HSL makes adjustments predictable |
| Multi-select for bulk actions | Standard pattern for managing lists. Gmail, file managers, project tools all use checkbox selection for bulk operations | MEDIUM | Checkbox selection, shift-click range select, select all/none, visual feedback on selected items. Enables bulk delete/move |
| Smooth slide transitions | Abrupt slide cuts feel unprofessional. PowerPoint, Keynote, Google Slides all default to subtle transitions | MEDIUM | Crossfade (both slides visible during transition) is standard smooth transition. Requires z-index + opacity coordination |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for QuickVote's positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Template-first authoring workflow | Shifts from "create sessions" to "design templates, run instances" - matches how presentations actually work (PowerPoint-like reuse) | MEDIUM | Templates become primary view, sessions are instances. Aligns with "reusable content" mental model |
| Batch cover image (slide association) | Visual context during multi-question voting - shows relevant slide while batch is active, not just question text | MEDIUM | Associate existing slide with batch. Display during batch voting. Makes voting more immersive vs plain text |
| Seamless crossfade (both visible) | Premium feel - unlike standard fade-out-then-fade-in, both slides overlap during transition. More cinematic | MEDIUM | Requires both slides mounted simultaneously with z-index management. Smoother than competitors' instant swaps |
| Free-form timer input | Flexibility over dropdown presets (5m, 10m). Supports unusual durations (90s, 2.5m, 3:30) without preset bloat | LOW | Text input with duration parsing. Matches QuickVote's "tactile, not form-like" philosophy |
| Multi-select reasons with auto-mark read | Admin selects multiple feedback items, views together, auto-marks read on close. Reduces "which did I read?" cognitive load | LOW | Checkbox select reasons, panel display, mark read on dismiss. Workflow optimization not common in competitors |
| Per-team QR codes | Instead of single QR + team selection, each team gets dedicated code. Faster onboarding, clearer team identity | LOW | Generate QR with team parameter. Simplifies participant flow (scan = auto-assigned to team) |
| Drag handles only in edit mode | Prevents accidental sequence changes during live presentation. Clear edit vs present separation | LOW | Conditional rendering. Small detail, big UX impact for presenter confidence |
| "Results ready" during active batch | Shows partial completion when batch is active but some questions have responses. Clarifies "batch running but data available" | LOW | Display indicator when batch active AND results exist. Fixes presenter confusion about when results viewable |
| Inline batch editing in sequence | Edit batch directly in sequence view (not separate page/modal). Maintains spatial context of "this batch is between these slides" | MEDIUM | Inline form component, edit state per item, save/cancel. Better than modal/page navigation |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems or scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaborative template editing | "Like Google Docs for templates" | Conflict resolution complexity, ownership unclear, accidental overwrites. QuickVote is presenter-tool, not committee-design platform | Template duplication + manual merge. Each user owns their copy, merge intentionally |
| Nested teams (sub-groups, hierarchies) | "We have departments with teams inside" | Exponential UI complexity, minimal value. Export + Excel pivot tables handle analysis | Single-level teams + export with team tags for external analysis |
| Per-question timers | "Question 1 needs 30s, question 2 needs 2m" | Fragmented experience, harder to predict flow, complicates batch model. Timer management per item | Batch-level timer (all questions in batch same duration). Split into multiple batches if timing differs |
| Animated transitions beyond crossfade | "PowerPoint has wipe, zoom, spin..." | Feature bloat, gimmicky, breaks "immersive/tactile" feel. More != better | Single high-quality crossfade. Professional and smooth beats 50 mediocre options |
| Anonymous team voting | "Let teams vote without revealing team" | Defeats purpose of team segmentation. Contradicts "filtered results by team." Creates confusion | Team voting is transparent. If anonymity required, don't use teams (existing anonymous voting works) |
| Edit template during live session | "Fix typo mid-presentation" | Risky - breaks active voting, confuses participants with changing content, complex state sync | Preview mode catches errors. Stop session to edit if critical. Prevents mid-flight changes |
| Auto-save templates | "Save as I type" | Unclear when "version" is stable. Creates clutter (half-finished templates), no explicit save point | Explicit save button. User controls when template is "done." Clear intent vs background saves |
| Team leaderboards / gamification | "Make it competitive like Kahoot" | Wrong positioning - QuickVote is immersive/tactile voting, not game show. Changes tone/purpose | Team results shown as data (charts, export), not scores. Serious feedback tool, not competition |
| Complex transition timing controls | "Customize fade duration, easing curves" | Diminishing returns, adds UI complexity for aesthetic tweaks | Fixed smooth transition timing. One well-tuned default beats configurable mediocrity |
| Rich template metadata (tags, categories, search) | "Organize 100s of templates" | Premature - QuickVote users likely have 5-20 templates, not hundreds. Adds organization overhead | Simple list with names, chronological order, rename/delete. Add search if usage proves need |

## Feature Dependencies

```
Template Editor (edit/preview modes)
    └──requires──> Mode state (edit vs preview)
    └──enables──> Inline batch editing (edit mode shows inline forms)
    └──enables──> Drag handle visibility (only in edit mode)
    └──enhances──> Template-first workflow (templates primary interface)

Inline Batch Editing
    └──requires──> Edit state per sequence item
    └──requires──> Save/cancel actions
    └──conflicts──> Bottom-scrolled batch form (mutually exclusive UIs)
    └──builds on──> Existing batch CRUD

Team-based Voting
    └──requires──> Team configuration in template
    └──requires──> Team assignment (QR param or manual)
    └──enables──> Per-team QR codes
    └──enables──> Filtered results view
    └──enables──> Team-filtered export
    └──enhances──> Existing vote entity (add team_id)

Per-Team QR Codes
    └──requires──> Team configuration
    └──requires──> QR generation with params
    └──simplifies──> Participant onboarding (auto-assign team)

Batch Cover Image
    └──requires──> Slide-batch association field
    └──builds on──> Existing slide system (already in v1.3)
    └──displays during──> Active batch voting

Crossfade Transitions
    └──requires──> Both slides mounted simultaneously
    └──requires──> Z-index layering
    └──requires──> Opacity animation timing
    └──builds on──> Existing framer-motion (already in stack)

Session Background Color
    └──requires──> Color picker UI
    └──requires──> Contrast validation (WCAG AA: 4.5:1)
    └──affects──> All text/UI elements (must pass contrast)
    └──stores in──> Session or template config

Multi-Select Sequence Items
    └──requires──> Selection state per item
    └──enables──> Multi-select drag and drop
    └──enables──> Bulk delete/actions
    └──requires──> Shift-click, select-all logic

Timer in Template
    └──requires──> Duration field in batch/template
    └──requires──> Free-form input parsing (90s, 2.5m, 3:30)
    └──displays as──> Countdown during active batch
    └──builds on──> Existing batch state management

Lightbox Preview
    └──requires──> Modal overlay component
    └──requires──> Image URL from existing slides
    └──requires──> Keyboard event handling (ESC, arrows)

Multi-Select Reasons + Auto-Mark Read
    └──requires──> Reason selection state
    └──requires──> Mark-read action on dismiss
    └──builds on──> Existing reasons display

Drag Handles Visibility
    └──requires──> Edit/preview mode state
    └──conditional on──> Edit mode active
    └──prevents──> Accidental drag during presentation

"Results Ready" Indicator
    └──requires──> Batch active state
    └──requires──> Results existence check
    └──displays when──> Batch active AND responses exist
```

### Dependency Notes

- **Template editor is foundation** - Edit/preview mode toggle enables inline editing, drag handle control, and template-first workflow. Core dependency for authoring features
- **Team voting is cohesive feature set** - Team config, QR codes, filtered results, export all depend on team definition. Must ship together for coherent experience
- **Inline editing conflicts with bottom form** - Can't have both. Inline editing replaces existing bottom-scrolled batch form with edit-in-place pattern
- **Crossfade requires simultaneous rendering** - Unlike simple fade (one element), crossfade needs both slides visible during transition. Different animation approach
- **Background color affects everything** - Not just background - all text, buttons, overlays need contrast validation. Touches many components
- **Multi-select enables bulk operations** - Selection state is foundation. Once items selectable, bulk drag, delete, etc. follow naturally
- **Cover image builds on slides** - v1.3 already has slide system. Cover image just adds association field, reuses existing display
- **Timer per batch, not per question** - Batch-level timer keeps model simple. Per-question timers anti-featured (fragmented experience)

## MVP Definition

### Launch With (Milestone 22 v1)

Core features to ship for template authoring, team voting, and presentation polish.

- [x] **Template editor with edit/preview modes** - Foundation for authoring workflow, separates editing from presenting
- [x] **Inline batch editing in sequence** - Modern edit-in-place UX, replaces bottom-scrolled form
- [x] **Team-based voting (full feature)** - Team config, per-team QR codes, filtered results, team export. Primary new capability
- [x] **Batch cover image (slide association)** - Visual context during voting, enhances immersion
- [x] **Crossfade slide transitions** - Professional presentation polish, smooth not abrupt
- [x] **Session background color with contrast** - Basic branding with accessibility validation
- [x] **Multi-select sequence items** - Bulk rearrangement efficiency
- [x] **Timer in template (free-form)** - Maintains voting momentum, table stakes for live polling
- [x] **Slide lightbox preview** - Expected image interaction, preview before presenting
- [x] **Drag handles only in edit mode** - Prevents accidental moves during live presentation
- [x] **"Results ready" indicator** - Clarifies partial batch completion, fixes existing confusion

### Add After Validation (v1.x)

Features to add once core template/team/polish features validated and usage patterns inform need.

- [ ] **Multi-select reasons with auto-mark read** - Nice workflow optimization, validate if reason viewing frequent enough
- [ ] **Timer presets as shortcuts** - Quick-pick common durations (1m, 2m, 5m) alongside free-form. Add if free-form proves slow
- [ ] **Team analytics dashboard** - If teams heavily used, add summary view (participation rates, comparative results)
- [ ] **Template preview from list** - Quick preview without entering edit mode. Wait to see if needed
- [ ] **Batch reorder keyboard shortcuts** - Power user feature (Ctrl+Up/Down). Add if drag-drop insufficient
- [ ] **Custom team colors** - Visual differentiation in results charts. Polish once core team features validated
- [ ] **Slide thumbnail in sequence** - Image preview in sequence list. Nice-to-have, low priority
- [ ] **QR code on slides overlay** - Show session QR overlaid on content slides for late joiners. Defer until requested

### Future Consideration (v2+)

Features to defer until milestone validated and product-market fit clear.

- [ ] **Template versioning** - Undo at template level, version history. Complex, wait for strong demand
- [ ] **Team templates (pre-configured lists)** - If users repeatedly create same teams. May not be common
- [ ] **Transition timing customization** - Adjust crossfade duration. Low value, adds complexity
- [ ] **Export comparison across sessions** - Analytics across multiple template uses. V2+ analytics feature
- [ ] **Nested team hierarchies** - Departments > teams. Anti-featured for v1, reconsider if strong use case emerges
- [ ] **Template tagging/categorization** - Organization at scale. Premature for current usage levels
- [ ] **Collaborative template editing** - Real-time co-editing. Anti-featured for v1, complex for unclear value

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Template editor (edit/preview) | HIGH | MEDIUM | P1 |
| Inline batch editing | HIGH | MEDIUM | P1 |
| Team voting (full feature) | HIGH | MEDIUM | P1 |
| Timer in template | HIGH | LOW | P1 |
| Drag handles visibility | HIGH | LOW | P1 |
| "Results ready" indicator | MEDIUM | LOW | P1 |
| Batch cover image | MEDIUM | MEDIUM | P1 |
| Crossfade transitions | MEDIUM | MEDIUM | P1 |
| Session background color | MEDIUM | LOW | P1 |
| Multi-select sequence items | MEDIUM | MEDIUM | P1 |
| Slide lightbox preview | MEDIUM | LOW | P1 |
| Multi-select reasons + auto-mark | LOW | LOW | P2 |
| Timer presets shortcuts | LOW | LOW | P2 |
| Team analytics dashboard | MEDIUM | HIGH | P2 |
| Template preview from list | LOW | MEDIUM | P2 |
| Keyboard shortcuts reorder | LOW | MEDIUM | P2 |
| Custom team colors | LOW | MEDIUM | P2 |
| Slide thumbnail in sequence | LOW | LOW | P2 |
| QR overlay on slides | LOW | LOW | P2 |
| Template versioning | HIGH | HIGH | P3 |
| Team templates | LOW | MEDIUM | P3 |
| Transition timing control | LOW | LOW | P3 |
| Cross-session analytics | MEDIUM | HIGH | P3 |
| Nested teams | LOW | HIGH | P3 |
| Template tagging | LOW | MEDIUM | P3 |
| Collaborative editing | MEDIUM | VERY HIGH | P3 |

**Priority key:**
- P1: Must ship for milestone 22 completion (template authoring, team voting, presentation polish)
- P2: Should add after core validated, usage patterns inform need
- P3: Future consideration, defer until v2+ or strong user demand

## Competitor Feature Analysis

| Feature | Mentimeter | Slido | Kahoot | Poll Everywhere | QuickVote Milestone 22 |
|---------|------------|-------|--------|----------------|----------------------|
| Edit/preview separation | Presentation builder + separate presenter view | Poll builder + present from integrated view | Game builder + host view | Create polls + present mode | Template editor with edit/preview toggle |
| Team/group voting | Team mode (collaborative, leaderboard, competitive) | Not team-focused (individual responses) | Team mode (points, competition, gamification) | Group results with filtering | Team config, per-team QR, filtered results, no gamification |
| Timers on questions | Preset durations (30s, 1m, 2m, 5m) | Optional timer with presets | Always-on timer (game mechanic) | Optional countdown | Free-form input (flexibility, no preset limits) |
| Slide transitions | N/A (poll screens, not slide decks) | N/A (PowerPoint plugin handles) | Instant cuts between questions | N/A (polling focused) | Smooth crossfade (both visible during transition) |
| Branding/theming | Full theme editor (colors, fonts, logos, backgrounds) | Limited branding (logo, colors) | Game theme selection | Minimal customization | Background color with WCAG contrast validation |
| Inline editing | Edit questions in presentation builder | Separate poll creation, embed in slides | Edit in game builder list | Edit polls in dashboard | Inline batch editing in sequence (edit-in-place) |
| Batch/quiz creation | Question list in presentation | Individual polls created separately | Question bank for game | Poll list | Unified sequence with inline batch editing |
| Image in questions | Upload per question | Images supported | Image-based questions | Upload images | Batch cover image (slide association from existing slides) |
| Results export | CSV with timestamps, basic segmentation | Excel/CSV with question breakdown | Game session results | CSV export, real-time display | CSV with team filtering, existing export infrastructure |
| Multi-select actions | Select questions for duplication | Limited bulk operations | Duplicate/delete questions | Not prominent | Multi-select for drag/drop, bulk operations |
| Template reuse | Save presentations, clear results, rerun | Duplicate events/polls | Template library, duplicate games | Reuse polls | Template-first workflow (templates primary, sessions instances) |
| Live editing | Can edit during presentation (risky) | Limited changes during event | Locked once game starts | Edit while polling (cautiously) | No live editing (preview catches errors, maintains integrity) |

**QuickVote's differentiation for Milestone 22:**
- **Template-first workflow** - Templates are primary authoring unit (like PowerPoint), sessions are instances. Competitors treat polls as primary or one-off
- **Immersive voting focus** - Batch cover images, smooth transitions emphasize tactile feel, not just data collection
- **Flexible, not prescriptive** - Free-form timers, single-level teams (no forced gamification or nested hierarchies), simple clear model
- **Edit/present separation without complexity** - Edit mode shows controls, preview clean. No separate builder app or complex dual views
- **No gamification** - Team results as data (charts, CSV), not leaderboards/points. Serious feedback tool positioning
- **Builds on existing strengths** - Leverages v1.3 slide system, unified sequence, keyboard controller, batch voting already proven

## Sources

**Template authoring & editing workflows:**
- [PowerPoint Presenter View Tutorial - MLC](https://www.mauriziolacava.com/en/powerpoint-presenter-view-complete-tutorial/)
- [PowerPoint: What's New - Microsoft Community](https://techcommunity.microsoft.com/blog/microsoft_365blog/what%E2%80%99s-new-in-powerpoint-smarter-faster-ways-to-build-and-edit-presentations/4469061)
- [Google Slides: Editing Master Slides - GCF Global](https://edu.gcfglobal.org/en/googleslides/editing-master-slides-and-layouts/1/)
- [Google Slides Template Best Practices - MagicSlides](https://www.magicslides.app/blog/how-to-create-template-google-slides)
- [Inline Edit Design Pattern - Andrew Coyle Medium](https://coyleandrew.medium.com/the-inline-edit-design-pattern-e6d46c933804)
- [Inline Edit UI Pattern - UI Patterns](https://ui-patterns.com/patterns/InplaceEditor)
- [Inline Edit Design Guidelines - Atlassian Design System](https://atlassian.design/components/inline-edit/)

**Team voting & polling features:**
- [Compare Slido vs Mentimeter 2026 - Capterra](https://www.capterra.com/compare/154051-160936/Slido-vs-Mentimeter)
- [Kahoot vs Poll Everywhere - Wooclap Comparison](https://www.wooclap.com/en/blog/poll-everywhere-vs-kahoot/)
- [Kahoot Team Mode Features - Kahoot Blog](https://kahoot.com/business/poll-maker/)
- [Board Voting Software - Boardable](https://boardable.com/features/polls-voting/)
- [Easy Poll for Microsoft Teams - Capterra](https://www.capterra.com/p/10028346/Easy-Poll/)
- [PollUnit Group Voting - PollUnit](https://pollunit.com/en)
- [QR Code Polling - QR Poll](https://qrpoll.com/)
- [Group Poll Export - Doodle Help](https://help.doodle.com/en/articles/9457344-how-do-i-export-a-group-poll-to-excel)

**Presentation polish & transitions:**
- [Best PowerPoint Transitions - PlusAI](https://plusai.com/blog/the-best-powerpoint-transitions-with-example-gifs)
- [PowerPoint Transition Effects - DeckSherpa](https://decksherpa.com/blog/powerpoint-transition-effects/)
- [Slide Transitions Best Practices - 24Slides](https://24slides.com/presentbetter/slide-transitions-animations)
- [PowerPoint Transitions - ONLYOFFICE Blog](https://www.onlyoffice.com/blog/2022/04/powerpoint-transitions)
- [Accessible Colors Guide - Venngage](https://venngage.com/blog/accessible-colors/)
- [Color Contrast WCAG 2026 - WebAbility](https://www.webability.io/blog/color-contrast-for-accessibility)
- [Accessible Color Palettes - AudioEye](https://www.audioeye.com/post/accessible-colors/)
- [WCAG Contrast Checker - WebAIM](https://webaim.org/resources/contrastchecker/)

**UI patterns & interaction design:**
- [Drag and Drop Best Practices - LogRocket](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/)
- [Drag and Drop Design - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop/)
- [Multi-Select Drag Pattern - React Beautiful DnD](https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/patterns/multi-drag.md)
- [Drag and Drop UX - Eleken](https://www.eleken.co/blog-posts/drag-and-drop-ui)
- [Drag Handles UI Best Practices - Ones Blog](https://ones.com/blog/knowledge/mastering-drag-handle-ui-enhancing-user-experience/)
- [Drag and Drop Guidelines - Nielsen Norman Group](https://www.nngroup.com/articles/drag-drop/)
- [Lightbox Design UX - MotoCMS](https://www.motocms.com/blog/en/lightbox-design-for-ux/)
- [Lightbox UI Components - Microsoft Teams Design](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/design/design-teams-app-light-box-view)
- [Lightbox Accessibility - UIkit](https://getuikit.com/docs/lightbox)

**Timer & countdown features:**
- [Countdown Timer Live Polls - Vevox](https://www.vevox.com/quiz-and-poll-maker-with-countdown-timer)
- [Live Polls Guide - Enghouse Insights](https://www.enghouseinsights.com/enghouse-resources/blog/the-complete-guide-to-live-polls-engage-audiences-in-real-time/)
- [Event Success 2026 - LetsTimeIt](https://www.letstimeit.com/measuring-event-success-in-2026-attendance-engagement-and-roi/)

**Export & data management:**
- [Export Group Poll to Excel - Doodle](https://help.doodle.com/en/articles/9457344-how-do-i-export-a-group-poll-to-excel)
- [CSV Exports - Polly](https://www.polly.ai/blog/csv-exports)
- [Exporting Poll Results - Polly Help](https://www.polly.ai/help/microsoft-teams/exporting-results)
- [Export Survey Results - Polling.com](https://docs.polling.com/features/exporting-survey-results)
- [Export Poll Data - Crowdpurr](https://help.crowdpurr.com/en/articles/10524966-exporting-poll-results-data-to-a-spreadsheet)

**Notification & status patterns:**
- [Notifications UX Guidelines - Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)
- [Indicators and Notifications - Nielsen Norman Group](https://www.nngroup.com/articles/indicators-validations-notifications/)
- [Notification Design Pattern - UI Patterns](https://ui-patterns.com/patterns/notifications)
- [Batched Notifications - HackerNoon](https://hackernoon.com/creating-batched-notifications-in-a-dedicated-time-window-for-better-ux-and-saving-notification-cost)

---
*Feature research for: QuickVote Milestone 22 - template authoring, team voting, presentation polish*
*Researched: 2026-02-12*
