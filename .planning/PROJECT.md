# QuickVote

## What This Is

A real-time voting web application where an administrator poses questions to a group and participants respond from their phones or desktops. Supports live single-question push, self-paced batch voting, and guided presentations with image slides, unified sequencing, and a dedicated presenter view. Features a template-first authoring workflow with inline editing, full preview, team-based voting with filtered results, and presentation polish with branded backgrounds and cover images. Built with Vite + React, backed by Supabase, and deployed to Vercel.

**Current state:** v1.4 shipped with 27,520 LOC TypeScript across 90+ source files. Template editor enables iterative session authoring. Team-based voting supports multi-team sessions with QR auto-assign and filtered results. Presentation mode includes background colors, cover images, split view, and reason review.

## Core Value

Participants can instantly vote on questions in a way that feels immersive and tactile — not like filling out a form.

## Requirements

### Validated

- ✓ Admin can create a session via unique link (no account required) — v1.0
- ✓ Admin can add, edit, reorder questions with vote types (agree/disagree, multiple choice) — v1.0
- ✓ Admin can control voting flow: start, close (manual or timer), reveal results — v1.0
- ✓ Admin can configure per-question anonymous or named voting — v1.0
- ✓ Participants join via QR code — lobby if before start, current question if mid-session — v1.0
- ✓ Participant voting UI is full-screen, tactile, with large tap targets and animations — v1.0
- ✓ Votes submit immediately on tap — v1.0
- ✓ Live bar chart results display as votes arrive — v1.0
- ✓ Sessions persisted in Supabase — admin can revisit past sessions — v1.0
- ✓ Responsive design works on phones (participants) and desktop (admin) — v1.0
- ✓ QR code generation for easy participant access — v1.0
- ✓ Connection status indicator shows participant connectivity — v1.0
- ✓ Countdown timer with auto-close — v1.0
- ✓ Participant count visible to admin — v1.0
- ✓ Admin can create questions on-the-fly and group them into named batches — v1.1
- ✓ Admin can create multiple batches per session — v1.1
- ✓ Admin can activate a batch for participant self-paced voting — v1.1
- ✓ Participants navigate batch questions with Next/Previous buttons — v1.1
- ✓ Participants see progress indicator (Question 3 of 10) — v1.1
- ✓ Participant answers persist when navigating between questions — v1.1
- ✓ Participants can submit/complete the batch when finished — v1.1
- ✓ Keyboard navigation for desktop batch voting — v1.1
- ✓ Visual answer review before final batch submit — v1.1
- ✓ Completion animation per question answered — v1.1
- ✓ Global admin URL (/admin) shows session list — v1.1
- ✓ Session list ordered by timestamp (most recent first) — v1.1
- ✓ Admin can reopen past session to review results — v1.1
- ✓ Admin can export session as JSON with batch structure — v1.1
- ✓ Admin can import questions from JSON preserving batch groupings — v1.1
- ✓ Admin sees real-time progress dashboard during batch voting — v1.1
- ✓ Admin can mark individual reasons as read — v1.1
- ✓ Results columns display in consistent order (agree always same position) — v1.1
- ✓ Keyboard navigation in results view — v1.1
- ✓ Admin can create named response templates with ordered options — v1.2
- ✓ Admin can edit templates (rename, reorder, add/remove options) — v1.2
- ✓ Admin can delete templates (with confirmation if in use) — v1.2
- ✓ Templates stored globally in Supabase, available across all sessions — v1.2
- ✓ Admin can set session-level default template for new MC questions — v1.2
- ✓ Admin can assign templates to MC questions via dropdown — v1.2
- ✓ Template auto-populates question options, locked while assigned — v1.2
- ✓ Admin can detach question from template to customize independently — v1.2
- ✓ All template-linked questions display identical option order, colors, and layout — v1.2
- ✓ Templates included in JSON export and restored on import (name-based dedup) — v1.2
- ✓ Template-question associations preserved through export/import round-trip — v1.2
- ✓ Admin result views match participant template ordering — v1.2
- ✓ Admin can upload full-screen images to Supabase Storage with validation — v1.3
- ✓ Admin can view uploaded images displayed full-screen on admin projection — v1.3
- ✓ Admin can create, view, and delete image slides with storage cleanup — v1.3
- ✓ Admin can add optional title/label to slides for admin management — v1.3
- ✓ Admin can arrange slides and batches in unified drag-and-drop sequence — v1.3
- ✓ Admin can advance through sequence with keyboard and on-screen buttons — v1.3
- ✓ Participants see waiting state when admin is on a content slide — v1.3
- ✓ Smooth transition animations between sequence items — v1.3
- ✓ Admin can open separate presentation window for clean projected output — v1.3
- ✓ Admin control view shows sequence list, navigation, preview, QR toggle — v1.3
- ✓ Presentation window syncs via Supabase Realtime (cross-device) — v1.3
- ✓ Admin can toggle QR overlay on presentation from control view — v1.3
- ✓ Extended keyboard shortcuts (Space, B, F, Escape) in presentation — v1.3
- ✓ Fullscreen API toggle in presentation window — v1.3
- ✓ Save session as reusable template in Supabase — v1.3
- ✓ Load saved template into new session — v1.3
- ✓ List, rename, and delete session templates — v1.3
- ✓ JSON export includes slides, sequence, and template provenance — v1.3
- ✓ JSON import restores slides and sequence with Storage validation — v1.3
- ✓ Session template references preserved in export/import — v1.3
- ✓ Slide preview thumbnails in sequence editor — v1.3
- ✓ QR overlay on content slides in presentation view — v1.3
- ✓ Admin can open dedicated template editor to build session content — v1.4 (AUTH-01)
- ✓ Admin can toggle between edit and preview mode in template editor — v1.4 (AUTH-02)
- ✓ Preview mode displays presenter projection view — v1.4 (AUTH-03)
- ✓ Preview mode displays presenter control view with navigation — v1.4 (AUTH-04)
- ✓ Preview mode displays participant voting view — v1.4 (AUTH-05)
- ✓ Admin can edit batch questions inline within sequence — v1.4 (AUTH-06)
- ✓ Admin can click slide thumbnail to view full image in lightbox — v1.4 (AUTH-07)
- ✓ Admin can create quick one-off session without template editor — v1.4 (AUTH-08)
- ✓ Admin can configure batch timer duration in template — v1.4 (AUTH-09)
- ✓ Seamless slide-to-slide crossfade transitions — v1.4 (PRES-01)
- ✓ Admin can set session background color via color picker — v1.4 (PRES-02)
- ✓ Text and UI elements adjust for contrast on background color — v1.4 (PRES-03)
- ✓ Admin can associate slide image with batch as cover image — v1.4 (PRES-04)
- ✓ Projection displays batch cover image during voting — v1.4 (PRES-05)
- ✓ Navigation buttons visible above batch controls — v1.4 (PRES-06)
- ✓ Admin can configure team names in session or template — v1.4 (TEAM-01)
- ✓ Participants can self-select team when joining — v1.4 (TEAM-02)
- ✓ Admin can generate team-specific QR codes with auto-assign — v1.4 (TEAM-03)
- ✓ Admin can toggle results between all participants and specific team — v1.4 (TEAM-04)
- ✓ Admin can export session data grouped by team — v1.4 (TEAM-05)
- ✓ Admin can select multiple sequence items and rearrange as group — v1.4 (SEQE-02)
- ✓ Active batch shows live completion count, not "Results ready" — v1.4 (RESL-01)
- ✗ Drag handles hidden in live session (SEQE-01) — dropped: editing stays available during live
- ✗ Expand multiple reasons simultaneously (RESL-02) — dropped: existing review system sufficient
- ✗ Auto-mark reasons as read (RESL-03) — dropped: existing viewed tracking sufficient

