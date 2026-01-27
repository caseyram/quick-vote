# Feature Landscape

**Domain:** Real-time voting / polling / audience response systems
**Researched:** 2026-01-27
**Confidence:** MEDIUM (based on training data knowledge of Mentimeter, Slido, Poll Everywhere, Kahoot, Wooclap, and similar products; no live verification available)

## Competitive Context

The real-time polling space has a clear hierarchy of products. Understanding what each tier offers reveals where QuickVote's table stakes and differentiators live.

**Tier 1 (Enterprise):** Slido (Cisco), Poll Everywhere, Mentimeter
- Full question libraries, integrations (PowerPoint, Google Slides, Teams, Zoom), advanced analytics, team management, branding, SSO, moderation, export

**Tier 2 (Education/Gamification):** Kahoot, Wooclap, Socrative
- Gamification (leaderboards, points, timers), quiz-oriented, classroom management, LMS integrations

**Tier 3 (Lightweight/Open):** Strawpoll, EasyRetro, various open-source tools
- Single-question polls, no sessions, minimal admin controls, fast creation, often no accounts needed

**QuickVote's positioning:** Between Tier 2 and Tier 3. It has session management and multi-question flows like Tier 1/2, but with the frictionless access (no accounts) and simplicity of Tier 3. The "immersive tactile UX" is a differentiator that no tier fully owns.

---

## Table Stakes

Features users expect from any real-time polling product. Missing these means users will immediately perceive the product as incomplete or broken.

### Session & Question Management

| Feature | Why Expected | Complexity | QuickVote Status |
|---------|--------------|------------|------------------|
| Create a session with multiple questions | Core product concept; single-question-only feels like a toy | Low | Planned |
| Multiple question/vote types | Every competitor offers at least 3+ types; single type feels rigid | Medium | Planned (agree/disagree, multiple choice) |
| Admin controls voting flow (start/stop/reveal) | Defines "live" polling; without this it's just a form | Medium | Planned |
| Timer for voting rounds | Users expect time pressure as an option; every competitor has it | Low | Planned (manual or timer) |
| Edit/reorder questions before and during session | Admins need to adapt on the fly; not having this frustrates presenters | Low | Not explicitly planned |

### Participant Experience

| Feature | Why Expected | Complexity | QuickVote Status |
|---------|--------------|------------|------------------|
| Join via link or QR code | Standard onboarding; every competitor supports this | Low | Planned (QR) |
| No app install required (web-based) | Friction killer; requiring an app loses 30-50% of audience | N/A | Planned (web app) |
| Mobile-first responsive voting UI | 80%+ of participants use phones; must work perfectly on small screens | Medium | Planned |
| Instant feedback that vote was received | Without confirmation, participants wonder if it worked and tap again | Low | Not explicitly planned |
| Lobby/waiting screen before session starts | Participants arrive early; seeing a blank or error page is disorienting | Low | Planned |
| See current question without refreshing | Realtime push is the whole point; polling/refresh defeats the purpose | Medium | Planned (Supabase Realtime) |

### Results & Visualization

| Feature | Why Expected | Complexity | QuickVote Status |
|---------|--------------|------------|------------------|
| Live-updating results visualization | The "wow" moment of live polling; bar charts updating in real-time | Medium | Planned |
| Admin controls when results are visible | Revealing too early biases votes; admin must control reveal timing | Low | Planned |
| At least bar chart visualization | Bar charts are the universal default; every product has them | Low | Planned |
| Participant count visible to admin | Admin needs to know "how many people have joined/voted" at a glance | Low | Not explicitly planned |

### Data Persistence

| Feature | Why Expected | Complexity | QuickVote Status |
|---------|--------------|------------|------------------|
| Session results are saved and reviewable | Admins expect to revisit results after the event; ephemeral-only is a dealbreaker | Low | Planned (Supabase) |
| Session history / list of past sessions | Without this, saved data is inaccessible (admin forgets the link) | Low | Implied but not explicit |

