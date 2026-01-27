# Domain Pitfalls

**Domain:** Real-time voting/polling web application (audience response system)
**Stack:** Vite + React (TypeScript), Supabase (database + Realtime), Vercel
**Researched:** 2026-01-27
**Overall confidence:** MEDIUM (based on training knowledge; external docs unavailable for live verification)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamental product failure.

---

### Pitfall 1: Race Conditions on Vote Submission (Duplicate / Lost Votes)

**What goes wrong:** When 50-100 users submit votes within the same 1-2 second window (common in live presentation mode when admin reveals a question), naive INSERT-based voting logic produces duplicates, lost updates, or constraint violations. A user who taps rapidly, or whose phone retries on a flaky connection, can register multiple votes. Without server-side idempotency, the vote tallies become unreliable.

**Why it happens:** Developers handle voting with a simple `INSERT INTO votes` call from the client. There is no uniqueness constraint on (session_id, question_id, participant_id), or the constraint exists but the client has no graceful retry/upsert logic. The "change vote before lock-in" feature further complicates things -- now you need UPDATE-or-INSERT semantics, not just INSERT.

**Consequences:**
- Vote counts are wrong (the core value proposition is broken)
- Admin sees results they cannot trust
- Named voting reveals duplicate entries per person
- Debugging is painful because the problem is intermittent and timing-dependent

**Prevention:**
1. **Database constraint first:** Add a UNIQUE constraint on `(session_id, question_id, participant_id)`. This is your safety net regardless of application logic.
2. **Use UPSERT (ON CONFLICT):** All vote submissions should be `INSERT ... ON CONFLICT (session_id, question_id, participant_id) DO UPDATE SET choice = $new_choice`. This naturally handles both "first vote" and "change vote" in one operation.
3. **Client-side debouncing:** Debounce the vote button (300-500ms) so rapid taps do not fire multiple requests. Disable the button optimistically while the request is in-flight.
4. **Optimistic UI with server reconciliation:** Show the vote as registered immediately, but reconcile with the server response. If the UPSERT returns a conflict or error, revert the UI state.
5. **RLS policy must allow UPDATE on own row:** If you use Row Level Security, make sure the policy permits a participant to UPDATE their own existing vote row, not just INSERT new ones.

**Detection (warning signs):**
- Vote counts exceed participant counts for a question
- Sentry/error logs show unique constraint violations
- Users report "my vote didn't register" (lost in a failed retry)

**Phase mapping:** Must be addressed in the very first phase when the votes table schema is designed. Retrofitting idempotent voting onto a schema without the unique constraint requires a data migration.

**Confidence:** HIGH -- this is a well-documented class of bug in any multi-user write system.

---

### Pitfall 2: Supabase Realtime Subscription Leaks and Reconnection Failures

**What goes wrong:** React components subscribe to Supabase Realtime channels on mount but fail to properly unsubscribe on unmount. Over the course of a session, leaked subscriptions accumulate, consuming the connection's channel slots. Eventually, the client hits Supabase's per-connection channel limit, new subscriptions silently fail, and the app appears to "freeze" -- votes go through but results stop updating in real time.

**Why it happens:** React's useEffect cleanup is easy to get wrong, especially with Supabase's channel API. Common mistakes:
- Forgetting the cleanup return in useEffect
- Subscribing in a component that remounts frequently (e.g., during route changes)
- Creating a new channel reference on every render instead of memoizing it
- Not handling the `CHANNEL_ERROR` and `TIMED_OUT` states, so a dropped connection never re-establishes

**Consequences:**
- Admin's live results dashboard stops updating mid-session (catastrophic during a live presentation)
- Participants' UI shows stale question state -- they do not see the next question arrive
- Memory leaks in the browser degrade performance over a long session
- Debugging is hard because the failure is silent (no error thrown, just no more events)

