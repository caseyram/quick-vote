# Pitfalls: Batch Questions & Collections for QuickVote v1.1

**Domain:** Adding self-paced batch mode and collections to an existing live polling app
**Stack:** Vite + React (TypeScript), Supabase (database + Realtime), Zustand
**Researched:** 2026-01-28
**Overall confidence:** MEDIUM-HIGH (based on codebase analysis, web research, and domain knowledge)

---

## Context

QuickVote v1.0 has a working live polling system where the admin pushes one question at a time and all participants see the same question simultaneously. v1.1 adds:

1. **Self-paced batch mode** - Participants work through questions at their own pace
2. **Collections** - Named, reusable groups of questions
3. **Collection import/export** - JSON-based sharing
4. **Progress tracking** - Admin dashboard showing participant completion
5. **Batch review navigation** - Participants can navigate between questions
6. **Results improvements** - Mark as read, consistent ordering

This document covers pitfalls specific to ADDING these features to the existing system.

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamental feature failure.

---

### Pitfall 1: Mode Confusion -- Participants Don't Know Whether to Wait or Proceed

**Severity:** CRITICAL

**What goes wrong:** A participant joins a session but cannot tell if they should wait for the admin to push questions (live mode) or start answering immediately (batch mode). They sit idle during a self-paced session, or they tap frantically trying to advance during a live session. The UI looks the same in both modes, leading to confusion and frustration.

**Why it happens:** Developers focus on implementing mode mechanics (live vs batch) but treat the participant UI as an afterthought. The existing live-mode UI shows "waiting for question" which is also valid for batch mode pre-start, making the states indistinguishable.

**Consequences:**
- Participants in batch mode don't realize they can proceed at their own pace
- Participants in live mode try to navigate forward (confused by batch UI elements)
- Admin gets questions like "Is it working?" and "What do I do?"
- The "intuitive, immersive" experience breaks down

**Warning signs (how to detect early):**
- User testing shows hesitation at session start
- Admin receives questions about whether the session is active
- Participants complete batch sessions much slower than expected
- Support requests mention "stuck" or "waiting"

**Prevention:**
1. **Visual differentiation at entry:** Batch sessions should show a clear "Work at your own pace" indicator with a progress bar (e.g., "Question 1 of 10"). Live sessions show "Waiting for host" with no progress bar.
2. **Explicit mode indicator:** Add a persistent badge or label: "Self-paced" vs "Live" visible on every screen.
3. **Different entry animations:** Batch mode could show all questions as a stack the participant will work through. Live mode shows a single question placeholder.
4. **First-time participant tutorial:** On batch session join, briefly show instructions: "Answer each question at your own pace. Use arrows to navigate."
5. **Test with users who haven't seen either mode:** Watch where they get confused.

**Phase to address:** Participant UI phase. Must be addressed when building the batch-mode participant experience, not retrofitted later.

