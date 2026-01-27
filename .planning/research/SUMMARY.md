# Research Summary

**Project:** QuickVote -- Real-time audience voting web application
**Synthesized:** 2026-01-27
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

QuickVote is a real-time audience voting application positioned between lightweight single-poll tools (Strawpoll) and enterprise polling platforms (Mentimeter, Slido). The expert-recommended approach is a client-heavy SPA architecture: React 19 + Vite 6 on Vercel as the frontend, with Supabase serving as the entire backend (PostgreSQL database, Realtime WebSocket channels, anonymous auth, and Row Level Security). No custom backend server is needed for v1. The critical architectural insight is that Supabase Realtime provides three distinct mechanisms -- Broadcast for ephemeral admin commands, Postgres Changes for vote stream notifications, and Presence for participant counting -- and using the right one for each purpose is the difference between a robust system and a fragile one.

The primary risks are concentrated in two areas: data integrity under concurrent writes, and Realtime subscription management in React. Vote submission must be idempotent from day one (UNIQUE constraints + UPSERT), and the results view must treat the database as source of truth rather than accumulating client-side events. Supabase Realtime subscription leaks in React components are the most commonly reported issue in the Supabase community and require a centralized subscription management pattern established before any feature code is written. Additionally, the "no accounts" design means URL security is paramount -- the admin token must be a separate, high-entropy UUID that never appears in participant-facing URLs or QR codes.

QuickVote's differentiators are clear: zero-account admin experience (no competitor offers this), full-screen tactile voting UI with satisfying animations (the product's identity), per-question anonymity configuration (genuinely rare), and vote-change-until-lock-in (better UX than competitors). The MVP must ship with the tactile UI -- it is not polish, it is the product. Deferring animations to "later" would ship a product indistinguishable from a Google Form.

---

## Key Findings

### From STACK.md

| Technology | Role | One-Line Rationale |
|------------|------|-------------------|
| React 19 + Vite 6 + TypeScript | Core framework | Project constraint; React 19 transitions keep UI responsive during vote floods |
| Supabase (hosted) | Entire backend | Database + Realtime + Auth in one service; no custom server needed |
| Tailwind CSS v4 | Styling | Zero-runtime utility CSS; critical for mobile performance on participant devices |
| React Router v7 | Routing | Standard SPA routing for admin/participant/results views |
| Zustand | Client state | Lightweight selector-based subscriptions; avoids Context re-render storms during rapid vote updates |
| Recharts | Charts | SVG-based React components; styleable with Tailwind, animatable for live updates |
| Motion (framer-motion) | Animations | Gesture support (whileTap, drag) essential for tactile voting; layout animations for results |
| qrcode.react | QR codes | SVG output stays crisp on projectors; pure React component |
| nanoid | Session IDs | URL-friendly 21-char IDs instead of ugly 36-char UUIDs for participant-facing URLs |

**Critical version note:** Verify at install time whether `@supabase/supabase-js` v3 has shipped (may have breaking channel API changes) and whether the animation library package name is `motion` or `framer-motion`.

**Explicitly rejected:** Next.js (SPA is correct; no SSR needed), Redux (overkill; state is mostly server-driven), Socket.IO (redundant with Supabase Realtime), component libraries (fight against the custom immersive UI vision), CSS-in-JS (runtime cost hurts mobile).

### From FEATURES.md

**Table Stakes (must ship in MVP):**
1. Session creation with unique admin link
2. Multi-question management (add, edit, reorder)
3. Two vote types: agree/disagree and multiple choice
4. QR code join flow with lobby/waiting screen
5. Admin voting controls (start, stop, reveal, timer)
6. Live-updating bar chart results
7. Session persistence and history
8. Vote confirmation feedback (participants need to know it worked)
9. Participant count visible to admin

**Planned Differentiators (ship in MVP -- these ARE the product):**
1. Full-screen tactile voting UI with animations -- QuickVote's soul
2. Zero-account admin experience -- no competitor has this
3. Per-question anonymous vs. named configuration -- genuinely rare
4. Vote change until explicit lock-in -- better UX than competitors

**Defer to post-MVP:**
- Self-paced survey mode (nail live mode first)
- Pie chart option, CSV export, session sharing
- Ranked choice voting, word clouds, open-ended text
- Presentation tool integrations, custom branding