---

## Differentiators

Features that set a product apart. Not expected by default, but valued when present. These are opportunities for QuickVote.

### QuickVote's Planned Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Full-screen tactile voting UI with animations | No competitor owns "voting feels amazing." Mentimeter/Slido are functional but sterile. This is QuickVote's core identity. | High | Highest priority differentiator. Animations on vote, lock-in, reveal. Mobile-native feel in a web app. |
| Zero-account admin experience | Mentimeter, Slido, Poll Everywhere all require sign-up. QuickVote's "just share a link" model removes the biggest adoption barrier for casual use. | Low | Powerful for ad-hoc meetings, workshops, classrooms where admin doesn't want yet another account. |
| Per-question anonymous vs. named config | Most competitors set anonymity per-session, not per-question. This flexibility lets admins mix "safe space" and "accountability" questions in one session. | Low | Genuine differentiator; very few products offer this granularity. |
| Dual session modes (live + self-paced) | Most products are either live-only (Slido, Kahoot) or survey-only (Google Forms). Supporting both in one product is unusual. | Medium | Important but ensure the UX clearly distinguishes modes; hybrid confusion is a risk. |
| Vote change until lock-in | Most products lock on first tap. Allowing changes with explicit lock-in reduces "I tapped wrong" frustration and adds a strategic element. | Low | Subtle but meaningfully better UX. |

### Potential Future Differentiators (Not in v1)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ranked choice voting | Enables nuanced preference gathering that most competitors lack entirely | High | Planned for later. UI/UX for ranked choice on mobile is non-trivial. |
| Participant reasoning/comments on votes | "Why did you vote that way?" turns polling into discussion. No competitor does this well. | Medium | Planned for later. Moderation becomes important. |
| Audience-sourced questions | Let participants submit questions that get voted on (democratic Q&A). Slido has this but others don't. | Medium | Not currently planned but high-value for Q&A sessions. |
| Reaction/emoji responses | Lightweight sentiment beyond structured votes. Mentimeter has this. | Low | Could enhance the "tactile" identity. |
| Session templates | Pre-built question sets for common use cases (retrospective, icebreaker, decision-making) | Low | Reduces setup friction for repeat use cases. |

### Differentiators Other Products Have (QuickVote Could Consider Later)

| Feature | Who Has It | Value | Complexity | Recommendation |
|---------|-----------|-------|------------|----------------|
| PowerPoint/Google Slides integration | Mentimeter, Slido, Poll Everywhere | High for enterprise presenters | High | Defer. Adds massive scope. Consider as v2+. |
| Zoom/Teams integration | Slido (Cisco owns it), Mentimeter | High for remote meetings | High | Defer. Platform-specific integrations are maintenance-heavy. |
| Gamification (leaderboards, points) | Kahoot, Wooclap | High for education/engagement | Medium | Defer unless targeting education. Not aligned with QuickVote's "immersive voting" identity. |
| Word cloud question type | Mentimeter, Slido | Medium (crowd favorite for brainstorming) | Medium | Good future addition. Visually impressive, aligns with "live results" identity. |
| Open-ended text responses | All Tier 1 products | Medium | Low (question) / Medium (display) | Could add post-MVP. Displaying aggregated text well is the hard part. |
| Quiz mode with correct answers | Kahoot, Mentimeter | Medium for education | Low | Easy to add if multiple choice already exists. Just mark one option as "correct." |
| Moderation / content filtering | Slido, Mentimeter | Important for large audiences | Medium | Not needed at 50-100 scale. Critical if scaling to 1000+. |
| CSV/PDF export | All Tier 1 products | High for post-event analysis | Low | Explicitly deferred in v1 but should be early in v2. Admins will ask for it quickly. |
| Custom branding / themes | Mentimeter (paid), Poll Everywhere | Medium for corporate use | Low-Medium | Nice-to-have. Not critical for v1 target audience. |

---