**Prevention:**
1. **Centralized subscription management:** Do NOT scatter `supabase.channel()` calls across components. Create a single `useRealtimeChannel` hook (or a context provider) that manages the lifecycle. One channel per logical scope (e.g., one for the session, not one per component).
2. **Explicit cleanup in useEffect:** Always return `() => { supabase.removeChannel(channel) }` from useEffect. Verify this runs by adding a console.log during development.
3. **Stable channel references:** Use `useRef` or `useMemo` for the channel object so it is not recreated on every render.
4. **Handle reconnection states:** Listen for `CHANNEL_ERROR` and `TIMED_OUT` status events. Implement exponential backoff reconnection. Supabase Realtime's JS client does some auto-reconnection, but the channel-level subscription may need to be re-established manually after a reconnect.
5. **Connection health indicator:** Show a small "connected/disconnected" indicator in the UI (at least during development). This makes subscription failures immediately visible rather than silently lurking.
6. **Test by toggling network:** During development, use browser DevTools to simulate offline/online transitions and verify the app recovers.

**Detection (warning signs):**
- Results dashboard stops updating but page is still "live"
- Browser DevTools Network tab shows WebSocket frames stopping
- Memory usage climbs steadily during a session
- Console shows "max channels" or subscription errors

**Phase mapping:** Must be addressed when Realtime is first integrated. The subscription management pattern should be established as shared infrastructure before any feature subscribes to channels.

**Confidence:** HIGH -- Supabase Realtime subscription leaks are one of the most frequently reported issues in the Supabase community.

---

### Pitfall 3: Supabase Realtime Rate Limits and Quotas Silently Dropping Messages

**What goes wrong:** Supabase Realtime has per-project rate limits on messages per second. In a voting burst (everyone submits within seconds), the Realtime broadcast or database change events exceed the rate limit. Messages are silently dropped -- there is no error, the events just never arrive. The admin's results chart shows 30 votes when 80 were actually cast.

**Why it happens:** Developers build against 2-3 test users and never hit the limits. The free tier has lower limits (approximately 100 messages/second per project as of training data, but this MUST be verified against current Supabase docs). Even the Pro tier has limits. When 100 users vote in a 2-second window, the database change events from those INSERTs can exceed the broadcast capacity.

**Consequences:**
- Live results are inaccurate (shows fewer votes than actually cast)
- Admin loses trust in the system
- Problem only manifests under real load, never in development
- Difficult to diagnose because there are no errors -- events just vanish

**Prevention:**
1. **Do NOT rely solely on Realtime events for vote counts.** Use Realtime as a notification that "something changed," then fetch the authoritative count from the database via a standard query or an RPC call. Pattern: Realtime event triggers a `SELECT count(*) FROM votes WHERE question_id = $id GROUP BY choice` query.
2. **Debounce result refreshes:** When the admin's results view receives a Realtime event, debounce the re-fetch (e.g., 500ms). This way a burst of 50 events results in 1-2 queries, not 50.
3. **Use Supabase Broadcast for lightweight signals:** Instead of relying on database change events (which have per-row overhead), use Supabase Broadcast channels for "vote count updated" signals, and have clients fetch from the DB.
4. **Consider a server-side aggregate:** Create a Postgres function `get_vote_results(question_id)` that returns the current tally. Call this via RPC. This is more efficient than streaming individual vote rows.
5. **Load test before going live:** Use a simple script that simulates 100 concurrent vote submissions and verify that the results view converges to the correct count within a few seconds.

**Detection (warning signs):**
- Results chart shows fewer votes than participants who claim they voted
- Vote count increments in bursts rather than smoothly (because some events are batched/delayed)
- Supabase dashboard shows Realtime message rate hitting the limit

**Phase mapping:** The "Realtime event as notification, DB as source of truth" pattern should be established in the same phase as live results. Do NOT build live results by accumulating individual Realtime events client-side.

**Confidence:** MEDIUM -- rate limit numbers are from training data and may have changed. The architectural pattern (Realtime as signal, DB as truth) is solid regardless of exact limits.

---

### Pitfall 4: No Server-Side Session/Question State Machine (Invalid State Transitions)

