# QuickVote

## What This Is

A real-time voting web application where an administrator poses questions to a group and participants respond from their phones or desktops. Supports both live single-question push and self-paced batch voting modes. Built with Vite + React, backed by Supabase, and deployed to Vercel.

**Current state:** v1.1 shipped with 16,086 LOC TypeScript across 97 files.

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

### Active

**Current Milestone: v1.2 Response Templates**

**Goal:** Eliminate participant confusion from inconsistent multiple choice layouts by introducing reusable response templates with locked order, colors, and layout.

**Target features:**
- Response templates: named, reusable sets of response options stored globally in Supabase
- Template assignment: select a template from a dropdown when creating multiple choice questions
- Full consistency: same template = identical option order, colors, button layout for participants
- Works in both live and batch voting modes
- Export/import: templates included in JSON export so they travel with session data

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

## Context

- **Scale:** v1.1 handles 50-100 concurrent participants. Single Supabase channel per session multiplexes Broadcast + Presence + Postgres Changes.
- **Tech stack:** Vite + React 19 + TypeScript, Supabase (PostgreSQL + Realtime), Vercel, Zustand, Motion (framer-motion), React Router v7, Zod, dnd-kit
- **Themes:** Admin uses light theme (projection-friendly), participants use dark theme (immersive)
- **Voting modes:** Live single-question push, self-paced batch mode (introduced v1.1)
- **Testing:** Vitest with happy-dom, 97 tests passing

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

---
*Last updated: 2026-02-09 after v1.2 milestone start*
