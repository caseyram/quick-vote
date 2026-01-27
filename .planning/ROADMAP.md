# Roadmap: QuickVote

**Created:** 2026-01-27
**Depth:** Quick (3-5 phases)
**Phases:** 5
**Coverage:** 18/18 v1 requirements mapped

## Overview

QuickVote delivers a real-time audience voting application where admins pose questions and participants respond from their phones. The roadmap is structured as five phases: an integration spike to validate the Vercel + Supabase pipeline end-to-end, data foundation and session setup, participant join flow with REST-based voting, realtime infrastructure with live session orchestration, and immersive UI polish with visualization. Each phase produces a demoable checkpoint that builds on the previous.

---

## Phase 1: Integration Spike

**Goal:** The full deployment pipeline is proven end-to-end -- Vite+React app talks to Supabase and is live on Vercel -- before any feature work begins.

**Dependencies:** None (first phase)

**Requirements:** None (infrastructure validation only)

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Vite+React+TS project with Tailwind and Supabase client setup
- [x] 01-02-PLAN.md -- Build integration PoC (read/write, Broadcast, Postgres Changes) and deploy to Vercel

**Success Criteria:**
1. Vite + React + TypeScript project scaffolded with Tailwind CSS
2. Supabase project connected -- can read/write from a test table
3. Deployed to Vercel -- live URL works
4. Supabase Realtime subscription works (simple proof-of-concept)
5. Environment variables properly configured in Vercel

**Research Flags:** LOW risk. Standard toolchain setup. Verify `@supabase/supabase-js` version (v2 vs v3) and Vercel build settings at install time.

---

## Phase 2: Data Foundation and Session Setup

**Goal:** Admin can create a session, add questions, and get a unique admin link -- the data layer is fully operational and secure.

**Dependencies:** Phase 1 (scaffolded project, Supabase connection, deployment pipeline)

**Requirements:** SESS-01, SESS-02, SESS-03

**Success Criteria:**
1. Admin visits the app and creates a new session, receiving a unique admin URL that is not guessable
2. Admin can add questions to the session with a vote type (agree/disagree or multiple choice), edit them, and reorder them
3. Admin can revisit a previously created session via the admin link and see all questions and any past results
4. A separate participant-facing session URL exists that does NOT expose the admin token

**Research Flags:** LOW risk. Standard Supabase/PostgreSQL patterns. Verify Supabase anonymous auth API and `@supabase/supabase-js` version at install time.

---

## Phase 3: Join Flow and Voting Mechanics

**Goal:** Participants can join a session and cast votes that persist correctly -- the complete vote lifecycle works end-to-end without realtime.

**Dependencies:** Phase 2 (schema, session/question CRUD)

**Requirements:** VOTE-01, VOTE-02, VOTE-03, VOTE-04, JOIN-01, JOIN-02, JOIN-03, JOIN-04

**Success Criteria:**
1. Admin can display a QR code that participants scan to join the session on their phone
2. Participants who arrive before the session starts see a lobby/waiting screen
3. Participants can vote agree/disagree on a statement or pick one option from multiple choices, and see visual confirmation their vote was received
4. Participants can change their vote freely until they tap "Lock In" or the round ends
5. Admin can configure each question as anonymous or named, and votes respect that setting

**Research Flags:** LOW risk. Straightforward CRUD + UPSERT patterns. Verify QR code library (`qrcode.react`) renders SVG correctly.

---

## Phase 4: Realtime and Live Session Orchestration

**Goal:** Admin can run a live voting session where participants see questions in real-time, votes update live, and results are revealed on command -- the "magic" that makes this a live polling tool.

**Dependencies:** Phase 3 (voting mechanics, join flow, participant identity)

**Requirements:** LIVE-01, LIVE-02, LIVE-03, LIVE-04

**Success Criteria:**
1. Admin can advance to the next question and all connected participants see the new question appear without refreshing
2. Admin can close voting (manually or via countdown timer) and reveal results, with participants seeing the state change in real-time
3. Results display as a live-updating bar chart that animates as votes arrive
4. Admin can see how many participants are currently connected to the session

**Research Flags:** MEDIUM risk. Supabase Realtime API surface (channel multiplexing, Postgres Changes + RLS interaction, rate limits) needs verification against current docs. This phase benefits from research before planning.

---

## Phase 5: Immersive UI and Polish

**Goal:** The voting experience feels app-like and tactile -- full-screen, animated, responsive -- transforming a functional tool into QuickVote's core identity.

**Dependencies:** Phase 4 (realtime infrastructure, live session flow)

**Requirements:** UIEX-01, UIEX-02, UIEX-03

**Success Criteria:**
1. Voting UI takes over the full screen on mobile with large tap targets and satisfying press/release animations on vote selection and lock-in
2. The app works well on both phone screens (participant voting) and desktop screens (admin controls and results display)
3. A connection status indicator shows participants whether they are connected or disconnected from the live session

**Research Flags:** LOW for responsive layout. MEDIUM for complex Motion/framer-motion gesture animations. Verify package name (`motion` vs `framer-motion`) at install time.

---

## Progress

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Integration Spike | (none -- infrastructure) | ✓ Complete |
| 2 | Data Foundation and Session Setup | SESS-01, SESS-02, SESS-03 | Not Started |
| 3 | Join Flow and Voting Mechanics | VOTE-01, VOTE-02, VOTE-03, VOTE-04, JOIN-01, JOIN-02, JOIN-03, JOIN-04 | Not Started |
| 4 | Realtime and Live Session Orchestration | LIVE-01, LIVE-02, LIVE-03, LIVE-04 | Not Started |
| 5 | Immersive UI and Polish | UIEX-01, UIEX-02, UIEX-03 | Not Started |

## Coverage Map

| Requirement | Phase | Description |
|-------------|-------|-------------|
| SESS-01 | 2 | Admin can create session via unique link |
| SESS-02 | 2 | Admin can add, edit, reorder questions |
| SESS-03 | 2 | Sessions persisted in Supabase |
| VOTE-01 | 3 | Agree/Disagree voting |
| VOTE-02 | 3 | Multiple choice voting |
| VOTE-03 | 3 | Vote change until lock-in |
| VOTE-04 | 3 | Per-question anonymous/named config |
| JOIN-01 | 3 | QR code join |
| JOIN-02 | 3 | Lobby/waiting screen |
| JOIN-03 | 3 | Mid-session join lands on current question |
| JOIN-04 | 3 | Vote confirmation feedback |
| LIVE-01 | 4 | Admin advances questions, closes voting, reveals results |
| LIVE-02 | 4 | Optional countdown timer |
| LIVE-03 | 4 | Live-updating bar chart results |
| LIVE-04 | 4 | Admin sees participant count |
| UIEX-01 | 5 | Full-screen tactile voting UI with animations |
| UIEX-02 | 5 | Responsive design (phone + desktop) |
| UIEX-03 | 5 | Connection status indicator |

**Mapped: 18/18 -- No orphaned requirements.**
**Note:** Phase 1 (Integration Spike) has no requirements mapped -- it is pure infrastructure validation.

---
*Roadmap created: 2026-01-27*
*Revised: 2026-01-27 -- Added Phase 1 integration spike per user feedback, renumbered phases 2-5*
*Updated: 2026-01-27 -- Phase 1 plans created (2 plans, 2 waves)*
*Updated: 2026-01-27 -- Phase 1 complete (verified 5/5 success criteria)*