**What goes wrong:** The admin can start voting, end voting, reveal results, and advance to the next question. Without a proper state machine, it becomes possible to reach invalid states: voting on a question that has already been closed, revealing results before voting ends, advancing while votes are still being submitted. The client enforces the flow, but a clever or buggy client can submit votes to a closed question.

**Why it happens:** Developers implement the session flow entirely in the React admin UI -- showing/hiding buttons based on local state. The database has no concept of "this question is in the VOTING state" vs "RESULTS_REVEALED state." Any client can still write to the votes table regardless of the question's lifecycle state.

**Consequences:**
- Late votes sneak in after the admin has "closed" voting (integrity violation)
- Race condition: admin ends voting at the exact moment a participant submits (whose state wins?)
- In self-paced mode, there is no server-enforced boundary between "you can still answer this" and "time is up"
- Impossible to audit what happened during a session

**Prevention:**
1. **Model question lifecycle as a state column in the database:** `questions` table should have a `status` column with values like `pending`, `voting_open`, `voting_closed`, `results_revealed`. Transitions are enforced via RPC functions, not direct column updates.
2. **RLS or RPC enforcement:** The `votes` table INSERT/UPDATE policy should check that the associated question's status is `voting_open`. Use a Postgres function: `CREATE FUNCTION submit_vote(...)` that checks question status before inserting.
3. **Timestamp boundaries:** Record `voting_opened_at` and `voting_closed_at` on each question. Even if a client's state is stale, the server rejects votes outside the window.
4. **Optimistic but verified:** The client can optimistically show "vote submitted" but should handle the server rejecting the vote (because the question was already closed) gracefully -- e.g., "Voting has ended for this question."

**Detection (warning signs):**
- Votes appear with timestamps after the admin closed voting
- Vote counts change after results are revealed
- Participants report being able to vote on questions the admin has moved past

**Phase mapping:** Must be designed in the database schema phase. The `questions.status` column and the RPC function for vote submission are foundational. Retrofitting server-side state enforcement onto a system where clients directly INSERT is painful.

**Confidence:** HIGH -- state machine enforcement is a universal requirement for any multi-step collaborative workflow.

---

### Pitfall 5: Admin Link Security -- Guessable URLs Enable Session Hijacking

**What goes wrong:** The "no accounts" design means admin access is controlled entirely by the URL. If the admin session ID is a short or sequential identifier (e.g., `/admin/session/42`), anyone can guess other admin URLs and take control of sessions -- changing questions, closing votes, viewing results they should not see.

**Why it happens:** Developers use auto-incrementing integer IDs or short UUIDs for session identifiers. The "no auth" design is chosen for simplicity, but without proper URL entropy, it becomes "no security."

**Consequences:**
- Anyone can admin any session by guessing the URL
- Malicious actor can end voting, change questions, or delete a session mid-presentation
- Trust in the platform is destroyed
- Especially dangerous if sessions contain named votes (privacy violation)

**Prevention:**
1. **Use UUIDv4 for session IDs:** Postgres `gen_random_uuid()` produces 128-bit random IDs. These are effectively unguessable (2^122 possibilities).
2. **Separate admin token from session ID:** The session has a public ID (for participants joining via QR code) and a separate admin_token (also UUIDv4). The admin URL contains the admin_token. Participants never see it. Schema: `sessions(id UUID, admin_token UUID, ...)`.
3. **Admin URL format:** `/admin/{admin_token}` where admin_token is a separate column from the session's public ID. The participant URL is `/vote/{session_id}`. These are different identifiers.
4. **RLS enforcement:** Supabase RLS policies for admin-only operations (create question, change question status, delete session) should require the admin_token to be passed, not just the session_id.
5. **Do NOT embed admin_token in the QR code.** The QR code contains only the participant URL with the session's public ID.

**Detection (warning signs):**
- Session IDs are sequential integers
- Admin URL and participant URL share the same identifier
- No RLS policy differentiates admin vs participant access

