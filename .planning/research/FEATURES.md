# Feature Landscape: Batch Questions & Collections

**Domain:** Self-paced voting / question collections / batch survey mode
**Researched:** 2026-01-28
**Context:** v1.1 milestone extending existing v1.0 real-time voting app
**Confidence:** MEDIUM-HIGH (based on WebSearch verified against multiple sources)

## Existing v1.0 Features (Already Built)

For context, QuickVote v1.0 already has:
- Session creation with unique admin link (no accounts)
- Question management (add, edit, reorder)
- Two vote types: agree/disagree, multiple choice
- QR code join flow with lobby
- Admin voting controls (start, close, reveal, timer)
- Live-updating bar chart results
- Per-question anonymous vs named voting
- Full-screen tactile voting UI with animations
- Session persistence and history
- Participant count display
- Connection status indicators

---

## Table Stakes for Batch/Self-Paced Mode

Features users expect when a polling tool offers "self-paced" or "survey" mode. Missing these means the feature feels incomplete.

### Core Self-Paced Functionality

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Participant-controlled question navigation | The defining feature of self-paced mode. Without it, it's just "live mode with no presenter." [Mentimeter](https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace), [Vevox](https://help.vevox.com/hc/en-us/articles/360010481817-Live-polling-vs-surveys-what-s-the-difference) all differentiate this clearly. | Medium | Session mode flag |
| Forward navigation (Next button/swipe) | Standard survey pattern. "Next button advances respondents to subsequent page" - [QuestionPro](https://www.questionpro.com/features/button.html). Users expect to move forward through questions. | Low | Question navigation |
| Back navigation (Previous button/swipe) | "Back button enables respondents to revisit earlier survey pages to review and edit answers" - [QuestionPro](https://www.questionpro.com/features/button.html). Most survey tools support this. | Low | Question navigation |
| Progress indicator | "Progress tracker eases potential user anxiety with long online forms" - [Arounda](https://arounda.agency/blog/progress-trackers-in-ux-design-2). Shows "Question 3 of 10" or progress bar. | Low | Question count |
| Submit/Complete action | Explicit end-of-survey action. Distinguishes "in progress" from "completed" participants. | Low | All questions answered |
| Answers persist across navigation | When going back/forward, previous answers should be retained. Core survey UX expectation. | Low | Vote state management |

### Admin Progress Dashboard

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Completion count | "How many participants have finished?" Basic metric for any survey. "Response rate, completion rate" - [QuestionPro](https://www.questionpro.com/features/real-time-reports.html). | Low | Submit tracking |
| In-progress count | "How many started but haven't finished?" Shows engagement. "Partially completed responses" - [QuestionPro](https://www.questionpro.com/blog/survey-response-viewer/). | Low | Progress tracking |
| Per-question response counts | "How many answered Q3?" Identifies where participants are. | Low | Vote aggregation |
| Real-time updates | Dashboard updates as responses come in. "Charts auto-update in real time" - [AidaForm](https://aidaform.com/help/how-to-use-the-real-time-survey-dashboard.html). | Medium | Existing realtime infra |

---

## Table Stakes for Question Collections

Features users expect when a tool offers "question bank" or "reusable questions."

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Named collection/group | Questions need to belong to something identifiable. "Question Library" - [Vevox](https://help.vevox.com/hc/en-us/articles/4559386961937-Duplicate-or-reuse-a-poll). | Low | New database entity |
| Add questions to collection | Core CRUD for collections. | Low | Collection entity |
| Load collection into session | The payoff: "quickly add previously created questions" - [Vevox](https://help.vevox.com/hc/en-us/articles/4559386961937-Duplicate-or-reuse-a-poll). | Low | Session-collection relationship |
| Copy questions (not reference) | Questions should be copied, not linked. Changes to session questions shouldn't affect collection originals. [PublicInput](https://support.publicinput.com/en/articles/2666885-re-using-and-copying-questions) distinguishes "copy" vs "reuse." | Low | Deep copy logic |

---

## Differentiators

Features that set QuickVote apart. Not universally expected but add value.

### High-Value Differentiators for v1.1

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Swipe-based navigation | "Swiping leads to greater sense of control, enjoyment, user engagement" - [Springer](https://link.springer.com/chapter/10.1007/978-3-319-39396-4_16). Aligns with QuickVote's "tactile" identity. More engaging than Next/Back buttons alone. | Medium | Requires gesture library. Must also support buttons for accessibility. |
| On-the-fly batch creation | Create a batch from existing session questions during a live session. Unusual feature - most tools require upfront mode selection. | Medium | Requires session mode switching or parallel batch creation. |
| Hybrid live+batch mode | Admin controls some questions live, others are self-paced. Very few competitors offer this granularity. | High | Complex state management. Consider deferring. |
| Visual answer review | Before submit, show summary of all answers with ability to tap back to change. Reduces "did I answer that?" anxiety. | Medium | Requires answer aggregation view. |
| Per-question completion animation | Maintain QuickVote's animation identity in batch mode. Satisfying micro-interaction on each answer. | Low | Reuse existing vote animations. |

### Collection-Specific Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Import/export collections (JSON) | "Export file will be in .JSON format" - [Quiz And Survey Master](https://quizandsurveymaster.com/docs/add-ons/export-import/). Enables sharing, backup, version control. | Low | JSON schema design needed. |
| Collection versioning | Track changes to collections over time. Enterprise feature most competitors lack. | High | Significant complexity. Defer unless requested. |
| Public collection library | Share collections across users. Community feature. | High | Requires multi-user features. Out of scope. |

---

## Anti-Features

Features to deliberately NOT build for batch/collections. Common in the domain but wrong for QuickVote.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Skip logic / conditional branching | "Skip logic works only with linear surveys" - [QuestionPro](https://www.questionpro.com/features/branching.html). Adds massive complexity. QuickVote sessions are typically short (5-15 questions). Skip logic optimizes for long surveys (50+ questions). | Keep questions linear. If admins need branching, they can create multiple sessions. |
| Required questions / validation | Blocking progress on unanswered questions adds friction and complexity. In voting context (not data collection), partial responses are acceptable. | Optional: show "X of Y answered" but allow submit with incomplete. |
| Email/identity collection | "Feels exploitative in a voting context" - identified in v1.0 research. Still applies to batch mode. | Per-question anonymous/named config already exists. No email capture. |
| Time limits per question in batch mode | Contradicts "self-paced" concept. Creates anxiety rather than engagement. | Total session timeout is reasonable. Per-question timeout is anti-pattern for self-paced. |
| Auto-advance after answer | Some survey tools auto-advance to next question after selection. Removes ability to reconsider before moving on. | Require explicit Next action. Keep participant in control. |
| Partial save / resume later | Adds significant complexity (participant identity, session state, expiration). For short voting sessions (5-15 questions), not worth it. | Batch sessions are designed to be completed in one sitting. Clear expectation upfront. |
| Complex collection hierarchy | Folders within folders, tags, categories. Over-engineering for the use case. | Simple flat list of named collections is sufficient. Search/filter if list grows. |
| Collection sharing / permissions | Multi-user access control. Requires user accounts. | Collections are admin-local (tied to admin token or browser storage). |

---

## Feature Dependencies

### Batch Mode Dependencies

```
Session Mode Selection (new)
  |
  +-- Mode Flag: 'live' | 'batch' (or hybrid)
        |
        +-- Live Mode (existing v1.0 behavior)
        |     |
        |     +-- Admin controls question flow
        |     +-- Participants see current question only
        |
        +-- Batch Mode (new for v1.1)
              |
              +-- Questions Pre-loaded (all visible to participant)
              |     |
              |     +-- Question Navigation UI
              |     |     |
              |     |     +-- Next/Previous buttons
              |     |     +-- Swipe gestures (optional)
              |     |     +-- Progress indicator
              |     |
              |     +-- Answer Persistence (across navigation)
              |
              +-- Submit/Complete Action
              |     |
              |     +-- Completion Tracking (per participant)
              |
              +-- Admin Progress Dashboard
                    |
                    +-- Completion counts
                    +-- Per-question response counts
                    +-- Real-time updates (existing Supabase channel)
```

### Collection Dependencies

```
Collection Entity (new)
  |
  +-- Collection CRUD
  |     |
  |     +-- Create collection with name
  |     +-- Add/remove questions
  |     +-- Edit collection metadata
  |     +-- Delete collection
  |
  +-- Collection Usage
  |     |
  |     +-- Load collection into new session (copies questions)
  |     +-- Load collection into existing session (appends copies)
  |
  +-- Import/Export
        |
        +-- Export collection as JSON
        +-- Import collection from JSON
        +-- JSON Schema (questions, metadata, version)
```

### Integration with Existing v1.0

| v1.0 Feature | How It Integrates with Batch Mode |
|--------------|----------------------------------|
| Question types (agree/disagree, multiple choice) | Same types work in batch mode |
| Per-question anonymity | Still applies per question in batch |
| Vote animations | Reuse for batch answer feedback |
| Supabase realtime | Use for progress dashboard updates |
| QR code join | Same join flow, different participant experience |
| Results bar chart | Same visualization, populated as batch completes |

---

## MVP Recommendation for v1.1

### Must Ship (Table Stakes)

1. **Session mode selection** - Admin chooses live or batch at session creation
2. **Batch participant navigation** - Next/Previous with progress indicator
3. **Answers persist** - Navigate freely without losing responses
4. **Submit/Complete action** - Explicit batch completion
5. **Admin progress dashboard** - Completion count, in-progress count
6. **Collection CRUD** - Create, name, add questions
7. **Load collection into session** - Primary collection use case
8. **Collection JSON export** - Portable, shareable format
9. **Collection JSON import** - Complete the loop

### Nice to Have (Differentiators)

- **Swipe navigation** - Enhances tactile identity
- **Visual answer review before submit** - Reduces anxiety
- **Per-question completion animation** - Consistency with live mode
- **On-the-fly batch creation** - Create batch from live session questions

### Explicitly Defer

- Skip logic / branching (high complexity, low value for short sessions)
- Collection versioning (enterprise feature)
- Hybrid live+batch mode (complex state)
- Partial save / resume later (requires identity system)

---

## JSON Schema Recommendation for Collections

Based on industry patterns from [SurveyJS](https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey) and [Qualtrics QSF](https://gist.github.com/ctesta01/d4255959dace01431fb90618d1e8c241):

```json
{
  "version": "1.0",
  "exportedAt": "2026-01-28T10:30:00Z",
  "collection": {
    "name": "Team Retrospective Questions",
    "description": "Optional description",
    "questions": [
      {
        "text": "The sprint goals were clear",
        "type": "agree_disagree",
        "anonymous": true
      },
      {
        "text": "What was the biggest blocker?",
        "type": "multiple_choice",
        "options": ["Dependencies", "Unclear requirements", "Technical debt", "Other"],
        "anonymous": false
      }
    ]
  }
}
```

Key design decisions:
- **Version field** - Future-proofs schema evolution
- **Questions are data, not references** - Full question content included
- **No IDs in export** - IDs generated on import
- **Position implicit** - Array order defines position

---

## Complexity Estimates

| Feature Group | Complexity | Rationale |
|---------------|------------|-----------|
| Batch mode participant UI | Medium | New navigation paradigm, but builds on existing vote components |
| Batch mode admin dashboard | Low-Medium | Aggregation logic exists; new dashboard layout |
| Collection entity + CRUD | Low | Standard database entity, simple UI |
| Collection import/export | Low | JSON serialization, file I/O |
| Swipe navigation | Medium | Gesture handling, animation, fallback buttons |
| On-the-fly batch creation | Medium | Mode switching, state management |

---

## Confidence Assessment

| Finding | Confidence | Reason |
|---------|------------|--------|
| Self-paced navigation patterns | HIGH | Multiple sources agree (Mentimeter, Vevox, QuestionPro, Poll Everywhere) |
| Progress dashboard metrics | HIGH | Industry standard, verified via QuestionPro, AidaForm |
| JSON export/import patterns | MEDIUM-HIGH | Multiple implementations reviewed (SurveyJS, QSF, Quiz Master) |
| Anti-features (skip logic, auto-advance) | HIGH | Structural analysis matches QuickVote's positioning |
| Swipe UX benefits | MEDIUM | Research supports but implementation depends on gesture library choice |
| Collection reuse patterns | MEDIUM-HIGH | Vevox, QuestionPro, SurveyMonkey all offer similar features |

---

## Sources

### Verified Sources (MEDIUM-HIGH Confidence)
- [Mentimeter: Voting Pace Guide](https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace)
- [QuestionPro: Navigation Buttons](https://www.questionpro.com/features/button.html)
- [QuestionPro: Real-Time Reports](https://www.questionpro.com/features/real-time-reports.html)
- [Vevox: Duplicate or Reuse Poll](https://help.vevox.com/hc/en-us/articles/4559386961937-Duplicate-or-reuse-a-poll)
- [SurveyJS: Create a Simple Survey](https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey)
- [Arounda: Progress Trackers in UX](https://arounda.agency/blog/progress-trackers-in-ux-design-2)
- [Quiz And Survey Master: Export/Import](https://quizandsurveymaster.com/docs/add-ons/export-import/)

### WebSearch Sources (MEDIUM Confidence)
- [Springer: Swiping vs Scrolling](https://link.springer.com/chapter/10.1007/978-3-319-39396-4_16)
- [AidaForm: Real-Time Dashboard](https://aidaform.com/help/how-to-use-the-real-time-survey-dashboard.html)
- [PublicInput: Reusing Questions](https://support.publicinput.com/en/articles/2666885-re-using-and-copying-questions)

### Project Context
- QuickVote PROJECT.md (existing v1.0 features)
- QuickVote v1.0 REQUIREMENTS.md (completed features)
- QuickVote database.ts (current data model)