## Anti-Features

Features to deliberately NOT build. These are common in the domain but would hurt QuickVote if included.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User account system for participants | Kills the instant-join magic. Every friction point loses participants. Requiring sign-up for voting would cut participation 50%+. | Keep participants anonymous/named by admin config. Name entry is a text field, not an account. |
| Complex admin dashboard | QuickVote's value is simplicity. Replicating Mentimeter's 50-option admin panel would destroy the "just works" feel. | Keep admin UI to: create session, add questions, control flow, view results. That's it. |
| Presentation builder / slide deck features | Mentimeter evolved into a presentation tool. This is a trap: it adds massive scope and competes with PowerPoint. | Stay focused on voting/polling. Admins use their own slides and switch to QuickVote for interactive moments. |
| Real-time chat / discussion | Chat adds moderation burden, toxicity risk, and scope creep. At 50-100 participants, chat becomes noise. | Keep interactions structured: vote, optional name, optional future comment feature (moderated). |
| Email collection / marketing features | Feels exploitative in a voting context. Participants expect anonymity and will distrust the tool. | Respect participant privacy. No email, no tracking beyond what the session requires. |
| AI-generated questions / AI analysis | Trendy but gimmicky for v1. Adds API costs, complexity, and unpredictable outputs. | Ship the core experience first. AI features can be layered on later if there's demand. |
| Native mobile app | App store deployment adds weeks of work, review cycles, and maintenance. Web works fine on mobile. | Progressive web app if needed later, but responsive web-first is correct for this domain. |
| Complex access control / permissions | Roles, teams, org hierarchies -- this is enterprise bloat that doesn't serve the "quick" in QuickVote. | Single admin per session via unique link. Keep it flat. |
| Offline support | Real-time voting is inherently online. Offline caching adds complexity for a feature that contradicts the product's core purpose. | If connection drops, show a clear "reconnecting" state. Don't try to queue votes offline. |

---

## Feature Dependencies

```
Session Creation
  |
  +-- Question Management (requires session to exist)
  |     |
  |     +-- Vote Type Configuration (per question)
  |     |
  |     +-- Anonymous/Named Config (per question)
  |     |
  |     +-- Timer Config (per question)
  |
  +-- QR Code Generation (requires session URL)
  |
  +-- Session Mode Selection (live vs self-paced, set at creation)

Participant Join Flow
  |
  +-- QR Code Scan / Link --> Session URL
  |     |
  |     +-- Lobby Screen (if session not started)
  |     |
  |     +-- Current Question (if session active, live mode)
  |     |
  |     +-- Question List (if session active, self-paced mode)

Voting Flow (requires question to be active)
  |
  +-- Vote Selection (tap target, tactile feedback)
  |     |
  |     +-- Vote Change (until locked)
  |     |
  |     +-- Lock-In (explicit or admin-ended)
  |
  +-- Vote Confirmation Feedback (animation, visual state)

Results Flow (requires votes to exist)
  |
  +-- Live Result Aggregation (Supabase Realtime)
  |     |
  |     +-- Admin Reveal Control
  |     |
  |     +-- Chart Visualization (bar, pie)
  |     |
  |     +-- Participant Count Display

Data Persistence (requires Supabase)
  |
  +-- Session Storage
  |     |
  |     +-- Session History / List
  |     |
  |     +-- Individual Session Results Review
```

**Critical path:** Session Creation --> Question Management --> Participant Join --> Voting Flow --> Results Display. This is the minimum viable loop. Everything else layers on top.

**Mode dependency:** Self-paced mode requires all questions to be authored upfront. Live mode allows adding questions during the session. The data model must support both.

---

## MVP Recommendation

For MVP, prioritize the critical path plus QuickVote's identity features:

### Must Ship (Table Stakes + Core Identity)