**Phase mapping:** Must be addressed in the database schema design (Phase 1). The dual-identifier pattern (session_id vs admin_token) is a schema-level decision.

**Confidence:** HIGH -- URL-based auth without entropy is a well-known security anti-pattern.

---

## Moderate Pitfalls

Mistakes that cause significant delays, poor UX, or technical debt.

---

### Pitfall 6: Building the Results View by Accumulating Client-Side Events

**What goes wrong:** The live results chart is built by listening to Realtime INSERT events and incrementing a local counter. This works in testing with 3 users. In production, events arrive out of order, duplicates occur on reconnection, and the count drifts from reality. The admin sees "47 votes" while the database has 52.

**Why it happens:** Accumulating events client-side feels natural and "real-time." But it violates a fundamental principle: the database is the source of truth, not the event stream.

**Prevention:**
- Use Realtime events only as a trigger to re-query the database for current counts.
- Implement a `get_results(question_id)` RPC that returns `{ choice: string, count: number }[]`.
- On each Realtime event (debounced), call this RPC.
- Initialize the chart from the RPC on mount (handles page refresh and late-joining admin).

**Phase mapping:** Same phase as live results implementation.

**Confidence:** HIGH.

---

### Pitfall 7: Participant Identification Without Auth -- The "Who Am I?" Problem

**What goes wrong:** For named voting, the app needs to know who the participant is, but there are no user accounts. Developers reach for localStorage, cookies, or ask the user to type a name. Each approach has issues:
- localStorage: cleared when user opens the link in a different browser/incognito tab
- Cookies: same problem, plus cross-device issues
- Self-reported name: duplicates ("there are three Johns"), no enforcement
- No identification at all: cannot attribute votes to individuals

**Why it happens:** The "no accounts" constraint is great for frictionless joining but creates real tension with named voting.

**Consequences:**
- Two participants can claim the same name -- admin cannot distinguish
- A participant who refreshes the page or reopens the QR link gets a new identity
- Vote attribution breaks -- named votes show "Unknown" or duplicates
- Admin cannot meaningfully review who voted what

**Prevention:**
1. **Generate a participant_id (UUIDv4) on first visit, store in localStorage AND in the URL (as a query param or path segment).** If localStorage is cleared, the URL still carries the identity. If the URL is lost, localStorage still has it.
2. **For named voting, prompt for a display_name on first visit and store it alongside the participant_id.** The participant_id is the true identity; the display_name is just a label.
3. **Store the participant registration server-side:** `participants(id UUID, session_id UUID, display_name TEXT, joined_at TIMESTAMP)`. This creates a server-side record that survives client-side storage loss.
4. **Handle the "rejoining" case:** If a participant revisits the session URL with a known participant_id (from URL param or localStorage), look up their existing record. Do not create a duplicate.
5. **For anonymous questions:** Still track participant_id internally (for de-duplication) but do not display it in results.

**Detection (warning signs):**
- Named vote results show duplicate names
- Participant count keeps growing as people refresh
- Vote count exceeds unique participant count

**Phase mapping:** Must be designed before the voting feature is built. The participant identity flow (join, identify, persist) is foundational.

**Confidence:** HIGH.

---

### Pitfall 8: Vercel Serverless Cold Starts Disrupting Real-Time Experience

**What goes wrong:** If any server-side logic runs on Vercel serverless functions (API routes for creating sessions, RPC proxies, etc.), cold starts add 500ms-2s latency. During a live presentation, the admin clicks "Next Question" and nothing happens for 1-2 seconds. Participants tap "Vote" and the loading spinner persists. The experience feels laggy and broken.

**Why it happens:** Vercel's serverless functions spin down after inactivity. The first request after idle triggers a cold start. In a live voting scenario, the admin might not interact for 30-60 seconds between questions -- enough for functions to go cold.

**Consequences:**
- "Start Voting" button feels broken (admin clicks, nothing happens for 1-2s)
- Participants experience delayed vote confirmation
- The "real-time" promise feels hollow
- Admin loses confidence in the tool during a live presentation

