# Roadmap: QuickVote

## Milestones

- SHIPPED **v1.0 MVP** - Phases 1-5 (shipped 2026-01-28)
- SHIPPED **v1.1 Batch Questions & Polish** - Phases 6-10 + 09.1 (shipped 2026-01-29)
- SHIPPED **v1.2 Response Templates** - Phases 11-15 (shipped 2026-02-10)
- SHIPPED **v1.3 Presentation Mode** - Phases 16-21 (shipped 2026-02-11)
- 🚧 **v1.4 Template Authoring & Teams** - Phases 22-26 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) - SHIPPED 2026-01-28</summary>

See `.planning/milestones/` for archived details.

</details>

<details>
<summary>v1.1 Batch Questions & Polish (Phases 6-10 + 09.1) - SHIPPED 2026-01-29</summary>

See `.planning/milestones/` for archived details.

</details>

<details>
<summary>v1.2 Response Templates (Phases 11-15) - SHIPPED 2026-02-10</summary>

See `.planning/milestones/` for archived details.

</details>

<details>
<summary>v1.3 Presentation Mode (Phases 16-21) - SHIPPED 2026-02-11</summary>

See `.planning/milestones/` for archived details.

</details>

### 🚧 v1.4 Template Authoring & Teams (In Progress)

**Milestone Goal:** Transform session creation into iterative authoring workflow with template-first editing, full preview, team-based voting, and presentation polish.

#### Phase 22: Template Foundation & Authoring (DONE)
**Goal**: Admin can build sessions in dedicated template editor with inline editing
**Depends on**: Phase 21
**Requirements**: AUTH-01, AUTH-02, AUTH-06, AUTH-07, AUTH-08, AUTH-09
**Success Criteria** (what must be TRUE):
  1. Admin can open template editor and toggle between edit and preview modes
  2. Admin can edit batch questions inline within sequence (not separate panel)
  3. Admin can click slide thumbnail to view full image in lightbox
  4. Admin can create quick one-off session without template editor
  5. Batch timer duration is configurable via free-form input in template
**Plans**: 4 plans

Plans:
- [x] 22-01-PLAN.md — Editor shell, store, toolbar, sidebar with drag-reorder, and save
- [x] 22-02-PLAN.md — Inline batch editing with collapsed/expanded question rows and timer input
- [x] 22-03-PLAN.md — Edit/preview toggle, preview mode, slide lightbox, and quick session flow
- [x] 22-04-PLAN.md — Human verification of all AUTH requirements

#### Phase 23: Preview System
**Goal**: Admin can preview projection, control, and participant views before going live
**Depends on**: Phase 22
**Requirements**: AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Preview mode displays presenter projection view as it would appear live
  2. Preview mode displays presenter control view with navigation
  3. Preview mode displays participant voting view with mock interactions
**Plans**: 3 plans

Plans:
- [ ] 23-01-PLAN.md — Preview overlay shell, mock data, projection panel, toolbar entry points
- [ ] 23-02-PLAN.md — Admin controls panel, participant view panel, full integration
- [ ] 23-03-PLAN.md — Human verification of AUTH-03, AUTH-04, AUTH-05

#### Phase 24: Presentation Polish
**Goal**: Seamless slide transitions, branded backgrounds, and batch cover images
**Depends on**: Phase 22
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, PRES-06
**Success Criteria** (what must be TRUE):
  1. Slide-to-slide transitions crossfade seamlessly with no visible gap
  2. Admin can set session background color that applies to all projection views
  3. Text and UI elements maintain readable contrast when background color changes
  4. Admin can associate slide image with batch as cover image
  5. Projection displays batch cover image while participants answer questions
**Plans**: TBD

Plans:
- [ ] 24-01: TBD
- [ ] 24-02: TBD

#### Phase 25: Team-Based Voting
**Goal**: Multi-team voting with team-specific QR codes and filtered results
**Depends on**: Phase 22
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05
**Success Criteria** (what must be TRUE):
  1. Admin can configure team names in session or template
  2. Participants can self-select team when joining
  3. Admin can generate team-specific QR codes that auto-assign participants
  4. Admin can toggle results view between all participants and specific team
  5. Admin can export session data grouped by team
**Plans**: TBD

Plans:
- [ ] 25-01: TBD
- [ ] 25-02: TBD

#### Phase 26: Sequence & Results Enhancements
**Goal**: Multi-select rearrangement, results polish, and UX fixes
**Depends on**: Phase 23
**Requirements**: SEQE-01, SEQE-02, RESL-01, RESL-02, RESL-03
**Success Criteria** (what must be TRUE):
  1. Drag handles hidden in live session view (no misleading edit affordances)
  2. Admin can select multiple sequence items and rearrange as group
  3. Active batch shows live completion count, not "Results ready" label
  4. Admin can expand multiple reasons simultaneously
  5. Displayed reasons automatically marked as read when shown
**Plans**: TBD

Plans:
- [ ] 26-01: TBD
- [ ] 26-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 22 → 23 → 24 → 25 → 26

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 16/16 | Shipped | 2026-01-28 |
| 6-10+09.1 | v1.1 | 18/18 | Shipped | 2026-01-29 |
| 11-15 | v1.2 | 11/11 | Shipped | 2026-02-10 |
| 16-21 | v1.3 | 12/12 | Shipped | 2026-02-11 |
| 22. Template Foundation & Authoring | v1.4 | 4/4 | Done | 2026-02-12 |
| 23. Preview System | v1.4 | 0/3 | Not started | - |
| 24. Presentation Polish | v1.4 | 0/? | Not started | - |
| 25. Team-Based Voting | v1.4 | 0/? | Not started | - |
| 26. Sequence & Results Enhancements | v1.4 | 0/? | Not started | - |

---
*Created: 2026-01-27*
*Updated: 2026-02-12 - Phase 22 complete (4/4 plans, verified)*