**Anti-features (deliberately never build):**
- Participant accounts (kills instant-join)
- Complex admin dashboard (kills simplicity)
- Presentation builder (scope trap)
- Real-time chat (moderation burden)
- Email collection (trust destroyer)

### From ARCHITECTURE.md

**Core pattern:** Asymmetric broadcast-and-collect. One admin broadcasts state changes to many participants; many participants write votes that aggregate back to admin's view.

**Three Supabase Realtime mechanisms, each for a specific purpose:**
- Broadcast: Admin pushing session state transitions (low-latency, ephemeral)
- Postgres Changes: Vote stream notifications for live result tallying
- Presence: Participant count in lobby

**Session state machine:**
```
LOBBY -> QUESTION_ACTIVE -> VOTING_CLOSED -> RESULTS_REVEALED -> (next question or SESSION_ENDED)
```

**Four essential patterns:**
1. Optimistic UI for vote submission (show success immediately, revert on error)
2. Dual write for state (Broadcast for instant delivery + DB for late-joiner persistence)
3. Participant reconciliation on connect (REST fetch current state, then subscribe to Realtime)
4. Idempotent vote insertion (UPSERT with UNIQUE constraint)

**Key schema decisions:**
- Separate `session_id` (public, for participants) from `admin_token` (secret, for admin URL)
- `questions.status` column enforces lifecycle state machine at DB level
- `UNIQUE(question_id, participant_id)` prevents double-voting at DB level
- Single Supabase channel per session multiplexing Broadcast + Presence + Postgres Changes

**Client-side aggregation is correct for v1 (50-100 users).** Server-side aggregation not needed until 500+ concurrent voters.

**State management disagreement:** ARCHITECTURE.md recommends React Context + useReducer; STACK.md recommends Zustand. **Resolution: Use Zustand.** The selector-based subscription model prevents re-render storms when vote counts update rapidly across many participants. Context would cause all consumers to re-render on any state change. Zustand's 1KB overhead is negligible.

### From PITFALLS.md

**Top 5 critical/high-impact pitfalls:**

| # | Pitfall | Severity | Prevention |
|---|---------|----------|------------|
| 1 | Race conditions on vote submission (duplicates/lost votes) | CRITICAL | UNIQUE constraint + UPSERT + client debounce from day one |
| 2 | Supabase Realtime subscription leaks in React | CRITICAL | Centralized `useRealtimeChannel` hook; never scatter channel subscriptions across components |
| 3 | Realtime rate limits silently dropping messages | CRITICAL | Use Realtime events as "something changed" signals; always query DB for authoritative counts |
| 4 | No server-side state machine (invalid state transitions) | CRITICAL | `questions.status` column + RPC function that validates transitions before writing |
| 5 | Admin link security (guessable URLs = session hijacking) | CRITICAL | Separate UUIDv4 admin_token from public session_id; RLS enforces admin_token for mutations |

**Moderate pitfalls to plan for:**
- Results view accumulating client-side events instead of querying DB (leads to count drift)
- Participant identity fragility with localStorage-only approach (needs server-side participant record)
- RLS blocking Realtime subscriptions (test RLS + Realtime together from the start)
- Mobile viewport issues with `100vh` (use `100dvh`, test on real devices)
- QR code URLs breaking on route changes (freeze URL structure early)

---

## Implications for Roadmap

Based on the combined research, the build should follow 6 phases. The ordering is driven by technical dependencies (each phase builds on the previous) and risk mitigation (address critical pitfalls early).

### Phase 1: Data Foundation and Supabase Setup

**Rationale:** Everything depends on the database schema. Five of the top pitfalls (vote races, state machine, admin security, self-paced planning, stale data) are schema-level decisions. Getting the schema wrong means rework of every subsequent phase.

**Delivers:**
- Supabase project configuration
- Database schema (sessions, questions, votes tables with all constraints, indexes, status columns, timestamps)
- RLS policies designed and tested
- Type generation (`supabase gen types typescript`)
- Session CRUD (admin creates session, gets admin link)
- Question CRUD (admin adds/edits/reorders questions)

**Features from FEATURES.md:** Session creation with unique admin link, question management
**Pitfalls to address:** #1 (UNIQUE vote constraint), #4 (status state machine), #5 (admin_token separation), #15 (self-paced mode column), #16 (RLS on every table), #13 (timestamps)