**Prevention:**
1. **Minimize server-side functions:** For v1 with 50-100 users, call Supabase directly from the client using the Supabase JS SDK. Supabase's RLS provides security without needing a server middleman. Avoid Vercel API routes for hot-path operations (voting, question state changes).
2. **If API routes are needed:** Use Vercel Edge Functions (which have near-zero cold start) instead of Node.js serverless functions for latency-sensitive operations.
3. **Preemptive warming:** If using Node.js functions, implement a keep-alive ping from the admin UI that hits the function every 30 seconds while a session is active.
4. **Client-first architecture:** The Supabase JS client connects directly to Supabase via WebSocket (Realtime) and REST (queries/mutations). This bypasses Vercel functions entirely for most operations. Reserve server functions only for operations that MUST be server-side (e.g., generating admin tokens on session creation).

**Detection (warning signs):**
- Intermittent 1-2s delays on admin actions
- First action after inactivity is always slow
- Vercel function logs show cold start times

**Phase mapping:** Architecture decision in Phase 1. Deciding "client calls Supabase directly vs. through Vercel API routes" shapes the entire data flow.

**Confidence:** MEDIUM -- Vercel cold start behavior is well-known, but Edge Functions may have improved sufficiently to mitigate this. Verify current Vercel Edge Function capabilities.

---

### Pitfall 9: Supabase Row Level Security (RLS) Blocking Realtime Subscriptions

**What goes wrong:** You enable RLS on the `votes` table (correctly), but then Supabase Realtime stops delivering change events to subscribers. The admin's live results view goes silent. Votes are being recorded in the database, but the Realtime subscription does not receive the INSERT events.

**Why it happens:** Supabase Realtime's Postgres Changes feature respects RLS policies. If the subscribing client does not have a JWT that satisfies the SELECT policy on the table, Realtime events are filtered out. With "no accounts," participants use the `anon` key, and the RLS policy may not grant SELECT on other participants' votes.

**Consequences:**
- Live results stop working as soon as RLS is enabled
- Developers disable RLS entirely to "fix" it, introducing security holes
- Inconsistent behavior: admin can see results via direct query but not via Realtime

**Prevention:**
1. **Understand that Realtime Postgres Changes respects RLS:** Any client subscribing to table changes will only receive events for rows they can SELECT under RLS.
2. **Design RLS policies with Realtime in mind:**
   - Admin's policy: SELECT on votes WHERE the question belongs to the admin's session (verified via admin_token passed as a custom claim or RPC parameter).
   - Participants: May not need to see individual votes via Realtime at all. They only need to see their own vote (for confirmation).
3. **Use Broadcast instead of Postgres Changes for results:** Instead of having the admin subscribe to `votes` table changes, have the server (or a database trigger/function) broadcast an aggregate result update to a Broadcast channel. Broadcast does not go through RLS.
4. **Alternative pattern:** The admin's results view calls an RPC function on a timer or on Broadcast signal. The RPC function runs with `SECURITY DEFINER` and can read all votes regardless of the caller's RLS context.
5. **Test RLS with Realtime explicitly:** Do not assume "RLS works for queries, so it works for Realtime." Test them separately.

**Detection (warning signs):**
- Realtime subscriptions work, then break after enabling RLS
- Admin receives no events from votes table via Realtime
- Disabling RLS "fixes" the problem

**Phase mapping:** Must be addressed when implementing RLS (which should be before any production deployment). Design the RLS policies and the Realtime subscription strategy together, not separately.

**Confidence:** MEDIUM -- this behavior is documented in Supabase docs but the specifics of Broadcast vs Postgres Changes interaction with RLS should be verified against current documentation.

---

### Pitfall 10: Mobile Browser Viewport and Focus Issues on Voting UI

