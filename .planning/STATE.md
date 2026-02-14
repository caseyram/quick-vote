# State: QuickVote

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.
**Stack:** Vite + React (TypeScript), Supabase (database + realtime + storage), Vercel deployment
**Repo:** C:/code/quick-vote
**Current focus:** v1.4 Template Authoring & Teams - Phase 25 (Team-Based Voting)

## Current Position

**Milestone:** v1.4 Template Authoring & Teams
**Phase:** 25 of 26 (Team-Based Voting)
**Plan:** 4 of 4 (Phase Complete)
**Status:** Complete
**Last activity:** 2026-02-14 — Completed Plan 25-03 (Team-Based Results Filtering)

Progress: [███████████████████░] 98% (v1.4: 18 of 18 plans complete)

## Milestone History

| Version | Name | Shipped | Phases | Plans |
|---------|------|---------|--------|-------|
| v1.0 | MVP | 2026-01-28 | 1-5 | 16 |
| v1.1 | Batch Questions & Polish | 2026-01-29 | 6-10 (+09.1) | 18 |
| v1.2 | Response Templates | 2026-02-10 | 11-15 | 11 |
| v1.3 | Presentation Mode | 2026-02-11 | 16-21 | 12 |

See `.planning/MILESTONES.md` for full details.
See `.planning/milestones/` for archived roadmaps and requirements.

## Performance Metrics

**v1.0 (Phases 1-5):**
- Plans: 16
- Avg plans/phase: 3.2
- Delivered: All requirements

**v1.1 (Phases 6-10 + 09.1):**
- Plans: 18
- Avg plans/phase: 3.0
- Delivered: All requirements
- Inserted phases: 1 (Phase 09.1)

**v1.2 (Phases 11-15):**
- Plans: 11
- Avg plans/phase: 2.2
- Requirements: 16/16 delivered
- Timeline: 2 days (2026-02-09 to 2026-02-10)

**v1.3 (Phases 16-21):**
- Plans: 12
- Avg plans/phase: 2.0
- Requirements: 22/22 delivered
- Timeline: 2 days (2026-02-10 to 2026-02-11)

**v1.4 Target (Phases 22-26):**
- Requirements: 25 total
- Estimated plans: 14 total (12 original + 2 from Phase 24.1 insertion)
- Completed: 18 (Phase 22: 4, Phase 23: 3, Phase 24: 5, Phase 24.1: 2, Phase 25: 4)
- Remaining: Phase 26 (multi-select DnD)

## Accumulated Context

### Roadmap Evolution

- Phase 24.1 inserted after Phase 24: Presentation-Only Active Mode (URGENT) — Remove non-presentation admin view for active sessions, make PresentationControls the only active session view, add Go Live, timer config, and connection status

### Decisions

See PROJECT.md for full decision log.

