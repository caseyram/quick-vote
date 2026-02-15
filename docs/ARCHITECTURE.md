# QuickVote Architecture (v1.4)

This document describes the technical architecture of QuickVote, a real-time polling application with presentation mode, team-based voting, and a visual template editor.

## System Overview

QuickVote is a client-side React application backed by Supabase for database, authentication, real-time synchronization, and file storage. The admin controls session flow from a dashboard, participants vote on their mobile devices (optionally assigned to teams), and a dedicated presentation window projects slides and results to a shared screen. A visual template editor allows authoring reusable session blueprints with drag-and-drop.

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Admin Browser  │  │ Participant     │  │ Presentation    │
│  (Dashboard)    │  │ Mobile Browser  │  │ Window          │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         │    Supabase Realtime (WebSocket)         │
         └────────────────┬─────────────────────────┘
                          │
         ┌────────────────▼────────────────┐
         │           Supabase              │
         │  ┌──────────────────────────┐   │
         │  │       PostgreSQL         │   │
         │  │       (Database)         │   │
         │  └──────────────────────────┘   │
         │  ┌──────────────────────────┐   │
         │  │    Realtime Server       │   │
         │  │    (Broadcast +          │   │
         │  │     Presence)            │   │
         │  └──────────────────────────┘   │
         │  ┌──────────────────────────┐   │
         │  │    Supabase Storage      │   │
         │  │    (Image Slides)        │   │
         │  └──────────────────────────┘   │
         │  ┌──────────────────────────┐   │
         │  │    Anonymous Auth        │   │
         │  └──────────────────────────┘   │
         └─────────────────────────────────┘
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
├── test_mode (boolean) - enables test vote generation
├── default_template_id (uuid, FK → response_templates, nullable)
├── teams (jsonb, nullable) - array of up to 5 team names
├── created_by (uuid) - anonymous user ID
└── created_at (timestamp)

batches
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── name (text)
├── position (integer) - display order
├── status (pending | active | closed)
├── cover_image_path (text, nullable) - Storage path for batch cover image
└── created_at (timestamp)

questions
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── batch_id (uuid, FK → batches, nullable)
├── text (text)
├── type (agree_disagree | multiple_choice)
├── options (text[], nullable) - for multiple choice
├── template_id (uuid, FK → response_templates, nullable)
├── position (integer) - display order
├── anonymous (boolean)
├── status (pending | active | closed | revealed)
└── created_at (timestamp)

votes
├── id (uuid, PK)
├── question_id (uuid, FK → questions)
├── session_id (uuid, FK → sessions)
├── participant_id (uuid) - anonymous user ID
├── team_id (text, nullable) - participant's team name
├── value (text) - "agree"/"disagree"/"sometimes" or option text
├── reason (text, nullable)
├── display_name (text, nullable)
├── locked_in (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)

response_templates
├── id (uuid, PK)
├── name (text)
├── options (jsonb) - ordered list of option labels
├── created_at (timestamp)
└── updated_at (timestamp)

session_items
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── type ('batch' | 'slide') - discriminated union tag
├── batch_id (uuid, FK → batches, nullable) - set when type = 'batch'
├── image_path (text, nullable) - Storage path when type = 'slide'
├── caption (text, nullable) - slide caption text
├── position (integer) - unified sequence order
└── created_at (timestamp)