**What goes wrong:** The "full-screen tactile voting" experience breaks on mobile because:
- The browser's address bar consumes viewport height, making `100vh` taller than the visible area
- When a text input gains focus (e.g., name entry for named voting), the virtual keyboard pushes the page up and the vote buttons disappear below the fold
- iOS Safari's "bounce" scroll creates a rubber-banding effect that makes the UI feel unanchored
- Touch targets smaller than 48x48px are unreliable on mobile

**Why it happens:** Desktop-first development. The app looks great on a laptop, but mobile is the PRIMARY participant device. CSS `100vh` is a notorious mobile gotcha.

**Consequences:**
- Participants cannot see the vote buttons without scrolling
- Voting feels clunky and broken on the primary device
- Named voting name input is unusable because keyboard covers the submit button
- The "immersive, tactile" core value proposition is violated on the device that matters most

**Prevention:**
1. **Use `100dvh` (dynamic viewport height) instead of `100vh`:** The `dvh` unit accounts for the browser chrome. Supported in all modern browsers.
2. **Test on real devices early and often:** Use Chrome DevTools device emulation for quick checks, but ALWAYS test on a real iPhone and Android phone. Emulators do not replicate keyboard/viewport behavior.
3. **Avoid text inputs during voting:** For the voting action itself, use only tappable buttons (no text input). Reserve text input (name entry) for the join/lobby phase where the keyboard is expected.
4. **Minimum touch target: 48x48px** (WCAG 2.5.8). Use padding, not just element size.
5. **Prevent scroll bounce:** Use `overscroll-behavior: none` on the voting container.
6. **Handle the keyboard:** On pages with text input, use `visualViewport` API to detect keyboard presence and adjust layout accordingly. Or use `position: fixed` for critical buttons so they remain visible above the keyboard.
7. **Lock orientation consideration:** For the voting UI, consider suggesting landscape on tablets or ensuring the layout works in both orientations.

**Detection (warning signs):**
- Content is cut off below the fold on phones
- Users report they "can't see the vote button"
- Scrolling is required on what should be a single-screen interface

**Phase mapping:** Address when building the voting UI. This is a "design from mobile-first" concern, not a "fix later" concern.

**Confidence:** HIGH -- mobile viewport issues with `100vh` are extensively documented and universally experienced.

---

### Pitfall 11: QR Code That Breaks on URL Changes

**What goes wrong:** The QR code is generated with a URL like `https://quickvote.vercel.app/session/abc123`. Later, you change the URL structure (e.g., to `/vote/abc123` or add query params). Every printed/shared QR code is now broken. In a live presentation, the admin has already displayed the QR code on a projector slide -- if the app URL changes between development and the presentation, participants scan a dead link.

**Why it happens:** URL structure is treated as an implementation detail rather than a public API. QR codes are "printed URLs" -- once they are out in the world, they cannot be updated.

**Consequences:**
- Participants scan the QR code and get a 404
- Admin is embarrassed during a live presentation
- Session is unusable until a new QR code is generated and re-shared

**Prevention:**
1. **Finalize the participant URL structure early and treat it as frozen:** `/vote/{session_id}` or `/join/{session_id}`. Document it. Do not change it.
2. **Use a redirect layer if needed:** If you must change the internal route, keep the QR code URL as a stable redirect endpoint. e.g., `/join/{session_id}` always redirects to wherever the current voting UI lives.
3. **Include the full domain in the QR code:** Generate the QR code with the production URL, not `localhost`. Have the admin configure or confirm the base URL.
4. **Test the QR code end-to-end:** During development, actually scan the QR code with a phone and verify it loads the correct page.

**Detection (warning signs):**
- QR code URLs use `localhost` or a preview deployment URL
- Route structure changes after QR code generation is implemented
- No redirect fallback for old URLs

**Phase mapping:** Establish the URL structure in the routing/navigation phase and freeze it. QR code generation should reference this frozen URL.

**Confidence:** HIGH.

---

## Minor Pitfalls

Mistakes that cause annoyance or minor rework but are fixable.

---

### Pitfall 12: Chart Library Rendering Performance with Rapid Updates

