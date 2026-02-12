# Architecture Research

**Domain:** Template Authoring, Team-Based Voting, and Presentation Polish
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

This research addresses architecture patterns for extending QuickVote with template authoring, team-based voting, and presentation polish features. The existing system uses a single-session model with Zustand stores, Supabase Realtime, and dnd-kit for drag-drop sequencing. The new features require:

1. **Mode separation** — Template editing vs live session (discriminated union pattern)
2. **Preview system** — Simulating presentation/participant views from templates without Realtime
3. **Team filtering** — Database schema + QR routing + Realtime channel partitioning
4. **Inline batch editing** — Collapsible nested lists in SequenceManager
5. **Multi-select DnD** — Custom selection state layered over dnd-kit
6. **Background color theming** — Context API for global/item-scoped colors
7. **Batch-slide association** — Foreign key linking batches to cover images

All features integrate with existing architecture without breaking changes to live sessions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         ROUTES                               │
├─────────────────────────────────────────────────────────────┤
│  /                   /session/:id        /admin/:token       │
│  /admin/templates    /present/:id        /admin/review/:id   │
│  /session/:id/:team  (NEW)               /templates/:id (NEW)│
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    COMPONENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ AdminSession │  │TemplateEditor│  │ParticipantUI │       │
│  │ (live mode)  │  │ (edit mode)  │  │ (team filter)│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │                │
│  ┌──────┴─────────────────┴──────────────────┴───────┐       │
│  │        SequenceManager (mode-aware)                │       │
│  │  - Draft: DnD reordering, batch expansion          │       │
│  │  - Template: DnD + batch editing                   │       │
│  │  - Live: Read-only navigation                      │       │
│  └────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    STATE LAYER (Zustand)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │SessionStore  │  │TemplateStore │  │ ThemeStore   │       │
│  │ (live)       │  │ (templates)  │  │ (NEW)        │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    REALTIME LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐        │
│  │  Supabase Realtime (single channel per session)  │        │
│  │  - Broadcast: activation events, QR toggles      │        │
│  │  - Presence: participant counts (team-filtered)  │        │
│  │  - Postgres Changes: DISABLED (polling instead)  │        │
│  └──────────────────────────────────────────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    DATA LAYER (Supabase)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐           │
│  │ sessions   │  │ batches    │  │ session_items│           │
│  │ + team_id  │  │ + cover_id │  │ + bg_color   │           │
│  └────────────┘  └────────────┘  └──────────────┘           │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ session_templates│  │ votes + team_id  │                  │
│  │ (blueprint JSONB)│  │ (NEW)            │                  │
│  └─────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Template Editor Mode vs Live Session Mode

### Problem
Template editing requires full CRUD on sequences without Realtime broadcast. Live sessions need Realtime sync but read-only sequencing. Components must share code but behave differently.

### Solution: Discriminated Union Pattern

Use TypeScript discriminated unions to create mode-aware component props.

**Pattern:**
```typescript
// Component mode discriminated by 'mode' property
type SequenceManagerProps =
  | { mode: 'live'; sessionId: string; onActivateItem: (item: SessionItem) => void }
  | { mode: 'draft'; sessionId: string; onCreateBatch: () => void }
  | { mode: 'template'; templateId: string; onSaveTemplate: (blueprint: SessionBlueprint) => void };

function SequenceManager(props: SequenceManagerProps) {
  switch (props.mode) {
    case 'live':
      return <LiveSequenceView sessionId={props.sessionId} onActivateItem={props.onActivateItem} />;
    case 'draft':
      return <DraftSequenceEditor sessionId={props.sessionId} onCreateBatch={props.onCreateBatch} />;
    case 'template':
      return <TemplateSequenceEditor templateId={props.templateId} onSaveTemplate={props.onSaveTemplate} />;
  }
}
```

**Benefits:**
- Type-safe mode switching — invalid prop combinations impossible
- Exhaustive checking — TypeScript enforces all modes handled
- Clear component intent — mode documented in type signature