session_templates
├── id (uuid, PK)
├── name (text, unique)
├── blueprint (jsonb) - full session structure snapshot
├── item_count (integer) - cached count of items in blueprint
├── created_at (timestamp)
└── updated_at (timestamp)
```

### Entity Relationships

- A **Session** contains many **Questions** and **Batches**
- A **Session** contains many **SessionItems** (unified sequence of batches and slides)
- A **Session** may define up to 5 **Teams** (stored as JSONB array of names)
- A **SessionItem** can reference a **Batch** (type = 'batch') OR contain inline slide data (type = 'slide')
- A **Batch** groups multiple **Questions** for simultaneous voting
- A **Batch** may have a **cover image** (stored in Supabase Storage)
- A **Question** can belong to a Batch (batched) or stand alone (unbatched)
- A **Question** receives many **Votes** from participants
- Each participant can submit one **Vote** per Question (upsert on conflict)
- A **Vote** may be associated with a **Team** via `team_id`
- A **ResponseTemplate** defines option labels and order for multiple-choice questions
- A **SessionTemplate** stores a full session blueprint (batches, questions, slides, sequence)

## Application Structure

```
src/
├── components/          # Reusable UI components
│   ├── AdminControlBar.tsx      # Session lifecycle control bar
│   ├── AdminPasswordGate.tsx    # Optional password prompt wrapper
│   ├── AdminQuestionControl.tsx # Question activate/close/reveal controls
│   ├── BarChart.tsx             # Vote result visualization
│   ├── BatchCard.tsx            # Batch display in admin list
│   ├── BatchList.tsx            # Drag-sortable batch/question list
│   ├── BatchResultsProjection.tsx # Batch results for presentation view
│   ├── BatchVotingCarousel.tsx  # Participant batch voting UI
│   ├── ConfirmDialog.tsx        # Reusable confirmation modal
│   ├── ConnectionBanner.tsx     # Reconnection status banner
│   ├── CountdownTimer.tsx       # Animated countdown display
│   ├── ImageUploader.tsx        # Client-side image compression + upload
│   ├── ImportExportPanel.tsx    # JSON import/export UI
│   ├── KeyboardShortcutHelp.tsx # Keyboard shortcut overlay
│   ├── Lobby.tsx                # Participant waiting screen
│   ├── PresentationControls.tsx # 3-column admin control view
│   ├── ProgressDashboard.tsx    # Batch voting progress indicator
│   ├── QRCode.tsx               # Join QR code generator
│   ├── QROverlay.tsx            # QR code overlay (hidden/corner/fullscreen)
│   ├── QuestionForm.tsx         # Add/edit question form
│   ├── ReasonInput.tsx          # Vote reason text input
│   ├── ResponseTemplatePanel.tsx # Response template CRUD
│   ├── SequenceItemCard.tsx     # Batch/slide card in sequence
│   ├── SequenceManager.tsx      # Unified drag-and-drop sequence editor
│   ├── SessionTemplatePanel.tsx # Save/load/rename/delete templates
│   ├── SlideDisplay.tsx         # Full-screen slide projection
│   ├── SlideManager.tsx         # Slide CRUD with preview
│   ├── TemplateEditor.tsx       # Modal editor for response templates
│   ├── TemplateSelector.tsx     # Template assignment dropdown
│   ├── TeamBadge.tsx            # Visual indicator of participant's team
│   ├── TeamFilterTabs.tsx       # Admin toggle between all/team results
│   ├── TeamPicker.tsx           # Participant team selection in lobby
│   ├── TeamQRGrid.tsx           # Grid of team-specific QR codes for projection
│   ├── VoteAgreeDisagree.tsx    # Agree/Disagree voting buttons
│   ├── VoteMultipleChoice.tsx   # Multiple choice voting cards
│   └── ...
│
│   editor/                      # Template editor components
│   ├── BatchEditor.tsx          # Inline batch editing
│   ├── EditorMainArea.tsx       # Central editing workspace
│   ├── EditorSidebar.tsx        # Left panel with sequence navigation
│   ├── PreviewMode.tsx          # Live preview (projection + control + voting)
│   └── SessionPreviewOverlay.tsx # Participant voting preview
│
├── pages/               # Route components
│   ├── Home.tsx                 # Landing page with join form
│   ├── AdminSession.tsx         # Main admin dashboard
│   ├── ParticipantSession.tsx   # Participant voting view
│   ├── SessionReview.tsx        # Post-session results review
│   ├── PresentationView.tsx     # Standalone projection window
│   └── TemplateEditorPage.tsx   # Visual template editor (create/edit)
│
├── hooks/               # Custom React hooks
│   ├── use-auth.ts              # Anonymous auth handling
│   ├── use-countdown.ts         # Timer hook
│   ├── use-haptic.ts            # Mobile haptic feedback
│   ├── use-keyboard-navigation.ts # Keyboard shortcut bindings
│   ├── use-multi-select.ts      # Multi-select state for sequence items (Ctrl+Click)
│   ├── use-presence.ts          # Participant presence tracking
│   ├── use-read-reasons.ts      # Track read state of vote reasons
│   ├── use-realtime-channel.ts  # Supabase realtime wrapper
│   └── use-sequence-navigation.ts # Keyboard-driven sequence navigation
│
├── stores/              # Zustand state stores
│   ├── session-store.ts         # Central session state
│   ├── template-store.ts        # Zustand store for response templates
│   ├── session-template-store.ts # Zustand store for session templates
│   └── template-editor-store.ts # Working state for template editor
│
├── lib/                 # Utilities
│   ├── supabase.ts              # Supabase client instance
│   ├── admin-auth.ts            # Password gate logic
│   ├── chart-colors.ts          # Predefined color palettes for vote options
│   ├── color-contrast.ts        # Compute text color from background hex
│   ├── csv-import.ts            # CSV import utility
│   ├── question-templates.ts    # Template save/load
│   ├── sequence-api.ts          # Session items management + backfill
│   ├── session-export.ts        # JSON export logic
│   ├── session-import.ts        # JSON import logic
│   ├── session-template-api.ts  # Template CRUD + serialization
│   ├── slide-api.ts             # Slide CRUD operations
│   ├── team-api.ts              # Team configuration validation + updates
│   ├── template-api.ts          # Response template API
│   └── vote-aggregation.ts      # Vote counting + team filtering
│
└── types/               # TypeScript definitions
    └── database.ts              # Entity type definitions