**What goes wrong:** The live results chart re-renders on every Realtime event. With 50 votes arriving in 2 seconds, the chart re-renders 50 times, causing jank, dropped frames, and a stuttering animation. On mobile devices (which participants may also view results on), this can freeze the browser.

**Prevention:**
- Batch/debounce chart updates: accumulate changes and re-render at most every 300-500ms.
- Use a chart library that supports animated transitions between states (e.g., Framer Motion + custom SVG, or a library like Recharts/Victory that handles data transitions).
- Memoize chart data computation with `useMemo`.
- Consider requestAnimationFrame for smooth update scheduling.

**Phase mapping:** Implement during results visualization phase.

**Confidence:** HIGH.

---

### Pitfall 13: Session Cleanup and Stale Data Accumulation

**What goes wrong:** Every session, question, vote, and participant record lives in Supabase forever. After months of use, the database grows with abandoned test sessions and old data. Queries slow down. Free tier storage fills up.

**Prevention:**
- Add `created_at` timestamps to all tables.
- Implement a soft-delete or archive mechanism for sessions.
- For v1, this is low priority, but design the schema with `created_at` from day one so cleanup is possible later.
- Consider a Supabase cron job (pg_cron) that deletes sessions older than N days (or at least test/abandoned sessions with zero participants).

**Phase mapping:** Add timestamps to schema in Phase 1. Implement cleanup as a post-launch enhancement.

**Confidence:** HIGH.

---

### Pitfall 14: Forgetting Error and Loading States in the Voting Flow

**What goes wrong:** The participant taps a vote button and... nothing visually changes. The request is in flight, but there is no loading indicator, no confirmation, no feedback. The participant taps again (creating a duplicate request). Or worse, the request fails silently, and the participant believes they voted when they did not.

**Prevention:**
- Every user action must have three states: idle, loading, success/error.
- Vote button: idle (tappable) -> loading (disabled, spinner or subtle animation) -> success (visual confirmation, e.g., checkmark, color change, haptic feedback if supported).
- Error state: "Something went wrong, tap to retry."
- Use optimistic updates: show success immediately, revert if the server rejects.
- The "lock in" action should have an especially clear confirmation (animation, sound, or visual flourish) since it is irreversible.

**Phase mapping:** Implement alongside the voting UI in the same phase.

**Confidence:** HIGH.

---

### Pitfall 15: Not Planning the Self-Paced Mode Data Model Upfront

**What goes wrong:** The live presentation mode is built first (admin pushes one question at a time). The data model assumes all participants are on the same question. When self-paced mode is added later, the model does not support individual participant progress through questions. A painful refactor is needed.

**Why it happens:** Live mode is the "exciting" feature. Self-paced mode is deferred as "easy to add later." But the two modes have fundamentally different data access patterns:
- Live mode: one active question, all participants see it
- Self-paced: each participant has their own progress cursor

**Prevention:**
1. **Design the schema for both modes from day one:** Add a `session.mode` column (`live` | `self_paced`).
2. **Track individual participant progress:** `participant_progress(participant_id, session_id, current_question_index)` -- this table is used in self-paced mode, ignored in live mode.
3. **In live mode:** All participants' "current question" is determined by the session's `current_question_id` column.
4. **In self-paced mode:** Each participant's "current question" is determined by their `participant_progress` row.
5. **The voting UI checks:** "What question should I show?" based on session mode -- either the session's current question (live) or the participant's progress (self-paced).

**Detection (warning signs):**
- No `mode` column on sessions table
- No participant progress tracking table
- Live mode works, but adding self-paced mode requires schema changes

**Phase mapping:** Schema design phase. Even if self-paced mode is built in a later phase, the schema must accommodate it from the beginning.

**Confidence:** HIGH.

---

### Pitfall 16: Supabase Anon Key Exposure and API Abuse

**What goes wrong:** The Supabase `anon` key is embedded in the client-side JavaScript (this is by design and expected). However, without proper RLS policies, anyone who extracts this key can:
- Create unlimited sessions
- Submit unlimited votes to any question
- Read all session data
- Delete or modify data

