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

#### Phase 23: Preview System (DONE)
**Goal**: Admin can preview projection, control, and participant views before going live
**Depends on**: Phase 22
**Requirements**: AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Preview mode displays presenter projection view as it would appear live
  2. Preview mode displays presenter control view with navigation
  3. Preview mode displays participant voting view with mock interactions
**Plans**: 3 plans

Plans:
- [x] 23-01-PLAN.md — Preview overlay shell, mock data, projection panel, toolbar entry points
- [x] 23-02-PLAN.md — Admin controls panel, participant view panel, full integration
- [x] 23-03-PLAN.md — Human verification of AUTH-03, AUTH-04, AUTH-05

#### Phase 24: Presentation Polish (DONE)
**Goal**: Seamless slide transitions, branded backgrounds, and batch cover images
**Depends on**: Phase 22
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, PRES-06
**Success Criteria** (what must be TRUE):
  1. Slide-to-slide transitions crossfade seamlessly with no visible gap
  2. Admin can set session background color that applies to all projection views
  3. Text and UI elements maintain readable contrast when background color changes
  4. Admin can associate slide image with batch as cover image
  5. Projection displays batch cover image while participants answer questions
**Plans**: 5 plans

Plans:
- [x] 24-01-PLAN.md — Directional transitions, color infrastructure, background color, nav layout fix
- [x] 24-02-PLAN.md — Color picker UI in toolbar, chart contrast adaptation
- [x] 24-03-PLAN.md — Batch cover images (selector, projection display, blueprint persistence)
- [x] 24-04-PLAN.md — Human verification of all PRES requirements
- [x] 24-05-PLAN.md — Gap closure: fix nav button visibility when batch panel active (PRES-06)

#### Phase 25: Team-Based Voting (DONE)
**Goal**: Multi-team voting with team-specific QR codes and filtered results
**Depends on**: Phase 22
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05
**Success Criteria** (what must be TRUE):
  1. Admin can configure team names in session or template
  2. Participants can self-select team when joining
  3. Admin can generate team-specific QR codes that auto-assign participants
  4. Admin can toggle results view between all participants and specific team
  5. Admin can export session data grouped by team
**Plans**: 4 plans

Plans:
- [x] 25-01-PLAN.md — Database migration (teams column, team_id), TypeScript types, team API module
- [x] 25-02-PLAN.md — Admin team config UI, participant team picker, team badge, auto-assign from QR
- [x] 25-03-PLAN.md — Team filter tabs, enhanced vote aggregation, projection broadcast sync
- [x] 25-04-PLAN.md — Team QR grid overlay for projection, session export with team column

#### Phase 26: Sequence & Results Enhancements (DONE)
**Goal**: Multi-select rearrangement, live vote progress display, and session config simplification
**Depends on**: Phase 23
**Requirements**: SEQE-02, RESL-01
**Success Criteria** (what must be TRUE):
  1. Admin can select multiple sequence items and rearrange as group
  2. Active batch shows live completion count, not "Results ready" label
  3. Draft session config shows only runtime settings (no content editing)
**Plans**: 2 plans

**Dropped (per user decision in CONTEXT.md):** SEQE-01 (drag handles stay visible), RESL-02 (existing reason review sufficient), RESL-03 (existing viewed tracking sufficient)

Plans:
- [x] 26-01-PLAN.md — Multi-select rearrangement (shift/ctrl-click selection, group drag)
- [x] 26-02-PLAN.md — Live vote progress bar on active batches, session config simplification

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
| 23. Preview System | v1.4 | 3/3 | Done | 2026-02-13 |
| 24. Presentation Polish | v1.4 | 5/5 | Done | 2026-02-14 |
| 24.1 Presentation-Only Active Mode | v1.4 | 2/2 | Done | 2026-02-14 |
| 25. Team-Based Voting | v1.4 | 4/4 | Done | 2026-02-14 |
| 26. Sequence & Results Enhancements | v1.4 | 2/2 | Done | 2026-02-14 |

---
*Created: 2026-01-27*
*Updated: 2026-02-14 - Phase 26 complete (2/2 plans, verified). Multi-select rearrangement, live vote progress, simplified session config. v1.4 milestone complete.*

### Phase 24.1: Presentation-Only Active Mode (DONE)

**Goal:** Make PresentationControls the only active session view, consolidating Go Live, timer config, and connection status from AdminControlBar
**Depends on:** Phase 24
**Plans:** 2 plans

Plans:
- [x] 24.1-01-PLAN.md — Add Go Live, timer config, and connection status to PresentationControls right sidebar
- [x] 24.1-02-PLAN.md — Remove non-presentation active view, split view toggle, reason review system, projection sync, console cleanup