Recent decisions:
- [Phase 25-04]: Team QR grid takes precedence over regular QR overlay when both active
- [Phase 25-04]: Include general session QR at bottom of team grid for non-team participants
- [Phase 25-04]: Export format remains JSON (team_id is nullable for backward compatibility)
- [Phase 25-04]: Responsive grid: 2 cols for 2-4 teams, 3 cols for 5 teams
- [Phase 25-03]: TeamFilterTabs accepts theme prop for light (admin) and dark (projection) variants
- [Phase 25-03]: selectedTeam === null represents 'All' (no filter applied)
- [Phase 25-03]: Team filter state resets to 'All' on page reload (no persistence)
- [Phase 25-03]: Broadcast event 'team_filter_changed' syncs filter selection to projection in real time
- [Phase 25-03]: Display 'Showing: [TeamName]' label on projection when team filter is active
- [Phase 25-02]: Team picker as gate (blocks lobby/voting until team selected) when session has teams
- [Phase 25-02]: Team locked after first vote (prevents switching teams mid-session)
- [Phase 25-02]: sessionStorage for team persistence (survives refresh, scoped to session)
- [Phase 25-02]: TeamBadge at top-right (z-40) to avoid overlap with ConnectionPill (top-left)
- [Phase 25-01]: JSONB column for teams array on sessions table (flexible, max 5 teams via CHECK constraint)
- [Phase 25-01]: Nullable team_id on votes table (participants can opt out of teams)
- [Phase 25-01]: Case-insensitive uniqueness validation in Zod (prevents duplicate team names)
- [Phase 25-01]: Composite index on (session_id, team_id) for efficient team filtering queries
- [Phase 24.1-02]: Removed non-presentation active view entirely — PresentationControls is the only active session UI
- [Phase 24.1-02]: Split view toggle replaces fixed current+next layout
- [Phase 24.1-02]: Batch-level reveal (all questions at once) instead of per-question reveal
- [Phase 24.1-02]: Reason review with auto-play, keyboard nav, group-aware pagination, reasons-per-page (1/2/4)
- [Phase 24.1-02]: Reasons displayed in question response option order
- [Phase 24.1-02]: Removed claim_session RPC; session reclaim uses direct UPDATE
- [Phase 24.1-02]: Vote polling reduced from 3s to 10s (realtime is primary channel)
- [Phase 24-03]: Cover image selector in BatchEditor toolbar between question count and timer input
- [Phase 24-03]: Cover image crossfade animation (400ms) when transitioning from cover to results
- [Phase 24-01]: Default background color #1a1a2e for projection views until session template loading implemented
- [Phase 24-01]: Cubic-bezier easing [0.4, 0.0, 0.2, 1] with 400ms for smooth directional transitions
- [Phase 24-01]: Remove AnimatePresence mode="wait" to enable overlap during transitions (no visible gaps)
- [Phase 23-02]: Static voting mockup (no click handlers) chosen for simplicity over clickable no-ops
- [Phase 23-02]: No device frame for participant view - just phone proportions (max-w-[320px])
- [Phase 23-01]: Fixed deterministic mock vote distributions (no randomness) for consistent preview
- [Phase 23-01]: Dropdown pattern for Preview All vs Preview from Here (better UX than two separate buttons)
- [Phase 23-01]: Light theme for projection panel to match live presentation appearance
- (v1.4) Install yet-another-react-lightbox for image viewing — battle-tested library, minimal setup required
- (v1.4) Restructure Home page with three session creation paths — Create New (template editor), Quick Session (direct), New from Template (copy)
- (v1.4) Add Start Session button alongside Save Template — separate one-off session launch from template persistence
- (v1.4) Use nanoid for editor item IDs — consistent with project convention, already in dependencies
- (v1.4) Upload template images to 'templates' session ID folder — reuses existing slide storage infrastructure, isolates template images from session images
- (v1.3) Inline slide data in session_items — avoids separate slides table, simpler queries
- (v1.3) JSONB blueprint for session templates — flexible schema, single column stores full session structure
- [Phase 22]: Auto-collapse expanded questions on drag start to prevent glitchy overlays
- [Phase 22]: Timer duration as number input in seconds with human-readable conversion
- [Phase 22]: Anonymous field removed from editor UI — all votes are anonymous by default (hard-coded true in blueprint)
- [Phase 22]: Response template selectors at 3 levels: per-question, per-batch, and global toolbar
- [Phase 24]: HexColorPicker and HexColorInput from react-colorful provide wheel + text input in single UI
- [Phase 24]: Chart color adaptation uses 3.0 minimum contrast ratio (WCAG AA minimum for graphics)

### Known Issues

- **PostgREST schema cache:** claim_session RPC function exists in migrations but not deployed. Removed the RPC call; session reclaim now uses direct UPDATE on sessions table.

### Blockers

(none)

## Session Continuity

**Last session:** 2026-02-14
**Stopped at:** Completed Plan 25-03 (Team-Based Results Filtering) - Phase 25 complete (4/4 plans)
**Next action:** Phase 25 complete. All team-based voting features implemented. Continue to Phase 26 (Multi-Select DnD).
**Resume file:** None

---
*State initialized: 2026-01-27*
*Updated: 2026-02-14 — Plan 25-03 complete. Phase 25 (Team-Based Voting) complete (4/4 plans). Team filter tabs with broadcast sync enable admin to toggle results between all participants and specific teams, with projection mirroring selection in real time.*