**Why it happens:** Developers know the anon key is "public" but do not internalize what that means: anyone can use the Supabase REST API directly with that key, bypassing the React UI entirely.

**Prevention:**
1. **RLS is mandatory, not optional:** Every table must have RLS enabled with appropriate policies. No table should be fully open.
2. **Votes table:** INSERT only if question status is `voting_open`. UPDATE only own row. SELECT own row only (or aggregate via RPC for results).
3. **Sessions table:** INSERT allowed (anyone can create a session). UPDATE/DELETE only with admin_token.
4. **Questions table:** INSERT/UPDATE/DELETE only with admin_token. SELECT for participants in the session.
5. **Rate limiting:** Supabase does not provide built-in per-user rate limiting. For v1, this is acceptable at 50-100 users. For scaling, consider Vercel Edge Middleware or Supabase Edge Functions for rate limiting vote submissions.
6. **Do NOT store the admin_token in a place where RLS policies would expose it to anon users.** The admin_token should be in a column that is never returned by SELECT policies for non-admin callers.

**Detection (warning signs):**
- Tables have RLS disabled
- No RLS policies reference admin_token
- `select *` from the client returns admin_token columns

**Phase mapping:** RLS policies must be designed alongside the schema (Phase 1) and tested before any deployment.

**Confidence:** HIGH.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database schema design | Pitfall 1 (race conditions), 4 (no state machine), 5 (guessable IDs), 15 (self-paced not planned) | UNIQUE constraints, status columns, UUIDs, mode-aware schema from day one |
| Supabase Realtime integration | Pitfall 2 (subscription leaks), 3 (rate limits), 6 (client-side accumulation), 9 (RLS blocking) | Centralized subscription hook, DB-as-truth pattern, test RLS with Realtime |
| Voting UI implementation | Pitfall 10 (mobile viewport), 14 (missing loading states), 12 (chart jank) | Mobile-first design, 100dvh, debounced chart updates, optimistic UI |
| Security and access control | Pitfall 5 (guessable URLs), 16 (anon key abuse) | Dual UUIDs (session_id + admin_token), RLS on every table |
| Participant identity | Pitfall 7 (who am I?) | Server-side participant record, localStorage + URL param identity |
| Deployment and URLs | Pitfall 8 (cold starts), 11 (QR code breakage) | Client-direct-to-Supabase architecture, frozen URL structure |
| Long-term maintenance | Pitfall 13 (stale data) | Timestamps from day one, cleanup mechanism planned |

---

## Summary of Highest-Priority Actions

The following pitfalls, if not addressed in the initial design phases, will require costly rework:

1. **Schema design must include:** UNIQUE vote constraint, question status state machine, UUIDs for both session_id and admin_token, session mode column, participant progress table, `created_at` on all tables.
2. **Realtime architecture must follow:** "Events as signals, DB as truth" -- never accumulate client-side vote counts from individual events.
3. **RLS must be designed alongside schema** -- not bolted on after features work. Test Realtime subscriptions with RLS enabled from the start.
4. **Mobile-first voting UI** -- use `dvh` units, test on real phones, minimum 48px touch targets.
5. **Freeze participant URL structure** before building QR codes.

---

## Sources

- Supabase official documentation on Realtime, RLS, and quotas (unable to fetch live; claims marked MEDIUM confidence where dependent on specific limits/behavior)
- General software engineering principles for real-time collaborative systems (HIGH confidence)
- Mobile web development best practices (HIGH confidence)
- CSS viewport unit specifications (HIGH confidence)
- WCAG accessibility guidelines for touch targets (HIGH confidence)

**Note:** External documentation sources (Supabase docs, Vercel docs) were unavailable for live verification during this research session. All Supabase-specific claims about rate limits, channel limits, and RLS-Realtime interaction behavior should be verified against current official documentation before finalizing architecture decisions.
