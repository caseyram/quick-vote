# QuickVote

## What This Is

A real-time voting web application where an administrator poses questions to a group and participants respond from their phones or desktops. Supports live single-question push, self-paced batch voting, and guided presentations with image slides, unified sequencing, and a dedicated presenter view. Built with Vite + React, backed by Supabase, and deployed to Vercel.

**Current state:** v1.3 shipped with 20,057 LOC TypeScript across 80+ source files. Presentation mode transforms sessions into guided experiences with image slides between voting batches, keyboard-driven navigation, a separate projection window, and reusable session templates.

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

### Active

## Current Milestone: v1.4 Template Authoring & Teams

**Goal:** Transform session creation into an iterative authoring workflow with template-first editing, full preview, team-based voting, and presentation polish.

**Target features:**
- Dedicated session template editor with inline batch editing and full preview (projection, controls, participant view)
- Team-based voting with team configuration, team-specific QR codes, filtered results, and per-team export
- Seamless slide transitions, configurable background color, batch cover images
- Multi-select sequence rearrangement, multi-select reasons display
- Presentation UX fixes (drag handles, "Results ready" label, nav button overlap, batch timer in template)

### Out of Scope

- User accounts / authentication system — admin uses simple link, no login
- CSV/PDF export of results — JSON export available, visual formats deferred
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

## Context

- **Scale:** v1.3 handles 50-100 concurrent participants. Single Supabase channel per session multiplexes Broadcast + Presence + Postgres Changes.
- **Tech stack:** Vite + React 19 + TypeScript, Supabase (PostgreSQL + Realtime + Storage), Vercel, Zustand, Motion (framer-motion), React Router v7, Zod, dnd-kit, browser-image-compression
- **Themes:** Admin uses light theme (projection-friendly), participants use dark theme (immersive)
- **Voting modes:** Live single-question push, self-paced batch mode (v1.1)
- **Templates:** Reusable response templates with global storage, template assignment, consistent rendering (v1.2)
- **Presentations:** Image slides, unified sequence, presenter view with separate projection window, session templates in Supabase (v1.3)
- **Testing:** Vitest with happy-dom, 413 tests passing (16 pre-existing failures)

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
| Decimal phase numbering (09.1) | Clear insertion semantics for urgent work | ✓ Good |
| Direct batch submit (no review screen) | Faster flow, review screen proved unnecessary | ✓ Good |
| JSONB array for template options | Simpler than normalized table, sufficient for small option lists | ✓ Good |
| ON DELETE SET NULL for template FK | Preserves question options when template deleted | ✓ Good |
| Global templates (not session-scoped) | Reusable across sessions, simpler mental model | ✓ Good |
| Native HTML select for TemplateSelector | Consistent with existing UI patterns, no extra dependency | ✓ Good |
| Name-based template dedup on import | Portable across Supabase instances (UUIDs differ) | ✓ Good |
| Locked options while template assigned | Prevents accidental inconsistency, detach to customize | ✓ Good |
| Vote guard on template changes | Prevents data integrity issues with existing votes | ✓ Good |
| Inline slide data in session_items | Avoids separate slides table, simpler queries | ✓ Good |
| session_items excluded from Realtime | Use Broadcast for lower overhead, avoid duplicate triggers | ✓ Good |
| browser-image-compression | Client-side WebP conversion before upload, smaller files | ✓ Good |
| Relative Storage paths in export | Portable across environments (URLs change) | ✓ Good |
| Discriminated union for export | Type-safe mixed slide/batch arrays, preserves import order | ✓ Good |
| PresentationView no auth required | Read-only projection content, simplifies cross-device setup | ✓ Good |
| Results hidden by default in presentation | Admin explicitly reveals, prevents spoilers | ✓ Good |
| JSONB blueprint for session templates | Flexible schema, single column stores full session structure | ✓ Good |
| .passthrough() on ImportSchema | Forward compatibility — v1.2 importers ignore new fields | ✓ Good |
| Idempotent backfill pattern | Safe to call on every load, graceful RLS fallback | ✓ Good |

---
*Last updated: 2026-02-12 after v1.4 milestone start*