```

~27,520 LOC across ~90+ files.

## Key Workflows

### Session Lifecycle

```
    draft → lobby → active → ended
      │       │        │
      │       │        ├── Results viewable, no more votes
      │       │        └── Presentation mode: admin navigates sequence
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

### Presentation Flow

1. Admin builds session content: batches, questions, and slides
2. Admin arranges items in the sequence editor (drag-and-drop ordering)
3. Session transitions: draft → lobby → active (presentation mode)
4. Admin opens a dedicated presentation window (PresentationView)
5. In presentation mode, admin navigates sequence items via PresentationControls:
   - **Slide items** display full-screen in the presentation window
   - **Batch items** activate voting for participants
6. QR overlay can be toggled (hidden / corner / fullscreen) for join codes
7. Session ends → results viewable in review

## Real-time Architecture

### Channels

QuickVote uses Supabase Realtime with two communication patterns:

1. **Broadcast** - Admin → Participants + Presentation commands
   - `session_lobby` - Transition session to lobby state
   - `session_active` - Start session (begin accepting votes)
   - `session_ended` - End session
   - `question_activated` - Show specific question
   - `voting_closed` - Close voting on a question
   - `results_revealed` - Reveal question results
   - `batch_activated` - Start batch voting mode
   - `batch_closed` - End batch voting
   - `slide_activated` - Show slide image (Admin → Presentation + Participants)
   - `presentation_qr_toggle` - QR overlay mode change
   - `black_screen_toggle` - Toggle black screen
   - `result_reveal` - Reveal batch results in presentation
   - `reason_highlight` - Highlight specific reason
   - `team_filter_changed` - Switch team filter in results

2. **Presence** - Participant count tracking
   - Participants track presence in channel
   - Admin subscribes to presence sync for count

3. **Postgres Changes** - Database subscriptions
   - Votes table changes for live result updates
   - Questions table for status changes

### State Synchronization