### Active

(No active requirements — start next milestone with `/gsd:new-milestone`)

### Out of Scope

- User accounts / authentication system — admin uses simple link, no login
- Real-time chat or discussion features — voting only
- 10,000 concurrent user support — architecture allows scaling later
- Ranked choice voting — planned for future
- Multi-admin collaborative session management — single admin per session
- Mobile native app — web only, responsive design
- Skip logic / branching in batch questions — high complexity, low value for short sessions
- Swipe gesture navigation for mobile — arrow keys and buttons sufficient
- Custom color picker per response template — current palette sufficient
- Template versioning — overkill for 2-5 templates
- Template sharing between users — no user accounts exist
- Video slides — playback complexity, autoplay policies
- Rich text editor on slides — scope explosion, text baked into images
- Participant-visible slides — doubles rendering surface, complicates phone experience
- Slide templates/themes — theming is scope creep
- Image editing/annotation — admin uses external tools
- Auto-advance / timed slides — contradicts manual control model
- Binary image embedding in export — file size explosion
- Real-time collaborative template editing — conflict resolution complexity
- Nested teams (hierarchies) — exponential UI complexity, single-level teams sufficient
- Per-question timers — fragmented experience, batch-level timer keeps model simple
- Animated transitions beyond crossfade — one high-quality crossfade beats 50 mediocre options
- Team leaderboards / gamification — wrong positioning, QuickVote is voting not game show
- Auto-save templates — unclear version stability, explicit save gives user control
- Edit template during live session — risky, breaks active voting
- Template tagging / categorization — premature, users have 5-20 templates

