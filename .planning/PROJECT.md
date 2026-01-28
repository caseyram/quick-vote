# QuickVote

## What This Is

A real-time voting web application where an administrator poses questions to a group and participants respond from their phones or desktops. Built with Vite + React, backed by Supabase, and deployed to Vercel.

**Current state:** v1.0 shipped with 10,626 LOC TypeScript across 66 files.

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

### Active

**Current Milestone: v1.1 — Batch Questions & Polish**

**Goal:** Enable self-paced batch voting with on-the-fly batch creation, session management, and results polish.

**Target features:**
- On-the-fly batch creation (group questions into named batches within sessions)
- Multiple batches per session
- Self-paced batch mode (participants navigate at own pace)
- Global admin URL (/admin) with session list
- Session review and export/import (JSON with batch groupings)
- Admin progress dashboard for batch completion
- Results view: mark reasons as read, consistent column ordering, reduce scrolling, question navigation

### Out of Scope

- User accounts / authentication system — admin uses simple link, no login
- CSV/PDF export of results — live visuals only for now
- Real-time chat or discussion features — voting only
- 10,000 concurrent user support — architecture allows scaling later
- Ranked choice voting — planned for future
- Multi-admin collaborative session management — single admin per session
- Mobile native app — web only, responsive design

## Context

- **Scale:** v1 handles 50-100 concurrent participants. Single Supabase channel per session multiplexes Broadcast + Presence + Postgres Changes.
- **Tech stack:** Vite + React 19 + TypeScript, Supabase (PostgreSQL + Realtime), Vercel, Zustand, Motion (framer-motion), React Router v7
- **Themes:** Admin uses light theme (projection-friendly), participants use dark theme (immersive)
- **Voting:** Immediate submission on tap (no lock-in step), admin closes voting manually or via timer

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

---
*Last updated: 2026-01-28 after starting v1.1 milestone*