**Research needed:** LOW -- standard Supabase/PostgreSQL patterns. Verify current Supabase anonymous auth API.

### Phase 2: Participant Join Flow and Identity

**Rationale:** Participants must be able to reach the session before they can vote or see realtime updates. The participant identity system is foundational for vote de-duplication.

**Delivers:**
- Participant join page (QR scan or link entry)
- Participant identity generation (localStorage UUID + server-side participant record)
- QR code generation on admin view
- Lobby/waiting screen for participants
- Frozen URL structure for participant-facing routes

**Features from FEATURES.md:** QR code join, no-app-install web experience, lobby screen
**Pitfalls to address:** #7 (participant identity), #11 (QR URL stability)

**Research needed:** LOW -- straightforward implementation. Verify Supabase anonymous auth setup steps.

### Phase 3: Voting Mechanics (REST-Only, No Realtime Yet)

**Rationale:** Get voting working end-to-end without realtime complexity. This creates a testable, demoable checkpoint: admin creates session + questions, participant joins and votes, admin queries results. Validates the entire data model before adding realtime.

**Delivers:**
- Vote submission via REST (UPSERT with idempotency)
- Vote change before lock-in
- Vote confirmation feedback (optimistic UI with error handling)
- Results query (admin can see aggregated results via REST, not live)
- Per-question anonymous vs. named voting

**Features from FEATURES.md:** Vote submission, vote change until lock-in, vote confirmation, per-question anonymity
**Pitfalls to address:** #1 (idempotent votes), #14 (loading/error states), #10 (mobile viewport -- start here)

**Research needed:** LOW -- standard CRUD with UPSERT patterns.

### Phase 4: Realtime Layer

**Rationale:** Realtime is the "magic" that makes this a live polling tool rather than a form. It adds complexity, so it is layered on top of working REST mechanics. The centralized subscription management pattern must be established here before any feature uses it.

**Delivers:**
- Centralized `useRealtimeChannel` hook (single channel per session)
- Postgres Changes subscription for vote stream (admin sees live counts)
- Broadcast subscription for session state transitions
- Presence for participant count in lobby
- Connection health indicator (connected/disconnected)
- "Events as signals, DB as truth" pattern for results

**Features from FEATURES.md:** Live-updating results, participant count, real-time question push
**Pitfalls to address:** #2 (subscription leaks), #3 (rate limits/dropped messages), #6 (client-side accumulation), #9 (RLS blocking realtime)

**Research needed:** MEDIUM -- Verify current Supabase Realtime API surface, channel multiplexing support, rate limits, and RLS interaction with Postgres Changes. This phase benefits from `/gsd:research-phase`.

### Phase 5: Live Session Orchestration

**Rationale:** This is the "live presentation" experience that ties together all previous layers. It implements the session state machine in the UI and the Broadcast-driven participant synchronization.

**Delivers:**
- Admin session state machine UI (advance question, close voting, reveal results, end session)
- Participant state rendering (receives Broadcast, shows correct view per state)
- Late-joiner reconciliation (REST fetch + Realtime subscribe)
- Timer for voting rounds
- Admin controls when results are visible

**Features from FEATURES.md:** Admin voting controls, timer, admin result reveal control, full live session flow
**Pitfalls to address:** #4 (state machine enforcement end-to-end), #8 (avoid Vercel cold starts -- client-direct-to-Supabase)

**Research needed:** LOW -- builds on Phase 4 infrastructure with well-understood state machine patterns.

### Phase 6: Polish, Visualization, and Immersive UI

**Rationale:** The tactile UI and animations are QuickVote's identity, but they require the voting and realtime infrastructure to be working first. This phase transforms a functional app into the product's core value proposition. Note: basic mobile-first layout should be established in Phase 3, but the animation layer and chart polish happen here.

**Delivers:**
- Full-screen tactile voting UI with Motion animations (vote press, lock-in, reveal)
- Bar chart visualization with Recharts (animated transitions as votes arrive)
- Session summary view (all questions + results after session ends)
- Session history / list of past sessions
- Mobile optimization passes (100dvh, touch targets, overscroll-behavior)

