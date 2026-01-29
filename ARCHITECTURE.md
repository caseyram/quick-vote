# QuickVote Architecture

This document describes the technical architecture of QuickVote, a real-time polling application.

## System Overview

QuickVote is a client-side React application backed by Supabase for database, authentication, and real-time synchronization. The admin controls session flow from a dashboard while participants vote on their mobile devices.

```
┌─────────────────┐     ┌─────────────────┐
│  Admin Browser  │     │ Participant     │
│  (Dashboard)    │     │ Mobile Browser  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    Supabase Realtime  │
         │    (WebSocket)        │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │       Supabase        │
         │  ┌─────────────────┐  │
         │  │   PostgreSQL    │  │
         │  │   (Database)    │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │ Realtime Server │  │
         │  │ (Broadcast +    │  │
         │  │  Presence)      │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │ Anonymous Auth  │  │
         │  └─────────────────┘  │
         └───────────────────────┘
```

## Data Model

### Core Entities

```
sessions
├── id (uuid, PK)
├── session_id (text, unique) - human-readable join code
├── admin_token (text) - secret token for admin access
├── title (text)
├── status (draft | lobby | active | ended)
├── reasons_enabled (boolean)
├── created_by (uuid) - anonymous user ID
└── created_at (timestamp)

batches
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── name (text)
├── position (integer) - display order
├── status (pending | active | closed)
└── created_at (timestamp)

questions
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── batch_id (uuid, FK → batches, nullable)
├── text (text)
├── type (agree_disagree | multiple_choice)
├── options (text[], nullable) - for multiple choice
├── position (integer) - display order
├── anonymous (boolean)
├── status (pending | active | closed | revealed)
└── created_at (timestamp)

votes
├── id (uuid, PK)
├── question_id (uuid, FK → questions)
├── session_id (uuid, FK → sessions)
├── participant_id (uuid) - anonymous user ID
├── value (text) - "agree"/"disagree"/"sometimes" or option text
├── reason (text, nullable)
├── display_name (text, nullable)
├── locked_in (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### Entity Relationships

- A **Session** contains many **Questions** and **Batches**
- A **Batch** groups multiple **Questions** for simultaneous voting
- A **Question** can belong to a Batch (batched) or stand alone (unbatched)
- A **Question** receives many **Votes** from participants
- Each participant can submit one **Vote** per Question (upsert on conflict)

## Application Structure

```
src/
├── components/          # Reusable UI components
│   ├── BarChart.tsx        # Vote result visualization
│   ├── BatchCard.tsx       # Batch display in admin list
│   ├── BatchList.tsx       # Drag-sortable batch/question list
│   ├── BatchVotingCarousel.tsx  # Participant batch voting UI
│   ├── VoteAgreeDisagree.tsx    # Agree/Disagree voting buttons
│   ├── VoteMultipleChoice.tsx   # Multiple choice voting cards
│   ├── QRCode.tsx          # Join QR code generator
│   ├── ProgressDashboard.tsx    # Batch voting progress indicator
│   └── ...
│
├── pages/               # Route components
│   ├── Home.tsx            # Landing page with join form
│   ├── AdminList.tsx       # Session list for admins
│   ├── AdminSession.tsx    # Main admin dashboard (~1400 LOC)
│   ├── ParticipantSession.tsx  # Participant voting view
│   └── SessionReview.tsx   # Post-session results review
│
├── hooks/               # Custom React hooks
│   ├── use-realtime-channel.ts  # Supabase realtime wrapper
│   ├── use-presence.ts     # Participant presence tracking
│   ├── use-countdown.ts    # Timer hook
│   ├── use-haptic.ts       # Mobile haptic feedback
│   └── use-auth.ts         # Anonymous auth handling
│
├── stores/              # Zustand state stores
│   └── session-store.ts    # Central session state
│
├── lib/                 # Utilities
│   ├── supabase.ts         # Supabase client instance
│   ├── session-import.ts   # JSON import logic
│   ├── session-export.ts   # JSON export logic
│   ├── question-templates.ts   # Template save/load
│   ├── vote-aggregation.ts # Vote counting utilities
│   └── admin-auth.ts       # Password gate logic
│
└── types/               # TypeScript definitions
    └── database.ts         # Entity type definitions
