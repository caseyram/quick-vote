# Requirements: QuickVote

**Defined:** 2026-02-12
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile — not like filling out a form.

## v1.4 Requirements

Requirements for v1.4 Template Authoring & Teams. Each maps to roadmap phases.

### Template Authoring

- [ ] **AUTH-01**: Admin can open a dedicated template editor to build session content (questions, batches, slides, sequence)
- [ ] **AUTH-02**: Admin can toggle between edit mode and preview mode in the template editor
- [ ] **AUTH-03**: Preview mode displays the presenter projection view as it would appear live
- [ ] **AUTH-04**: Preview mode displays the presenter control view with navigation
- [ ] **AUTH-05**: Preview mode displays the participant voting view
- [ ] **AUTH-06**: Admin can edit batch questions inline within the sequence (not scrolled to a separate panel)
- [ ] **AUTH-07**: Admin can click a slide thumbnail to view full image in a lightbox overlay
- [ ] **AUTH-08**: Admin can create a quick one-off session without going through the template editor
- [ ] **AUTH-09**: Admin can configure batch timer duration (free-form input) in the template

### Presentation Polish

- [ ] **PRES-01**: Slide-to-slide transitions are seamless with no visible gap between full-screen images
- [ ] **PRES-02**: Admin can set a session background color via color picker
- [ ] **PRES-03**: Text and UI elements adjust for contrast when background color conflicts (panels or foreground color changes)
- [ ] **PRES-04**: Admin can associate a slide image with a batch as its cover image
- [ ] **PRES-05**: Projection displays the batch cover image while participants answer batch questions
- [ ] **PRES-06**: Navigation buttons are not hidden behind the footer batch controls (layout fix)

### Teams

- [ ] **TEAM-01**: Admin can configure team names in a session or template
- [ ] **TEAM-02**: Participants can self-select their team from a list when joining
- [ ] **TEAM-03**: Admin can generate team-specific QR codes that auto-assign participants to a team
- [ ] **TEAM-04**: Admin can toggle results view between all participants and a specific team
- [ ] **TEAM-05**: Admin can export session data grouped by team

### Sequence Editor

- [ ] **SEQE-01**: Drag handles are hidden in live session view (no misleading edit affordances)
- [ ] **SEQE-02**: Admin can select multiple sequence items and rearrange them as a group

### Results

- [ ] **RESL-01**: Active batch does not display "Results ready" — shows nothing or live completion count
- [ ] **RESL-02**: Admin can expand multiple reasons simultaneously (e.g., all disagree reasons at once)
- [ ] **RESL-03**: Displayed reasons are automatically marked as read when shown

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANLT-01**: Admin can view team analytics dashboard (participation rates, comparative results)
- **ANLT-02**: Admin can compare results across multiple sessions using same template

### Polish

- **PLSH-01**: Admin can set custom team colors for visual differentiation in charts
- **PLSH-02**: Admin can preview a template from the list without entering the editor
- **PLSH-03**: Admin can reorder sequence items with keyboard shortcuts (Ctrl+Up/Down)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaborative template editing | Conflict resolution complexity, ownership unclear — QuickVote is presenter-tool not committee-design |
| Nested teams (hierarchies) | Exponential UI complexity, single-level teams + Excel pivot sufficient |
| Per-question timers | Fragmented experience, batch-level timer keeps model simple |
| Animated transitions beyond crossfade | Feature bloat — one high-quality crossfade beats 50 mediocre options |
| Team leaderboards / gamification | Wrong positioning — QuickVote is immersive voting, not game show |
| Auto-save templates | Unclear version stability — explicit save gives user control |
| Edit template during live session | Risky — breaks active voting, confuses participants |
| Template versioning | Overkill for current usage levels |
| Template tagging / categorization | Premature — users likely have 5-20 templates, not hundreds |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| AUTH-06 | — | Pending |
| AUTH-07 | — | Pending |
| AUTH-08 | — | Pending |
| AUTH-09 | — | Pending |
| PRES-01 | — | Pending |
| PRES-02 | — | Pending |
| PRES-03 | — | Pending |
| PRES-04 | — | Pending |
| PRES-05 | — | Pending |
| PRES-06 | — | Pending |
| TEAM-01 | — | Pending |
| TEAM-02 | — | Pending |
| TEAM-03 | — | Pending |
| TEAM-04 | — | Pending |
| TEAM-05 | — | Pending |
| SEQE-01 | — | Pending |
| SEQE-02 | — | Pending |
| RESL-01 | — | Pending |
| RESL-02 | — | Pending |
| RESL-03 | — | Pending |

**Coverage:**
- v1.4 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after initial definition*