**Source:** [TypeScript Discriminated Unions for React Components](https://oneuptime.com/blog/post/2026-01-15-typescript-discriminated-unions-react-props/view)

### Integration Points

**Existing:**
- `SequenceManager` currently has `isLive` boolean prop (lines 30-43 in SequenceManager.tsx)
- DnD enabled only in draft mode (lines 212-276)
- Live mode shows navigation controls (lines 163-209)

**New:**
- Add `mode: 'template'` variant to `SequenceManagerProps`
- Template mode enables:
  - DnD reordering (like draft)
  - Batch expansion for inline question editing (NEW)
  - Save to `session_templates.blueprint` instead of `session_items`
- Route: `/admin/templates/:templateId` uses template mode

**Modified Files:**
- `src/components/SequenceManager.tsx` — Add mode prop, split render logic
- `src/pages/TemplateEditor.tsx` — NEW page using mode='template'
- `src/stores/template-store.ts` — Add blueprint CRUD methods

---

## Feature 2: Preview System

### Problem
Template authors need to see how slides/batches render in presentation and participant views without creating a live session or connecting to Realtime.

### Solution: Preview Context Pattern

Use React Context to inject mock data and disable Realtime subscriptions during preview.

**Pattern:**
```typescript
// Preview context provides simulated state
interface PreviewContextValue {
  isPreview: boolean;
  mockActiveItemId: string | null;
  mockParticipantCount: number;
  mockVotes: Record<string, Vote[]>;
}

const PreviewContext = createContext<PreviewContextValue>({
  isPreview: false,
  mockActiveItemId: null,
  mockParticipantCount: 0,
  mockVotes: {}
});

// Components check preview mode before Realtime subscriptions
function useRealtimeChannel(channelName: string, setup: Function, enabled: boolean) {
  const { isPreview } = useContext(PreviewContext);
  const shouldConnect = enabled && !isPreview; // Disable Realtime in preview

  useEffect(() => {
    if (!shouldConnect) return;
    // ... existing Realtime setup
  }, [shouldConnect]);
}

// Presentation preview uses mock data from template blueprint
function PresentationPreview({ templateId }: { templateId: string }) {
  const template = useTemplateStore(s => s.templates.find(t => t.id === templateId));
  const [activeIndex, setActiveIndex] = useState(0);

  const previewValue: PreviewContextValue = {
    isPreview: true,
    mockActiveItemId: template?.blueprint.sessionItems[activeIndex]?.id ?? null,
    mockParticipantCount: 42, // Static for preview
    mockVotes: generateMockVotes(template), // Synthetic votes
  };

  return (
    <PreviewContext.Provider value={previewValue}>
      <PresentationView templateMode={true} />
    </PreviewContext.Provider>
  );
}
```

**Benefits:**
- Reuses existing presentation/participant components
- No network calls during preview
- Template authors see realistic rendering

**Sources:**
- [Preview.js](https://previewjs.com/) — Component preview with generated props
- [React Context API](https://legacy.reactjs.org/docs/context.html) — State propagation

### Integration Points

**Existing:**
- `PresentationView` subscribes to Realtime (lines 110-185 in PresentationView.tsx)
- `ParticipantSession` subscribes to Realtime (lines 198-325 in ParticipantSession.tsx)
- Both components fetch session data from Supabase

**New:**
- Add `PreviewContext` in `src/contexts/preview-context.tsx`
- Modify `useRealtimeChannel` to respect `isPreview` flag
- Add preview routes:
  - `/templates/:id/preview/presentation` — Shows PresentationView with mock data
  - `/templates/:id/preview/participant` — Shows ParticipantSession with mock vote
- Generate mock votes using template response options

**Modified Files:**
- `src/hooks/use-realtime-channel.ts` — Check preview context before subscribing
- `src/contexts/preview-context.tsx` — NEW context provider
- `src/pages/TemplatePreviewPresentation.tsx` — NEW preview page
- `src/pages/TemplatePreviewParticipant.tsx` — NEW preview page

---

## Feature 3: Team-Based Voting

### Problem
Sessions need to support multiple teams with separate QR codes, vote filtering, and results aggregation. Current model assumes all participants vote on same questions.

### Database Schema

**Add team dimension:**
```sql
-- Team participation tracking
ALTER TABLE votes ADD COLUMN team_id TEXT;
CREATE INDEX idx_votes_team_id ON votes(team_id);

-- Sessions can optionally use teams
ALTER TABLE sessions ADD COLUMN teams_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN team_ids JSONB; -- Array of team identifiers

-- Session items can be team-specific or shared
ALTER TABLE session_items ADD COLUMN team_filter TEXT; -- NULL = all teams
```

**Data Model:**
- `sessions.teams_enabled` — Boolean flag to enable team mode
- `sessions.team_ids` — JSONB array: `["red", "blue", "green"]`
- `votes.team_id` — Which team this vote belongs to
- `session_items.team_filter` — NULL (all teams) or team ID (team-specific content)

### QR Code Routing

**URL pattern:**
- Standard: `/session/:sessionId` (no team)
- Team-based: `/session/:sessionId/:teamId` (team-scoped)

**QR Code generation:**
```typescript
function generateTeamQRCodes(sessionId: string, teams: string[]): QRCode[] {
  return teams.map(team => ({
    teamId: team,
    url: `${origin}/session/${sessionId}/${team}`,
    displayName: team.toUpperCase(),
  }));
}
```

**Routing:**
```typescript
// In App.tsx
<Route path="/session/:sessionId/:teamId?" element={<ParticipantSession />} />

// In ParticipantSession.tsx
const { sessionId, teamId } = useParams();
const effectiveTeamId = teamId ?? null; // null = non-team session
```

### Realtime Channel Partitioning

**Single channel per session, team filtering via Presence metadata:**
```typescript
// Participant joins with team metadata
channel.track({
  userId: participantId,
  role: 'participant',
  teamId: effectiveTeamId, // Added field
  joinedAt: new Date().toISOString(),
});

// Admin counts participants per team
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  const teamCounts: Record<string, number> = {};

  for (const presences of Object.values(state)) {
    for (const p of presences as { role?: string; teamId?: string }[]) {
      if (p.role !== 'admin') {
        const team = p.teamId ?? 'default';
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      }
    }
  }

  setTeamParticipantCounts(teamCounts);
});
```

**Vote filtering in results:**
```typescript
// Filter votes by team when rendering results
function getTeamVotes(questionId: string, teamId: string | null): Vote[] {
  const allVotes = sessionVotes[questionId] ?? [];
  if (!teamId) return allVotes; // Non-team session
  return allVotes.filter(v => v.team_id === teamId);
}
```

**No additional channels needed** — Single channel per session, team is metadata.

### Integration Points

**Existing:**
- `useRealtimeChannel` tracks presence with `userId` and `role` (lines 62-97 in use-realtime-channel.ts)
- Vote insertion in `VoteAgreeDisagree` and `VoteMultipleChoice`
- QR code generation in `AdminSession`

**New:**
- Add team selection UI in session setup (draft mode)
- Generate multiple QR codes (one per team) when `teams_enabled = true`
- Pass `teamId` from URL params through to vote insertion
- Filter vote aggregation by team in admin results view
- Add team selector dropdown in admin view to switch between team results

**Modified Files:**
- `src/types/database.ts` — Add `team_id` to Vote, `teams_enabled` to Session
- `src/hooks/use-realtime-channel.ts` — Add `teamId` to presence tracking
- `src/components/VoteAgreeDisagree.tsx` — Include `teamId` in vote insert
- `src/components/VoteMultipleChoice.tsx` — Include `teamId` in vote insert
- `src/pages/ParticipantSession.tsx` — Extract `teamId` from URL
- `src/pages/AdminSession.tsx` — Add team QR generation, team filter UI
- Database migration: `supabase/migrations/YYYYMMDD_teams.sql`

---

## Feature 4: Inline Batch Editing

### Problem
Batch items in `SequenceManager` currently show name + question count. Authors need to expand batches inline to edit questions without navigating away.

### Solution: Collapsible Nested List

**Pattern:**
```typescript
function SequenceItemCard({ item, expanded, onToggleExpand }: Props) {
  const [isExpanded, setIsExpanded] = useState(expanded ?? false);

  if (item.item_type === 'batch' && item.batch_id) {
    return (
      <div>
        {/* Batch header — always visible */}
        <div onClick={() => setIsExpanded(!isExpanded)}>
          <CaretIcon direction={isExpanded ? 'down' : 'right'} />
          <span>{batch.name}</span>
          <span>{questionCount} questions</span>
        </div>

        {/* Nested question list — conditionally rendered */}
        {isExpanded && (
          <div className="pl-8 space-y-2">
            {batchQuestions.map(q => (
              <QuestionEditCard
                key={q.id}
                question={q}
                onEdit={(updates) => updateQuestion(q.id, updates)}
                onDelete={() => removeQuestion(q.id)}
              />
            ))}
            <button onClick={() => addQuestionToBatch(item.batch_id)}>
              + Add Question
            </button>
          </div>
        )}
      </div>
    );
  }

  // Slide item remains unchanged
  return <SlideCard item={item} />;
}
```

**State management:**
- Expanded state stored in parent `SequenceManager` (map of batchId → boolean)
- Questions fetched from `useSessionStore` filtered by `batch_id`
- Question edits update store + persist to database

**Sources:**
- [react-collapsed](https://blog.logrocket.com/create-collapsible-react-components-react-collapsed/) — Collapsible components with hooks
- [DevExtreme List](https://js.devexpress.com/React/Documentation/Guide/UI_Components/List/Grouping/Expand_and_Collapse_a_Group/) — Expand/collapse groups

### Integration Points

**Existing:**
- `SequenceItemCard` renders batch header (lines 95-109 in SequenceItemCard.tsx)
- `onExpandBatch` callback navigates away from sequence view
- Questions stored in `useSessionStore.questions`

**New:**
- Replace `onExpandBatch` navigation with inline expansion
- Add `expandedBatches: Set<string>` state to `SequenceManager`
- Render `QuestionList` nested under batch when expanded
- Add visual indent (left padding) for nested questions
- Keep drag handle on batch header only (not on nested questions)

**Modified Files:**
- `src/components/SequenceItemCard.tsx` — Add expansion UI and nested question rendering
- `src/components/SequenceManager.tsx` — Manage expanded state
- `src/components/QuestionEditCard.tsx` — NEW compact question editor for inline use

---

## Feature 5: Multi-Select in dnd-kit

### Problem
Authors need to select multiple items (batches/slides) and drag them together or bulk delete. dnd-kit doesn't provide built-in multi-select.

### Solution: Custom Selection State Layer

**Pattern:**
```typescript
function SequenceManager() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragRepresentativeId, setDragRepresentativeId] = useState<string | null>(null);

  // Multi-select via Cmd/Ctrl+Click
  function handleItemClick(itemId: string, event: React.MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(itemId) ? next.delete(itemId) : next.add(itemId);
        return next;
      });
    } else {
      setSelectedIds(new Set([itemId]));
    }
  }

  // Drag representative item, move all selected on drop
  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setDragRepresentativeId(id);

    // If dragging unselected item, select it first
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set([id]));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const itemsToMove = Array.from(selectedIds);
    const newIndex = sortableIds.indexOf(over.id as string);

    // Move all selected items to new position as a group
    const reordered = moveItemsAsGroup(sortableIds, itemsToMove, newIndex);
    const updates = reordered.map((id, idx) => ({ id, position: idx }));

    useSessionStore.getState().updateSessionItemPositions(updates);
    reorderSessionItems(updates);

    setDragRepresentativeId(null);
  }

  // Bulk delete
  function handleBulkDelete() {
    for (const id of selectedIds) {
      const item = sessionItems.find(i => i.id === id);
      if (item) deleteSessionItem(item);
    }
    setSelectedIds(new Set());
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex gap-2 mb-3">
          <span>{selectedIds.size} selected</span>
          <button onClick={handleBulkDelete}>Delete Selected</button>
        </div>
      )}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds}>
          {sessionItems.map(item => (
            <SequenceItemCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onClick={(e) => handleItemClick(item.id, e)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

**Key insight:** dnd-kit drags one item, but `onDragEnd` moves all selected items to maintain group.

**Source:** [dnd-kit multi-select discussion](https://github.com/clauderic/dnd-kit/issues/120) — Simulate multi-select by moving all selected items on DragEnd

### Integration Points

**Existing:**
- `SequenceManager` uses dnd-kit with single item dragging (lines 79-124 in SequenceManager.tsx)
- `SequenceItemCard` is sortable with drag handle (lines 27-41 in SequenceItemCard.tsx)

**New:**
- Add `selectedIds` state to `SequenceManager`
- Add `selected` prop to `SequenceItemCard` for visual highlight
- Intercept click events on cards for Cmd/Ctrl+Click selection
- Modify `handleDragEnd` to move all selected items as a group
- Add bulk action toolbar when items selected

**Modified Files:**
- `src/components/SequenceManager.tsx` — Add selection state and multi-move logic
- `src/components/SequenceItemCard.tsx` — Add selected highlight styling
- `src/lib/sequence-api.ts` — Ensure batch position updates handle groups

---

## Feature 6: Background Color Propagation

### Problem
Session items (slides, batches) need customizable background colors. Color must propagate from item → presentation view → participant view without prop drilling through 5+ components.

### Solution: Theme Context Pattern

**Pattern:**
```typescript
// Theme context provides color overrides
interface ThemeContextValue {
  backgroundColor: string; // Global default
  itemColors: Record<string, string>; // Per-item overrides
  setItemColor: (itemId: string, color: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  backgroundColor: '#1a1a1a',
  itemColors: {},
  setItemColor: () => {},
});

// Provider wraps entire app
function ThemeProvider({ children }: { children: ReactNode }) {
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [itemColors, setItemColors] = useState<Record<string, string>>({});

  const setItemColor = (itemId: string, color: string | null) => {
    setItemColors(prev => {
      const next = { ...prev };
      if (color === null) {
        delete next[itemId];
      } else {
        next[itemId] = color;
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ backgroundColor, itemColors, setItemColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Components consume theme
function SlideDisplay({ imagePath, itemId }: Props) {
  const { backgroundColor, itemColors } = useContext(ThemeContext);
  const effectiveColor = itemColors[itemId] ?? backgroundColor;

  return (
    <div style={{ backgroundColor: effectiveColor }}>
      <img src={imagePath} />
    </div>
  );
}

// Admin editor sets colors
function SessionItemEditor({ item }: Props) {
  const { setItemColor } = useContext(ThemeContext);

  return (
    <input
      type="color"
      onChange={(e) => setItemColor(item.id, e.target.value)}
    />
  );
}
```

**Persistence:**
```sql
-- Store color in session_items
ALTER TABLE session_items ADD COLUMN bg_color TEXT;

-- Load colors into context on session load
useEffect(() => {
  const colors: Record<string, string> = {};
  for (const item of sessionItems) {
    if (item.bg_color) colors[item.id] = item.bg_color;
  }
  setItemColors(colors);
}, [sessionItems]);
```

**Source:** [React Context for Theming](https://www.geeksforgeeks.org/reactjs/create-a-context-provider-for-theming-using-react-hooks/) — Theme context provider pattern

### Integration Points

**Existing:**
- `SlideDisplay` hardcodes `bg-[#1a1a1a]` (line 10 in SlideDisplay.tsx)
- `PresentationView` wraps content (line 330 in PresentationView.tsx)

**New:**
- Add `ThemeProvider` wrapping `<BrowserRouter>` in `App.tsx`
- Add color picker in `SequenceItemCard` when editing
- Persist color to `session_items.bg_color` on change
- `SlideDisplay` reads color from `ThemeContext`
- `BatchResultsProjection` reads color from `ThemeContext`

**Modified Files:**
- `src/contexts/theme-context.tsx` — NEW context provider
- `src/App.tsx` — Wrap with ThemeProvider
- `src/components/SlideDisplay.tsx` — Use context color
- `src/components/BatchResultsProjection.tsx` — Use context color
- `src/components/SequenceItemCard.tsx` — Add color picker UI
- Database migration: Add `bg_color` column to `session_items`

---

## Feature 7: Batch-Slide Association

### Problem
Batches need optional "cover images" displayed before batch voting starts. Current model has no relationship between batches and slides.

### Database Schema

**Add foreign key linking batches to slides:**
```sql
-- Batches can reference a cover image from session_items
ALTER TABLE batches ADD COLUMN cover_slide_id UUID REFERENCES session_items(id) ON DELETE SET NULL;

-- Constraint: cover_slide must be a slide type, not batch
ALTER TABLE batches ADD CONSTRAINT valid_cover_slide
  CHECK (
    cover_slide_id IS NULL OR
    EXISTS (
      SELECT 1 FROM session_items
      WHERE id = cover_slide_id AND item_type = 'slide'
    )
  );
```

**Data Model:**
- `batches.cover_slide_id` — Optional FK to `session_items` (must be type='slide')
- If set, presentation shows slide before activating batch questions
- If null, batch activates directly

**Presentation Flow:**
```typescript
// When batch activated, check for cover slide
async function activateBatch(batchId: string) {
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return;

  if (batch.cover_slide_id) {
    // Show cover slide first
    await activateSlide(batch.cover_slide_id, 'forward');
    // Admin clicks "next" to start batch voting
  } else {
    // Skip directly to batch voting
    await activateBatchVoting(batchId);
  }
}
```

**UI for association:**
```typescript
// In batch editor
function BatchEditor({ batch }: Props) {
  const slides = sessionItems.filter(i => i.item_type === 'slide');

  return (
    <div>
      <label>Cover Slide (optional)</label>
      <select
        value={batch.cover_slide_id ?? ''}
        onChange={(e) => updateBatch(batch.id, {
          cover_slide_id: e.target.value || null
        })}
      >
        <option value="">None</option>
        {slides.map(slide => (
          <option key={slide.id} value={slide.id}>
            {slide.slide_caption || 'Untitled Slide'}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Integration Points

**Existing:**
- Batches stored in `useSessionStore.batches` (lines 96-111 in session-store.ts)
- Batch activation broadcasts `batch_activated` event (AdminSession.tsx)

**New:**
- Add `cover_slide_id` field to `Batch` type in `types/database.ts`
- Add cover slide selector in batch creation/edit UI
- Modify batch activation flow to show cover slide first (if set)
- Add "Skip to Questions" button on cover slide in admin view

**Modified Files:**
- `src/types/database.ts` — Add `cover_slide_id` to Batch interface
- `src/components/BatchEditor.tsx` — Add cover slide selector
- `src/pages/AdminSession.tsx` — Two-stage batch activation (cover → questions)
- Database migration: Add `cover_slide_id` column to `batches`

---

## Data Flow Patterns

### Template Creation Flow
```
User clicks "New Template"
  → TemplateEditor page loads (mode='template')
  → SequenceManager in template mode (no Realtime)
  → User drags batches/slides, edits inline
  → Click "Save Template"
  → Serialize sessionItems → SessionBlueprint JSONB
  → Insert into session_templates table
  → Return to template list
```

### Template → Live Session Flow
```
User clicks "Use Template" on template
  → Fetch template.blueprint from database
  → Create new session (draft status)
  → For each blueprint.sessionItems:
    - Insert batch (if type='batch') + questions
    - Insert session_item (if type='slide')
  → Load AdminSession with new sessionId
  → Session ready for editing/launch
```

### Team Voting Flow
```
Admin enables teams → Enters team names
  → QR codes generated for each team
  → Participant scans team-specific QR
  → URL: /session/:sessionId/:teamId
  → Vote includes team_id column
  → Admin filters results by team dropdown
  → Presence counts shown per team
```

### Preview Flow
```
Template author clicks "Preview Presentation"
  → Load template.blueprint (no session created)
  → Wrap PresentationView in PreviewContext
  → Mock data: activeItemId, votes, participant count
  → Realtime subscription disabled (isPreview=true)
  → Navigation controls cycle through blueprint items
  → No database writes
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prop Drilling for Mode State

**What people do:** Pass `isLive`, `isTemplate`, `isDraft` booleans through 5 levels of components.

**Why it's wrong:**
- Easy to pass wrong combination (e.g., `isLive=true` + `isTemplate=true`)
- No compile-time enforcement of valid states
- Adding new modes requires updating all intermediate components

**Do this instead:**
Use discriminated unions with mode-specific props. TypeScript enforces valid combinations.

```typescript
// BAD
<SequenceManager isLive={true} isTemplate={false} isDraft={false} sessionId={id} />

// GOOD
<SequenceManager mode="live" sessionId={id} onActivateItem={...} />
```

### Anti-Pattern 2: Creating Separate Realtime Channels Per Team

**What people do:** Create `session:${sessionId}:${teamId}` channels for each team.

**Why it's wrong:**
- Multiplies connection overhead (3 teams = 3 channels)
- Admin must subscribe to all channels to see all teams
- Presence counts require aggregating across channels

**Do this instead:**
Single channel per session, team as Presence metadata. Filter in application layer.

```typescript
// BAD
const channel = supabase.channel(`session:${sessionId}:${teamId}`);

// GOOD
const channel = supabase.channel(`session:${sessionId}`);
channel.track({ userId, role: 'participant', teamId });
```

### Anti-Pattern 3: Duplicating Presentation Components for Preview

**What people do:** Create `PresentationPreview.tsx` with copied code from `PresentationView.tsx`.

**Why it's wrong:**
- Code duplication → bugs fixed in one place but not the other
- Feature parity divergence over time
- Double maintenance burden

**Do this instead:**
Use Preview Context to inject mock data into existing components.

```typescript
// BAD
<PresentationPreview template={template} /> // Separate component

// GOOD
<PreviewContext.Provider value={mockData}>
  <PresentationView /> // Reuse existing component
</PreviewContext.Provider>
```

### Anti-Pattern 4: Storing Background Color in Multiple Places

**What people do:** Store color in component state + database + global store.

**Why it's wrong:**
- State synchronization bugs (color updated in one place but not others)
- Unclear source of truth
- Refetch required to see updates

**Do this instead:**
Single source of truth (database), loaded into Context on mount.

```typescript
// BAD
const [bgColor, setBgColor] = useState('#fff'); // Component state
const globalColor = useGlobalStore(s => s.bgColor); // Global store
// Which one is correct?

// GOOD
const { itemColors } = useContext(ThemeContext); // Single source
const color = itemColors[itemId] ?? defaultColor;
```

---

## Build Order Recommendations

### Phase 1: Mode Separation (Foundation)
1. Add discriminated union types for component modes
2. Refactor `SequenceManager` to accept mode prop
3. Create `TemplateEditor` page using mode='template'
4. Implement template CRUD (no preview yet)

**Rationale:** Establishes mode pattern used by all other features.

### Phase 2: Preview System
1. Add `PreviewContext` provider
2. Modify `useRealtimeChannel` to respect preview flag
3. Create preview routes with mock data generation
4. Test presentation/participant preview rendering

**Rationale:** Depends on template creation (Phase 1). Enables testing other features without live sessions.

### Phase 3: Background Color Theming
1. Add `ThemeContext` provider
2. Add `bg_color` column to database
3. Modify `SlideDisplay` and `BatchResultsProjection` to use context
4. Add color picker UI in item editor

**Rationale:** Independent feature, no dependencies on other new features.

### Phase 4: Inline Batch Editing
1. Add expand/collapse state to `SequenceManager`
2. Render nested question list in `SequenceItemCard`
3. Create `QuestionEditCard` compact editor
4. Test question CRUD within expanded batch

**Rationale:** Requires template mode (Phase 1) but independent of teams/preview.

### Phase 5: Team-Based Voting
1. Add team schema to database (team_id columns)
2. Modify vote insertion to include team_id
3. Add team selection UI in session setup
4. Generate team-specific QR codes
5. Add team filter in results view
6. Test multi-team voting flow

**Rationale:** Most complex feature, benefits from preview system (Phase 2) for testing.

### Phase 6: Batch-Slide Association
1. Add `cover_slide_id` to batches table
2. Add cover slide selector in batch editor
3. Modify batch activation flow for two-stage display
4. Test cover slide → batch transition

**Rationale:** Simple extension after inline editing (Phase 4) is complete.

### Phase 7: Multi-Select DnD
1. Add selection state to `SequenceManager`
2. Implement Cmd/Ctrl+Click selection
3. Modify drag-end to move groups
4. Add bulk action toolbar
5. Test multi-item operations

**Rationale:** Final polish feature, least critical path. Requires stable sequencing from earlier phases.

---

## Scaling Considerations

| Concern | Current (< 100 sessions) | At Scale (1000+ sessions) | At Large Scale (10K+ sessions) |
|---------|--------------------------|---------------------------|-------------------------------|
| **Template Storage** | JSONB in PostgreSQL | Same — JSONB indexed | Consider separate blob storage |
| **Team Presence** | Single channel, metadata filtering | Same — efficient | Consider team-scoped channels if > 20 teams |
| **Background Colors** | React Context per session | Same — minimal overhead | Inline in session_items fetch |
| **Preview Mock Data** | Generated client-side | Same | Consider pre-generated snapshots |
| **Multi-Select State** | Component state | Same | No scaling issue (UI only) |

**First bottleneck:** Template blueprints become large (100+ items) → JSONB query performance degrades.

**Mitigation:** Add GIN index on `session_templates.blueprint` for JSONB queries. Paginate template list.

**Second bottleneck:** Team presence tracking with 50+ teams → Client-side filtering becomes expensive.

**Mitigation:** Move team count aggregation to server-side edge function. Cache counts with 1-second TTL.

---

## Sources

### Official Documentation
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime) — Broadcast, Presence, Postgres Changes
- [dnd-kit Documentation](https://docs.dndkit.com) — Drag and drop toolkit
- [React Context API](https://legacy.reactjs.org/docs/context.html) — Context propagation
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — Type narrowing

### Architecture Patterns (2026)
- [TypeScript Discriminated Unions for React Components](https://oneuptime.com/blog/post/2026-01-15-typescript-discriminated-unions-react-props/view) — Mode-aware component props
- [React Context for Theming](https://www.geeksforgeeks.org/reactjs/create-a-context-provider-for-theming-using-react-hooks/) — Theme provider pattern
- [dnd-kit Multi-Select Discussion](https://github.com/clauderic/dnd-kit/issues/120) — Custom multi-select implementation

### Component Libraries
- [Preview.js](https://previewjs.com/) — Component preview with mock data
- [react-collapsed](https://blog.logrocket.com/create-collapsible-react-components-react-collapsed/) — Collapsible components
- [DevExtreme List](https://js.devexpress.com/React/Documentation/Guide/UI_Components/List/Grouping/Expand_and_Collapse_a_Group/) — Expand/collapse groups

### Research Queries
- React template authoring separate from live instance architecture patterns 2026
- Preview mode simulating UI without real data React 2026
- React discriminated union component modes TypeScript pattern 2026
- Collapsible nested list expand collapse inline editing React 2026
- dnd-kit multi-select drag drop multiple items React 2026
- React context vs props component theming background color propagation 2026

---

*Architecture research for: QuickVote v1.4 — Template Authoring, Teams, and Presentation Polish*
*Researched: 2026-02-12*