**Confidence:** HIGH -- mode confusion is well-documented in apps that support both synchronous and asynchronous workflows (see [Vevox's separation of live polling vs surveys](https://help.vevox.com/hc/en-us/articles/360010481817-Live-polling-vs-surveys-what-s-the-difference)).

---

### Pitfall 2: Progress State Inconsistency Between Client and Server

**Severity:** CRITICAL

**What goes wrong:** In batch mode, each participant has their own progress (current question, which questions answered). The client tracks progress locally for responsive navigation, but the server is the source of truth. When these diverge -- due to network issues, page refresh, or multi-device access -- the participant sees incorrect progress, duplicate submissions occur, or answered questions appear unanswered.

**Why it happens:** The existing live-mode architecture has no per-participant progress tracking (everyone is on the same question). Adding batch mode requires new state that must be synchronized. Developers either:
- Track progress only client-side (breaks on refresh)
- Track only server-side (laggy navigation)
- Track both but don't reconcile (inconsistency)

**Consequences:**
- Participant refreshes page and loses progress (appears to start over)
- Participant answers a question, navigates away, returns, and sees it as unanswered
- Admin's progress dashboard shows different data than participant's UI
- Multi-tab or multi-device usage creates duplicate votes

**Warning signs:**
- Progress resets on page refresh
- "Already answered" badge doesn't appear for questions participant remembers answering
- Admin dashboard progress differs from participant self-report
- Duplicate votes from same participant_id in database

**Prevention:**
1. **Server-side progress table:** Create `participant_progress(participant_id, session_id, current_question_index, last_answered_question_id, updated_at)`. This is the authoritative source.
2. **Client initializes from server:** On mount (and reconnect), fetch current progress from server before rendering the question list.
3. **Optimistic navigation, server confirmation:** Navigating to next question updates client state immediately, but also writes to server. If server write fails, show error and allow retry.
4. **Progress derived from votes:** As a secondary check, the participant's answered questions can be derived from their votes in the database. `current_question_index` in the progress table is just a "bookmark" -- the votes themselves are ground truth for "what has been answered."
5. **Handle multi-tab/multi-device:** The progress table has a `updated_at` timestamp. If a client's local progress is stale (older than server), it should refresh from server, not overwrite.
6. **Test the refresh scenario explicitly:** During development, after answering 3 questions, refresh the page. Verify progress is preserved.

**Phase to address:** Data foundation phase. The progress tracking schema must be designed before building the participant batch UI.

**Confidence:** HIGH -- state synchronization is a fundamental challenge in offline-capable or multi-device apps.

---

### Pitfall 3: Collection Import Fails Silently or Corrupts Data

**Severity:** CRITICAL

**What goes wrong:** A user imports a JSON file that is malformed, uses an old schema, or contains invalid question types. The import either fails with an unhelpful error, silently skips invalid questions, or worse -- inserts corrupted data that breaks the session.

**Why it happens:** The existing import (in `ImportExportPanel.tsx`) uses `jsonToTemplates()` which may not validate thoroughly. JSON from external sources (users sharing templates, copy-paste from other tools) often has:
- Extra/missing fields
- Wrong data types (string instead of array for options)
- Invalid enum values (typo in `type` field)
- Encoding issues (smart quotes, BOM, etc.)

**Consequences:**
- Users report "import doesn't work" (unclear error)
- Questions import with null or undefined values, breaking the voting UI
- Options array is empty when it should have values, causing crashes
- Admin loses trust in the import feature

**Warning signs:**
- Import succeeds but questions look wrong or incomplete
- Voting UI crashes when rendering an imported question
- Import error message is generic ("Invalid JSON" without details)
- Questions have `null` or empty fields that should be required

**Prevention:**
1. **Schema validation with detailed errors:** Use a validation library (e.g., Zod, Yup, or manual validation) that produces per-field error messages. Example: "Question 3: 'type' must be 'agree_disagree' or 'multiple_choice', got 'likert'"
2. **Validate before insert:** All validation happens before any database writes. Either all questions import or none do (atomic).
3. **Type coercion and normalization:** Handle common variations gracefully:
   - Trim whitespace from text fields
   - Accept both `"anonymous": true` and `"anonymous": "true"` (string)
   - Normalize `options: null` and `options: []` both to null for agree_disagree
4. **Preview before import:** Show a preview of what will be imported with warnings for any coerced/fixed values. Let user confirm.
5. **Export format versioning:** Include a `"version": 1` field in exports. If a future version changes the schema, the import can detect and handle old formats.
6. **Encoding handling:** Strip BOM, normalize line endings, handle UTF-8 variations. The [CSV import literature](https://www.oneschema.co/blog/advanced-csv-import-features) highlights encoding as a common silent failure.

**Phase to address:** Collection management phase. Validation must be built alongside the import feature.

**Confidence:** HIGH -- import validation issues are a known source of bugs across many domains (see [Flatfile's CSV import errors](https://flatfile.com/blog/top-6-csv-import-errors-and-how-to-fix-them/)).

---

### Pitfall 4: Live and Batch Modes Share State They Shouldn't

**Severity:** CRITICAL

**What goes wrong:** The existing session store (`session-store.ts`) has `activeQuestionId` which represents "the current question the admin is showing" in live mode. In batch mode, there's no single active question -- each participant has their own position. If batch mode accidentally reads or writes `activeQuestionId`, it creates bizarre behavior: one participant navigating changes what another sees, or the admin's dashboard shows the wrong "current" state.

**Why it happens:** Developers extend the existing store without thinking about which state is mode-specific. The temptation is to reuse existing patterns ("activeQuestionId already exists, I'll just use it for batch too").

**Consequences:**
- Participant A navigates to question 5, and participant B's UI jumps to question 5
- Admin's "active question" indicator makes no sense in batch mode
- Realtime broadcasts for live mode interfere with batch sessions
- Race conditions when one participant's action affects global state

**Warning signs:**
- Console logs show `setActiveQuestionId` being called in batch mode
- Multiple participants' navigation appears coupled
- Admin control bar shows a "current question" in batch mode that changes erratically

**Prevention:**
1. **Clearly separate live-mode state from batch-mode state:** In the store, have:
   - `activeQuestionId` -- only used in live mode, represents admin's broadcast question
   - `participantProgress: { currentIndex: number, answeredIds: string[] }` -- only used in batch mode, per-participant
2. **Mode-check guards:** Functions that read/write mode-specific state should assert the session mode first. `setActiveQuestionId` should throw if called on a batch session.
3. **Document state ownership:** Add comments in the store: "// LIVE MODE ONLY" or "// BATCH MODE ONLY".
4. **Test both modes in isolation:** Write tests that verify batch mode never touches live-mode state and vice versa.
5. **Consider separate stores:** If complexity grows, batch-mode participant state could live in a separate store from the admin/live-mode state.

**Phase to address:** Early in batch mode implementation. State architecture must be clarified before building navigation.

**Confidence:** HIGH -- mixing modal state is a common source of bugs in apps with multiple interaction modes (see [state management challenges](https://dev.to/rakshyak/avoiding-state-inconsistencies-the-pitfall-of-multiple-react-context-providers-4e29)).

---

## Moderate Pitfalls

Mistakes that cause significant delays, poor UX, or technical debt.

---

### Pitfall 5: Batch Navigation Loses Vote State on Question Change

**Severity:** MODERATE

**What goes wrong:** In batch mode, the participant answers question 1, navigates to question 2, then navigates back to question 1 -- but their answer is gone. The vote was only in local component state, not persisted to the server or store, so navigation unmounts the component and loses the data.

**Why it happens:** The existing voting components (`VoteAgreeDisagree`, `VoteMultipleChoice`) likely submit immediately on tap (per PROJECT.md: "Votes submit immediately on tap"). For batch mode with review capability, the vote needs to persist across navigation while still allowing changes before final submission.

**Consequences:**
- Participants re-answer questions they already answered
- Confusion about whether votes are saved
- Potential data loss if user exits mid-session

**Warning signs:**
- Navigating away and back shows no selection
- "Your answer" indicator doesn't appear when returning to a question
- Duplicate vote submissions when participant re-answers

**Prevention:**
1. **Submit votes to server immediately (existing behavior is good):** The vote is persisted on tap, so it survives navigation. The server has the vote even if the component unmounts.
2. **Load existing vote when rendering question:** When navigating to a question, check if a vote exists for `(participant_id, question_id)`. If yes, pre-populate the selection and show "Already answered" indicator.
3. **Allow vote changes:** The UPSERT pattern already supports changing a vote. Make the UI clear: "Change your answer" or similar.
4. **Store answered state in Zustand:** Track which questions have been answered locally for instant UI feedback, but verify against server on load.
5. **Distinguish "answered" from "current selection":** The component should show: current selection (from store/server), whether it's been submitted, and ability to change.

**Phase to address:** Batch navigation implementation phase.

**Confidence:** HIGH -- this is a direct consequence of component unmounting behavior in React.

---

### Pitfall 6: Progress Dashboard Polls Database Inefficiently

**Severity:** MODERATE

**What goes wrong:** The admin's progress dashboard needs to show real-time completion status for potentially 50-100 participants across 10-20 questions. A naive implementation fetches all votes and computes progress client-side, or makes N queries (one per participant). This causes:
- Slow dashboard load
- Database load spikes
- Supabase rate limit issues at scale

**Why it happens:** Developers build the simplest thing first: "fetch all votes, count in JS." This works for 5 participants in testing but degrades at real scale.

**Consequences:**
- Dashboard takes 5+ seconds to load
- Dashboard updates lag behind actual progress
- Database queries time out under load
- Supabase bill increases due to excessive reads

**Warning signs:**
- Dashboard loading spinner visible for more than 1-2 seconds
- Progress numbers feel "behind" -- participant finishes but dashboard doesn't update
- Network tab shows large vote payloads or many sequential requests
- Supabase dashboard shows query spikes during sessions

**Prevention:**
1. **Server-side aggregation:** Create a Postgres function or view: `get_session_progress(session_id)` that returns `{ participant_id, answered_count, total_questions }[]` in a single query. Use `COUNT(DISTINCT question_id) FROM votes WHERE session_id = $1 GROUP BY participant_id`.
2. **Denormalized progress tracking:** Maintain a `participant_progress` table that is updated via trigger or application code when a vote is submitted. Query this table instead of aggregating votes.
3. **Incremental updates via Realtime:** Subscribe to vote inserts, but don't re-fetch everything. Instead, increment the local count for the relevant participant. Use debouncing for burst scenarios.
4. **Polling with debounce:** If Realtime is complex, simple polling every 5 seconds with the aggregation query is acceptable for 50-100 participants.
5. **Pagination/virtualization if showing detailed view:** If the dashboard lists every participant, virtualize the list. Don't render 100 rows if only 10 are visible.

**Phase to address:** Progress dashboard implementation phase.

**Confidence:** HIGH -- N+1 query problems are well-documented.

---

### Pitfall 7: Collection Naming Collisions and Orphaned Collections

**Severity:** MODERATE

**What goes wrong:** An admin creates a collection named "Team Retrospective" then creates another one with the same name. The system either allows duplicates (confusing) or silently overwrites (data loss). Additionally, if a collection is created but never used or linked to a session, it becomes orphaned and clutters the collection list.

**Why it happens:** Collection management is seen as "simple CRUD" and edge cases aren't considered. The schema might not enforce uniqueness, and there's no lifecycle management for unused collections.

**Consequences:**
- Admin has three collections all named "Default Questions"
- Admin accidentally overwrites a collection they wanted to keep
- Collection list grows indefinitely with abandoned collections
- Difficult to find the right collection when list is cluttered

**Warning signs:**
- Collection picker shows duplicate names
- Admin can't tell which "Team Questions" collection is the right one
- Collection list exceeds 20+ items with many unused
- No delete confirmation or undo for collections

**Prevention:**
1. **Allow duplicate names (with disambiguation):** Names don't need to be unique, but show creation date or item count to disambiguate. "Team Retro (created 1/15, 8 questions)" vs "Team Retro (created 1/28, 12 questions)".
2. **Or: Enforce unique names per admin:** If the same admin creates collections, require unique names within their scope. Show clear error: "You already have a collection named 'X'. Rename or update the existing one."
3. **Track usage:** Record when a collection was last used to create a session. Surface "unused" collections for cleanup.
4. **Soft delete with undo:** When deleting a collection, mark it deleted but allow undo for 30 seconds. Permanent delete after that.
5. **Collection archiving:** Allow admins to archive old collections to reduce clutter without permanent deletion.

**Phase to address:** Collection management phase.

**Confidence:** MEDIUM -- depends on how collections are scoped (per-admin vs global).

---

### Pitfall 8: Results View "Mark as Read" State Not Persisted

**Severity:** MODERATE

**What goes wrong:** The admin marks certain reasons as "read" in the results view to track which feedback they've processed. But this state is stored only in memory or localStorage, so it's lost on refresh, cleared when switching devices, or not shared with co-admins viewing the same session.

**Why it happens:** "Mark as read" feels like a simple UI feature, so developers implement it with local state. The requirement for persistence across sessions/devices isn't considered.

**Consequences:**
- Admin marks 20 reasons as read, refreshes, and they're all unread again
- Admin reviews results on laptop, then checks on phone -- all unread
- If a future feature adds multi-admin, read state isn't shared
- Admin loses track of which feedback they've already processed

**Warning signs:**
- Page refresh clears read state
- Admin complains about re-reading the same feedback
- No "mark all as read" works but individual marks don't persist

**Prevention:**
1. **Persist to database:** Add a `reason_reads(session_id, admin_token, vote_id, read_at)` table. Write to this when admin marks as read.
2. **Or: localStorage with session-scoping:** If server persistence is overkill for v1.1, use localStorage keyed by session_id: `quickvote-read-reasons-{session_id}`. At least persists within same browser.
3. **Consider the read state as admin-specific:** Different admins (if ever supported) would have different read states. Design the schema accordingly.
4. **Sync indicator:** If using localStorage, show a subtle indicator that read state is browser-local and won't sync across devices.
5. **Bulk actions:** "Mark all as read" and "Mark all as unread" for efficiency.

**Phase to address:** Results view improvements phase.

**Confidence:** MEDIUM -- the feature scope determines whether persistence is needed.

---

### Pitfall 9: Batch Review Navigation Breaks on Edge Cases

**Severity:** MODERATE

**What goes wrong:** The left/right navigation for batch review works in the happy path (middle of the question list) but breaks at edges:
- On first question, "previous" does nothing or wraps unexpectedly
- On last question, "next" does nothing or submits the whole batch unexpectedly
- Navigation buttons are visible but disabled with no explanation
- Keyboard navigation (arrow keys) conflicts with other UI elements

**Why it happens:** Edge cases are tested last (if at all). The navigation logic handles `currentIndex + 1` and `currentIndex - 1` but doesn't consider bounds.

**Consequences:**
- Users tap "previous" on first question and nothing happens (confusing)
- Users tap "next" on last question and accidentally submit
- Users expect arrow key navigation but it doesn't work (or conflicts with text input)
- Swipe gestures don't work or trigger unexpected behavior

**Warning signs:**
- QA finds navigation bugs only at first/last question
- Users report being "stuck" at the beginning or end
- Accidental submissions from the last question

**Prevention:**
1. **Explicit boundary handling:** On first question, hide or grey out "previous" with tooltip "This is the first question". On last question, change "next" to "Review & Submit" with different visual treatment.
2. **Progress indicator:** Show "Question 1 of 10" so users know where they are. The indicator makes boundaries obvious.
3. **End-of-batch explicit action:** When reaching the last question, don't auto-loop to first. Show a summary/review screen or a distinct "You've reached the end" state.
4. **Keyboard navigation scoped correctly:** Arrow keys for navigation only when no text input is focused. Use event.target checks.
5. **Swipe gestures (optional):** If implementing swipe, make sure it doesn't interfere with scrolling. Swipe should be horizontal, scrolling vertical. Test on real devices -- emulators don't capture gesture edge cases.

**Phase to address:** Batch navigation implementation phase.

**Confidence:** HIGH -- boundary conditions are a classic source of bugs.

---

### Pitfall 10: Export Format Doesn't Round-Trip Cleanly

**Severity:** MODERATE

**What goes wrong:** Admin exports a collection, sends it to a colleague, colleague imports it, but the questions look different -- ordering changed, metadata was lost, or IDs create conflicts. The export/import isn't a true round-trip.

**Why it happens:** Export includes some fields but not others. Import generates new IDs (correct) but the lack of original IDs means you can't track lineage. Ordering is implicit in array position but not explicit in the data.

**Consequences:**
- Imported questions appear in wrong order
- Metadata like "anonymous" setting is lost or defaulted
- Can't tell if an imported question is a duplicate of one you already have
- Versioning/collaboration on question sets is difficult

**Warning signs:**
- Import changes question order from export
- Certain settings revert to defaults after round-trip
- No way to identify if a question was previously imported

**Prevention:**
1. **Explicit position field:** Include `"position": 0, 1, 2...` in export. On import, use these positions (offset from existing questions).
2. **Full schema in export:** Every field that matters should be in the export: `text, type, options, anonymous, position`. Include a schema version.
3. **Regenerate IDs on import:** Correct -- don't use original IDs, generate new ones. But optionally include `"original_id"` for provenance tracking if needed later.
4. **Round-trip test:** Automated test that exports, imports, exports again, and compares. Should be identical (except IDs).
5. **Include metadata:** Export could include collection name, export date, source app version for debugging.

**Phase to address:** Collection import/export phase.

**Confidence:** HIGH -- round-trip fidelity is testable and should be part of acceptance criteria.

---

## Minor Pitfalls

Mistakes that cause annoyance or minor rework but are fixable.

---

### Pitfall 11: Results Column Ordering Inconsistent Across Sessions

**Severity:** MINOR

**What goes wrong:** The results view shows vote columns (e.g., "Agree", "Disagree", reasons) in different orders depending on... something. Data arrival order? Alphabetical? The admin can't quickly compare results across questions because the layout keeps shifting.

**Why it happens:** Column order is derived from the data (e.g., `Object.keys(voteCounts)`) which isn't guaranteed to be consistent. Or the order changes based on which option was voted first.

**Prevention:**
1. **Fixed column order by type:** For agree/disagree, always show Agree first, Disagree second. For multiple choice, always show options in the order defined in the question.
2. **Sort explicitly:** Don't rely on object key order or data arrival order. Sort the display array by a stable property (option index, not vote count).
3. **If sorting by count:** Make it explicit and toggleable. Default to definition order, allow "sort by popularity" as an option.

**Phase to address:** Results view improvements phase.

**Confidence:** HIGH -- straightforward to fix.

---

### Pitfall 12: Collection Picker UI Doesn't Scale

**Severity:** MINOR

**What goes wrong:** The collection picker works fine with 5 collections but becomes unusable with 30. No search, no filtering, slow rendering, excessive scrolling.

**Prevention:**
1. **Search/filter:** Add a search box that filters by collection name.
2. **Virtualized list:** If rendering 50+ items, use a virtualized list component.
3. **Recent/favorites:** Show recently used collections at top, or allow pinning favorites.
4. **Lazy loading:** Don't fetch all collections upfront. Fetch on picker open, with pagination if needed.

**Phase to address:** Collection management phase (if large scale is expected) or post-v1.1 enhancement.

**Confidence:** MEDIUM -- depends on expected collection count.

---

### Pitfall 13: Batch Mode Timer Confusion

**Severity:** MINOR

**What goes wrong:** The existing live mode has a timer (admin-set countdown). In batch mode, does the timer apply? Per-question or per-session? Developers add timer to batch mode without clarifying the UX, causing participant confusion: "Why is there a countdown? I thought this was self-paced."

**Prevention:**
1. **Clarify timer scope for batch mode:** Decide if batch mode has timers at all. If yes:
   - Session-level timer: "Complete all questions in 10 minutes"
   - Question-level timer: Each question has its own countdown (more complex)
   - No timer: Truly self-paced, no time pressure
2. **Hide irrelevant UI:** If batch mode is timer-less, don't show the timer component. If it has a session timer, show it differently (countdown to session end, not per-question).
3. **Document the design decision:** Add to PROJECT.md so future devs know the intent.

**Phase to address:** Batch mode design phase -- decide early, implement accordingly.

**Confidence:** MEDIUM -- design decision rather than implementation bug.

---

### Pitfall 14: Admin Creates Batch Session but Starts It in Live Mode Accidentally

**Severity:** MINOR

**What goes wrong:** The admin intends to run a batch session but clicks the wrong button or doesn't realize the session mode setting. Participants join expecting self-paced but see a live session. Chaos ensues.

**Prevention:**
1. **Explicit mode confirmation at start:** When starting a session, show a confirmation: "You're starting this as a [Batch/Live] session. Participants will [work at their own pace / wait for you to push questions]."
2. **Mode indicator visible throughout:** In the admin view, prominently show the current mode. Not just a small badge -- make it obvious.
3. **Prevent mode change after start:** Once a session has participants, don't allow mode switching. If needed, require ending and restarting.
4. **Default to last-used mode:** If admin always runs live sessions, default to live. Reduce accidental wrong-mode starts.

**Phase to address:** Session setup phase.

**Confidence:** HIGH -- mode confusion is the #1 theme in this feature set.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Data foundation (schema) | Pitfall 2 (progress inconsistency), Pitfall 4 (shared state) | Add `participant_progress` table, separate live/batch state clearly in schema and store |
| Collection management | Pitfall 3 (import validation), Pitfall 7 (naming collisions), Pitfall 10 (round-trip), Pitfall 12 (picker scaling) | Validate imports thoroughly, add metadata to exports, design collection scoping early |
| Batch participant UI | Pitfall 1 (mode confusion), Pitfall 5 (lost vote state), Pitfall 9 (navigation edges), Pitfall 13 (timer) | Visual mode differentiation, load votes on navigation, explicit boundary handling |
| Progress dashboard | Pitfall 6 (inefficient polling) | Server-side aggregation, Realtime for incremental updates |
| Results view | Pitfall 8 (mark as read persistence), Pitfall 11 (column ordering) | Decide persistence strategy early, fixed column order by definition |
| Session setup | Pitfall 14 (wrong mode start) | Mode confirmation on start, prevent post-start mode changes |

---

## Checklist for v1.1 Development

Before starting each phase, verify:

- [ ] Progress tracking schema designed for batch mode
- [ ] Live-mode state and batch-mode state clearly separated in store
- [ ] Import validation produces specific, actionable error messages
- [ ] Export includes all fields needed for faithful round-trip
- [ ] Participant UI has explicit mode indicators
- [ ] Navigation handles first/last question gracefully
- [ ] Progress dashboard uses aggregated queries, not N+1
- [ ] Column ordering in results is deterministic
- [ ] "Mark as read" persistence decision documented
- [ ] Mode selection has confirmation step

---

## Sources

- [Vevox: Live polling vs surveys](https://help.vevox.com/hc/en-us/articles/360010481817-Live-polling-vs-surveys-what-s-the-difference) -- mode separation patterns
- [Mentimeter: Voting pace guide](https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace) -- live vs self-paced UX
- [Flatfile: CSV import errors](https://flatfile.com/blog/top-6-csv-import-errors-and-how-to-fix-them/) -- import validation
- [OneSchema: Advanced CSV features](https://www.oneschema.co/blog/advanced-csv-import-features) -- encoding and edge cases
- [CodeHS: Realtime activity dashboard](https://help.codehs.com/en/articles/7888834-track-progress-and-grades-with-the-realtime-activity-dashboard) -- progress tracking patterns
- [NNGroup: Mobile navigation patterns](https://www.nngroup.com/articles/mobile-navigation-patterns/) -- swipe and navigation UX
- [State management challenges](https://dev.to/rakshyak/avoiding-state-inconsistencies-the-pitfall-of-multiple-react-context-providers-4e29) -- React state isolation
- [Asynchronous mobile UX patterns](https://medium.com/snapp-mobile/asynchronous-mobile-ux-patterns-785ea69c4391) -- async mode user expectations
- QuickVote v1.0 codebase analysis (session-store.ts, ImportExportPanel.tsx, database types)

---

**Note:** Confidence levels reflect synthesis of web research and codebase analysis. Pitfalls related to existing v1.0 patterns (voting, realtime, store) have HIGH confidence. New feature pitfalls (collections, batch mode) are based on analogous systems and have MEDIUM-HIGH confidence.
