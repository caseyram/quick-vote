# QuickVote

## What This Is

A real-time voting web application where an administrator poses questions to a group and participants respond from their phones or desktops. Built with Vite + React, backed by Supabase, and deployed to Vercel. Supports both live presentation-style sessions (admin-paced) and self-paced surveys.

## Core Value

Participants can instantly vote on questions in a way that feels immersive and tactile — not like filling out a form.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Admin can create a session via a simple unique link (no account required)
- [ ] Admin can add questions to a session with configurable vote types (agree/disagree, multiple choice)
- [ ] Admin can control voting flow: start, end (manual or timer), reveal results
- [ ] Admin can configure per-question whether voting is anonymous or named
- [ ] Participants join via QR code scan — lobby if before start, current question if mid-session
- [ ] Participant voting UI is full-screen, tactile, with large tap targets and satisfying animations
- [ ] Participants can change their vote until they explicitly lock in or the admin ends the round
- [ ] Live visual results display (bar/pie charts) shown when admin reveals
- [ ] Sessions are saved in Supabase — admin can revisit past sessions and results
- [ ] Responsive design works on both desktop and mobile
- [ ] Supports both live presentation mode (admin pushes questions one at a time) and self-paced survey mode
- [ ] QR code generation for easy participant access

### Out of Scope

- User accounts / authentication system — admin uses simple link, no login
- CSV/PDF export of results — live visuals only for v1
- Real-time chat or discussion features — voting only
- 10,000 concurrent user support — v1 targets 50-100, architecture should allow scaling later
- Ranked choice voting — plan for it in architecture, build later
- Participant reasoning/comments on votes — plan for later
- Multi-admin collaborative session management — single admin per session
- Mobile native app — web only, responsive design

## Context

- **Scale trajectory**: v1 handles 50-100 concurrent participants. Architecture should not preclude scaling to 10,000+ later via Supabase Realtime and connection pooling.
- **Session modes**: Two distinct flows — "live presentation" where admin controls pacing and everyone sees the same question, and "self-paced survey" where participants work through questions independently.
- **Immersive UX**: The voting interface should feel app-like — full-screen takeover on mobile, large tactile buttons, satisfying micro-animations on vote selection and lock-in. Not a sterile form.
- **Vote locking**: Participants can freely change their selection during a voting round. They may optionally tap "Lock In" to commit early, otherwise their current selection auto-locks when the admin ends the round.
- **Identity**: Per-question configuration — admin decides whether each question collects names or is fully anonymous.
- **Joining flow**: QR code leads to session URL. If session hasn't started, participant sees a lobby/waiting screen. If session is active, they land on the current question.

## Constraints

- **Stack**: Vite + React (TypeScript), Supabase (database + realtime), Vercel deployment
- **No accounts**: Admin access via unique session links only — no auth system
- **Responsive**: Must work well on both phone screens (primary participant device) and desktop (primary admin device)
- **Accessibility**: Voting interface must be accessible — proper contrast, screen reader support, keyboard navigation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase over lighter alternatives | User preference, provides realtime subscriptions + persistence out of the box | — Pending |
| React over Vue/Svelte | User preference, largest ecosystem | — Pending |
| Simple link auth over accounts | Minimizes friction — admin just shares a link to manage sessions | — Pending |
| Per-question identity config | More flexible than per-session, lets admin mix anonymous and named questions | — Pending |
| v1 scale: 50-100 users | Reduces complexity, lets us ship faster and validate the concept | — Pending |

---
*Last updated: 2026-01-27 after initialization*