## Context

- **Scale:** v1.4 handles 50-100 concurrent participants. Single Supabase channel per session multiplexes Broadcast + Presence + Postgres Changes.
- **Tech stack:** Vite + React 19 + TypeScript, Supabase (PostgreSQL + Realtime + Storage), Vercel, Zustand, Motion (framer-motion), React Router v7, Zod, dnd-kit, browser-image-compression, react-colorful, qrcode.react, yet-another-react-lightbox
- **Themes:** Admin uses light theme (projection-friendly), participants use dark theme (immersive)
- **Voting modes:** Live single-question push, self-paced batch mode
- **Templates:** Reusable response templates with global storage, template assignment, consistent rendering
- **Session templates:** Full session blueprints saved/loaded from Supabase with JSONB storage
- **Template editor:** Dedicated full-page editor with inline batch editing, drag-reorder, edit/preview toggle
- **Presentations:** Image slides, unified sequence, presenter view with projection window, background colors, cover images, split view, reason review
- **Teams:** Multi-team voting with team config, QR auto-assign, filtered results, export with team data
- **Testing:** Vitest with happy-dom

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zustand over React Context | Re-render performance with rapid vote updates | ✓ Good |
| Single multiplexed Supabase channel | Simpler than separate channels for broadcast/presence/changes | ✓ Good |
| Client-side vote aggregation | Sufficient for 50-100 users, avoids server complexity | ✓ Good |
| Manual TypeScript types | Simpler than Supabase-generated types, more control | ✓ Good |
| Blue/orange for agree/disagree | Neutral, non-judgmental (not green/red) | ✓ Good |
| Immediate vote submission | Simpler UX than lock-in flow | ✓ Good |
| Admin light / Participant dark themes | Projection readability vs immersive voting | ✓ Good |
| Batches as runtime feature | Questions belong to batches, not separate collection entity | ✓ Good |
| dnd-kit for drag-and-drop | Modern React 18+ support, accessible, well-maintained | ✓ Good |
| Zod for JSON validation | Type-safe import/export with helpful error messages | ✓ Good |
| localStorage for read/unread tracking | Simple persistence without database overhead | ✓ Good |
| Decimal phase numbering (09.1, 24.1) | Clear insertion semantics for urgent work | ✓ Good |
| Direct batch submit (no review screen) | Faster flow, review screen proved unnecessary | ✓ Good |
| JSONB array for template options | Simpler than normalized table, sufficient for small option lists | ✓ Good |
| ON DELETE SET NULL for template FK | Preserves question options when template deleted | ✓ Good |
| Global templates (not session-scoped) | Reusable across sessions, simpler mental model | ✓ Good |
| Name-based template dedup on import | Portable across Supabase instances (UUIDs differ) | ✓ Good |
| Locked options while template assigned | Prevents accidental inconsistency, detach to customize | ✓ Good |
| Inline slide data in session_items | Avoids separate slides table, simpler queries | ✓ Good |
| JSONB blueprint for session templates | Flexible schema, single column stores full session structure | ✓ Good |
| PresentationView no auth required | Read-only projection content, simplifies cross-device setup | ✓ Good |
| Results hidden by default in presentation | Admin explicitly reveals, prevents spoilers | ✓ Good |
| Anonymous hardcoded to true | All votes anonymous by default, no toggle UI needed | ✓ Good |
| PresentationControls as only active view | Consolidated admin experience, removed old split view | ✓ Good |
| Batch-level reveal (all questions at once) | Simpler than per-question reveal, better presentation flow | ✓ Good |
| JSONB teams array on sessions | Flexible, max 5 teams via CHECK constraint | ✓ Good |
| Nullable team_id on votes | Participants can opt out of teams, backward compatible | ✓ Good |
| sessionStorage for team persistence | Survives refresh, scoped to session, no login needed | ✓ Good |
| Lobby view removed | Merged Start Session + Begin Voting into single "Go Live" | ✓ Good |
| react-colorful for color picker | Lightweight, zero-dependency, accessible | ✓ Good |
| Multi-select with useRef anchor | Avoids stale closures in useCallback for shift-click range | ✓ Good |

---
*Last updated: 2026-02-15 after v1.4 milestone completion*