```
Admin Action          Broadcast Event         Participant/Presentation Response
──────────────────────────────────────────────────────────────────────────────
Open Lobby         →  session_lobby        →  Show lobby / waiting state
Start Session      →  session_active       →  Ready for voting
End Session        →  session_ended        →  Show ended state / redirect
Activate Question  →  question_activated   →  Show voting UI
Close Voting       →  voting_closed        →  Show waiting state
Reveal Results     →  results_revealed     →  Display question results
Activate Batch     →  batch_activated      →  Show carousel / show batch info
Close Batch        →  batch_closed         →  Return to lobby
Show Slide         →  slide_activated      →  Display full-screen slide
Toggle QR          →  presentation_qr_toggle → Show/hide QR overlay
Black Screen       →  black_screen_toggle  →  Show/hide black screen
Reveal Batch       →  result_reveal        →  Display batch results in presentation
Highlight Reason   →  reason_highlight     →  Highlight specific reason
Filter by Team     →  team_filter_changed  →  Show filtered results in presentation
```

## State Management

### Zustand Stores

The `useSessionStore` holds all session state:

```typescript
interface SessionState {
  // Data
  session: Session | null;
  questions: Question[];
  batches: Batch[];
  sessionItems: SessionItem[];

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
  activeSessionItemId: string | null;
  navigationDirection: 'forward' | 'backward' | null;

  // Presentation
  activeItemIndex: number | null;
  presentationMode: boolean;
}
```

The `useTemplateStore` holds response template state:

```typescript
interface TemplateState {
  templates: ResponseTemplate[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (name: string, options: string[]) => Promise<ResponseTemplate>;
  update: (id: string, patch: Partial<ResponseTemplate>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```

The `useSessionTemplateStore` holds session template state:

```typescript
interface SessionTemplateState {
  templates: SessionTemplate[];
  loading: boolean;
  fetch: () => Promise<void>;
  save: (name: string, blueprint: SessionBlueprint) => Promise<SessionTemplate>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```

The `useTemplateEditorStore` holds working state for the visual template editor:

```typescript
interface TemplateEditorState {
  // Drag-drop state, preview mode, item ordering
  // Used by /templates/new and /templates/:id/edit routes
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

Sessions export to JSON with a v1.4 discriminated union format that supports batches, slides, and team data:

```json
{
  "session_name": "My Session",
  "batches": [
    {
      "type": "batch",
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
      "type": "slide",
      "position": 1,
      "image_path": "session-slides/abc.webp",
      "caption": "Welcome"
    }
  ],
  "templates": [
    {
      "name": "Likert",
      "options": ["Strongly Agree", "Agree", "Neutral", "Disagree"]
    }
  ],
  "teams": ["Red Team", "Blue Team"],
  "session_template_name": "My Template"
}
```

The `batches` array uses a discriminated union on the `type` field: `"batch"` entries contain questions, while `"slide"` entries contain image and caption data. The `_unbatched` pseudo-batch holds standalone questions. During import, items interleave based on their position values. Slide images reference Storage paths; missing images are flagged during import validation. The optional `teams` array exports the session's team configuration.

## Security Model

### Row Level Security (RLS)

Supabase RLS policies enforce:
- Sessions: Anyone can read; only creator can update (including team configuration)
- Questions: Anyone can read session questions; only session creator can modify
- Votes: Participants can only modify their own votes; `team_id` set at vote time
- Batches: Same as questions
- Storage: RLS policies enforce path-based access for authenticated users

### Authentication

- Anonymous auth for all users (no signup required)
- Admin access via `admin_token` in session record
- Optional password gate via `VITE_ADMIN_PASSWORD` env var
- PresentationView: No auth required (read-only projection content)
- TemplateEditorPage: Uses admin password gate (if configured)

## Performance Considerations

### Optimizations

1. **Batch voting** - Single upsert per question instead of per-keystroke
2. **Presence throttling** - Debounced presence updates
3. **Memoized callbacks** - Stable references prevent re-renders
4. **Position-based ordering** - Efficient drag-drop reordering
5. **Team filtering** - Client-side filtering of vote aggregation by team

### Limits

- Max 5MB import file size
- Questions sorted by position (indexed column)
- Votes indexed by `(question_id, participant_id)` for upsert
- Composite index on `(session_id, team_id)` for team-filtered queries
- Max 5 teams per session

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