```

## Key Workflows

### Session Lifecycle

```
    draft → lobby → active → ended
      │       │        │
      │       │        └── Results viewable, no more votes
      │       └── Participants can join, see lobby
      └── Admin-only, editing questions
```

### Question Flow

1. Admin creates questions (draft status)
2. Admin activates a question → status = `active`
3. Participants see the question and vote
4. Votes stream in via Supabase Realtime
5. Admin closes question → status = `closed`
6. Results display with bar chart and reasons

### Batch Voting Flow

1. Admin groups questions into a batch
2. Admin activates batch → all batch questions become `active`
3. Participants swipe through carousel, selecting answers
4. On "Submit All", votes upsert in parallel
5. Admin closes batch → all questions become `closed`

## Real-time Architecture

### Channels

QuickVote uses Supabase Realtime with two communication patterns:

1. **Broadcast** - Admin → Participants commands
   - `question_activated` - Show specific question
   - `question_closed` - Hide voting UI, show results
   - `batch_activated` - Start batch voting mode
   - `batch_closed` - End batch voting
   - `timer_started` - Begin countdown

2. **Presence** - Participant count tracking
   - Participants track presence in channel
   - Admin subscribes to presence sync for count

3. **Postgres Changes** - Database subscriptions
   - Votes table changes for live result updates
   - Questions table for status changes

### State Synchronization

```
Admin Action          Broadcast Event         Participant Response
─────────────────────────────────────────────────────────────────
Activate Question  →  question_activated   →  Show voting UI
Close Question     →  question_closed      →  Show waiting state
Start Timer        →  timer_started        →  Display countdown
Activate Batch     →  batch_activated      →  Show carousel
Close Batch        →  batch_closed         →  Return to lobby
```

## State Management

### Zustand Store

The `useSessionStore` holds all session state:

```typescript
interface SessionState {
  // Data
  session: Session | null;
  questions: Question[];
  batches: Batch[];

  // Voting
  currentVote: Vote | null;
  questionVotes: Vote[];
  submitting: boolean;

  // Realtime
  participantCount: number;
  connectionStatus: ConnectionStatus;
  activeQuestionId: string | null;
  activeBatchId: string | null;
  timerEndTime: number | null;
}
```

### Data Flow

```
Supabase DB ─────► useSessionStore ─────► React Components
     ▲                   │
     │                   │
     └───────────────────┘
       (mutations via supabase client)
```

## Import/Export Format

Sessions export to JSON with this structure:

```json
{
  "session_name": "My Session",
  "created_at": "2024-01-15T10:30:00.000Z",
  "batches": [
    {
      "name": "Section 1",
      "position": 0,
      "questions": [
        {
          "text": "Question text here",
          "type": "agree_disagree",
          "options": null,
          "anonymous": true,
          "position": 0
        }
      ]
    },
    {
      "name": "_unbatched",
      "position": -1,
      "questions": [...]
    }
  ]
}
```

The `_unbatched` pseudo-batch holds standalone questions. During import, questions interleave based on their position values.

## Security Model

### Row Level Security (RLS)

Supabase RLS policies enforce:
- Sessions: Anyone can read; only creator can update
- Questions: Anyone can read session questions; only session creator can modify
- Votes: Participants can only modify their own votes
- Batches: Same as questions

### Authentication

- Anonymous auth for all users (no signup required)
- Admin access via `admin_token` in session record
- Optional password gate via `VITE_ADMIN_PASSWORD` env var

## Performance Considerations

### Optimizations

1. **Batch voting** - Single upsert per question instead of per-keystroke
2. **Presence throttling** - Debounced presence updates
3. **Memoized callbacks** - Stable references prevent re-renders
4. **Position-based ordering** - Efficient drag-drop reordering

### Limits

- Max 5MB import file size
- Questions sorted by position (indexed column)
- Votes indexed by `(question_id, participant_id)` for upsert

## Testing

```
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Test files sit alongside source files (`*.test.ts`, `*.test.tsx`).

Key test utilities:
- `src/test/mocks/supabase.ts` - Mock Supabase client
- `@testing-library/react` - Component testing
- `vitest` - Test runner

## Deployment

### Vercel

- Auto-deploys on push to `main`
- `vercel.json` handles SPA routing
- Environment variables set in Vercel dashboard

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_ADMIN_PASSWORD` | No | Password for admin pages |