1. **Session creation with unique admin link** -- the entry point
2. **Question management (add, edit, reorder)** -- the content
3. **Two vote types: agree/disagree and multiple choice** -- minimum viable variety
4. **QR code join flow with lobby** -- the participant entry point
5. **Full-screen tactile voting UI with animations** -- QuickVote's soul (DO NOT ship without this)
6. **Vote change until lock-in** -- differentiator, low cost
7. **Admin voting controls (start, stop, reveal, timer)** -- the live experience
8. **Live-updating bar chart results** -- the payoff moment
9. **Per-question anonymous vs named** -- differentiator, low cost
10. **Session persistence and history** -- expectation, not optional
11. **Participant count visible to admin** -- small but essential for confidence
12. **Vote confirmation feedback** -- small but essential for trust

### Ship Soon After MVP

- **Self-paced survey mode** -- adds a whole second use case; may be worth deferring 1-2 sprints to nail live mode first
- **Pie chart option** -- low effort, nice variety
- **CSV export** -- admins will ask for this within days of using the product
- **Session sharing (share results link)** -- low effort, high word-of-mouth value

### Defer to v2+

- Ranked choice voting (complex UI)
- Participant comments/reasoning (needs moderation)
- Word clouds / open-ended (different visualization challenge)
- Presentation tool integrations (massive scope)
- Custom branding (enterprise feature)

---

## Feature Comparison Matrix: QuickVote vs Competitors

| Feature | Mentimeter | Slido | Poll Everywhere | Kahoot | QuickVote v1 |
|---------|-----------|-------|----------------|--------|-------------|
| Multiple choice | Yes | Yes | Yes | Yes | **Yes** |
| Agree/disagree | Yes (scales) | Yes | Yes | No | **Yes** |
| Word cloud | Yes | Yes | Yes | No | No (v2) |
| Open text | Yes | Yes | Yes | No | No (v2) |
| Ranked choice | No | No | Yes (ranking) | No | No (v2) |
| Quiz/correct answer | Yes | Yes | Yes | Yes | No (v2) |
| Live results | Yes | Yes | Yes | Yes | **Yes** |
| QR code join | Yes | Yes | Yes | Yes | **Yes** |
| No participant account | Yes | Yes | Yes | Depends | **Yes** |
| No admin account | No | No | No | No | **YES (differentiator)** |
| Tactile/immersive UI | No | No | No | Partial (gamified) | **YES (differentiator)** |
| Per-question anonymity | No | No | No | No | **YES (differentiator)** |
| Vote change before lock | No | Some | No | No | **YES (differentiator)** |
| Self-paced + live modes | Partial | No | Yes | No | **Yes** |
| Timer | Yes | Yes | Yes | Yes | **Yes** |
| Slide deck integration | Yes | Yes | Yes | No | No |
| Export (CSV/PDF) | Yes | Yes | Yes | Yes | No (v2) |
| Custom branding | Paid | Paid | Paid | Paid | No |
| Free tier | Limited | Limited | Limited | Limited | **Full (no paywall)** |

---

## Confidence Notes

| Finding | Confidence | Reason |
|---------|------------|--------|
| Table stakes list | MEDIUM-HIGH | Based on extensive training data about these products. Core features are well-established and unlikely to have changed. |
| Competitor feature sets | MEDIUM | Based on training data (up to early 2025). Products may have added features since. |
| Per-question anonymity being rare | MEDIUM | Based on training knowledge. Products may have added this since. |
| Anti-features list | HIGH | Based on domain patterns that are structural, not product-specific. |
| Feature dependencies | HIGH | Based on logical analysis of the product concept. |
| MVP recommendation | HIGH | Based on both domain knowledge and QuickVote's PROJECT.md. |

---

## Sources

- Training data knowledge of Mentimeter, Slido (Cisco), Poll Everywhere, Kahoot, Wooclap, Socrative, Strawpoll
- QuickVote PROJECT.md (local project context)
- Note: WebSearch and WebFetch were unavailable during this research session. Findings should be spot-checked against current product pages before finalizing architectural decisions.