**Features from FEATURES.md:** Tactile voting UI (core differentiator), live chart visualization, session history
**Pitfalls to address:** #10 (mobile viewport), #12 (chart rendering performance -- debounce updates)

**Research needed:** LOW for charts (Recharts is well-documented). MEDIUM for complex Motion animations (gesture-driven voting, coordinated sequences). Consider `/gsd:research-phase` if the animation requirements are ambitious.

---

## Research Flags

### Phases needing `/gsd:research-phase` during planning:

- **Phase 4 (Realtime Layer):** Supabase Realtime API may have changed since training data. Channel multiplexing, RLS interaction with Postgres Changes, and rate limits all need verification against current docs. This is the highest-risk phase from a "things may not work as documented" perspective.

### Phases with standard, well-documented patterns (skip research):

- **Phase 1 (Data Foundation):** Standard PostgreSQL schema design + Supabase setup. Well-trodden path.
- **Phase 2 (Join Flow):** Standard SPA routing + QR code generation. No novel patterns.
- **Phase 3 (Voting Mechanics):** CRUD + UPSERT patterns. Straightforward.
- **Phase 5 (Live Orchestration):** State machine pattern is well-understood; builds on Phase 4 infrastructure.
- **Phase 6 (Polish):** Recharts and Motion are mature libraries with good documentation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (choices), MEDIUM (versions) | Library selections are sound and well-reasoned. Exact versions need verification at install time. Check `motion` vs `framer-motion` package name, `@supabase/supabase-js` v2 vs v3. |
| Features | MEDIUM-HIGH | Table stakes and differentiators are well-identified from competitive analysis. Competitor feature sets based on training data (early 2025) -- products may have added features since. Anti-features list is HIGH confidence (structural domain patterns). |
| Architecture | MEDIUM | Core patterns (broadcast-and-collect, dual-write, idempotent votes) are HIGH confidence. Supabase-specific details (channel multiplexing, Realtime rate limits, anonymous auth availability, RLS-Realtime interaction) are MEDIUM to LOW confidence -- these depend on current Supabase implementation and must be verified against live docs. |
| Pitfalls | HIGH | The identified pitfalls are well-documented engineering patterns (race conditions, subscription leaks, mobile viewport). Prevention strategies are actionable. Supabase-specific rate limit numbers are MEDIUM confidence. |

### Gaps to Address During Planning

1. **Supabase Realtime current limits:** Rate limits, concurrent connection limits, and per-project channel limits may have changed. Must verify before finalizing the results view architecture.
2. **Supabase anonymous auth API:** Availability and current API surface need verification. This affects the RLS strategy.
3. **`@supabase/supabase-js` v3 status:** May have shipped with breaking changes to channel subscription syntax.
4. **Motion package name:** `motion` vs `framer-motion` -- check npm at install time.
5. **RLS + Realtime Postgres Changes interaction:** Documented as working but needs hands-on verification. If RLS blocks Realtime events, the fallback is Broadcast + RPC (documented in ARCHITECTURE.md and PITFALLS.md).
6. **State management resolution:** STACK.md recommends Zustand; ARCHITECTURE.md recommends Context+useReducer. This summary recommends Zustand based on the re-render argument. Finalize during Phase 1.

---

## Sources

Aggregated from all research files. All findings are based on training data (cutoff May 2025). WebSearch and WebFetch were unavailable during research.

**High-confidence sources:**
- Standard PostgreSQL patterns (UNIQUE constraints, UPSERT, indexes)
- React component lifecycle and state management patterns
- Mobile web development best practices (viewport units, touch targets, WCAG)
- General real-time systems architecture (idempotency, event sourcing vs. state)
- CSS specifications (dvh units, overscroll-behavior)

**Medium-confidence sources:**
- Supabase documentation (Realtime, RLS, anonymous auth) -- as of early 2025
- Library version numbers (React 19, Vite 6, Tailwind v4, React Router v7)
- Supabase rate limits and connection quotas

**Low-confidence sources:**
- Supabase free tier specific limits (may have changed)
- Supabase anonymous auth current API surface
- Exact Supabase Realtime behavior with RLS for Postgres Changes subscriptions

**Verification actions before development:**
1. Review current Supabase Realtime documentation
2. Run `npm view` for all major dependencies to confirm versions
3. Test Supabase anonymous auth + RLS + Realtime in a throwaway project before committing to the pattern
