# Phase 25: Team-Based Voting - Research

**Researched:** 2026-02-14
**Domain:** Multi-team voting, team assignment, filtered aggregation, QR code generation, CSV export
**Confidence:** HIGH

## Summary

Team-based voting adds a team dimension to the existing voting system, allowing participants to join teams and enabling admins to filter results by team. The implementation requires database schema changes to store team configuration, participant-team associations, team-specific QR code URLs, and filtered vote aggregation. The phase integrates with the existing session lifecycle, participant join flow, presentation controls, and export functionality.

The core technical challenges are:
1. **Team data storage** — Storing team names at the session level with minimal schema changes
2. **Team assignment** — Handling both self-select (via team picker dropdown) and auto-assign (via team-specific QR codes)
3. **Filtered aggregation** — Efficiently filtering vote counts by team without duplicating aggregation logic
4. **QR code grid** — Generating team-specific URLs and displaying multiple QR codes simultaneously on the projection
5. **CSV export enhancement** — Adding a team column to existing export format

**Primary recommendation:** Store teams as JSONB array on sessions table, add team_id column to votes table, use client-side filtering for tab bar (backed by RPC for complex queries if needed), extend existing QR components for grid layout, and add team column to CSV export.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Team configuration
- Teams configured at the session level, NOT in the template editor
- Admin enters team names via free-form list (add/remove individual names)
- Maximum 4-5 teams per session
- Teams must be configured before going live — locked after Go Live (no mid-session changes)

#### Team joining flow
- Both assignment paths: general QR shows team picker, team-specific QR auto-assigns
- General (non-team) QR code still works when teams are enabled — shows team picker
- Team picker uses dropdown select with a Join button
- Participants can switch teams until they cast their first vote, then locked
- Small team badge visible to participant during voting

#### Results filtering
- Horizontal tab bar for team filter: All | Team A | Team B | ...
- Projection follows admin's filter — whatever team admin selects, projection shows the same
- When filtering by team, bars show only that team's votes (filter totals, not stacked/segmented)
- Vote counts, percentages, and participation stats all scoped to the selected team filter

#### QR codes & export
- Team QR codes displayed as projection overlay — admin can show them on the projection screen
- Grid layout showing all team QR codes side by side with team names
- Export format: single CSV with a 'team' column (user filters/pivots in their spreadsheet)

### Claude's Discretion
- Database schema for team storage (sessions table column, separate table, etc.)
- RPC design for team-filtered vote aggregation
- Exact tab bar styling and placement within existing presentation UI
- QR code generation library/approach
- Team badge styling and placement on participant view

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qrcode.react | 4.2.0 | QR code rendering | Already in use, supports both SVG and Canvas rendering, TypeScript support |
| @supabase/supabase-js | 2.93.1 | Database client | Project standard for all data operations |
| PostgreSQL JSONB | Built-in | Team list storage | Native support, no additional dependencies, efficient for small arrays (4-5 teams) |
| Tailwind CSS | 4.1.18 | Styling | Project standard for all UI components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.24.4 | Schema validation | For team name validation and CSV export schema |
| React Router | 7.6.1 | URL parameter parsing | For team-specific QR code URLs (e.g., `/session/:sessionId?team=TeamA`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB array on sessions table | Separate teams table | Separate table adds join complexity for a simple list of 4-5 strings. JSONB is sufficient for this use case. |
| URL query parameter (?team=X) | Path parameter (/session/:sessionId/:teamId) | Query parameter is more flexible for optional team assignment and doesn't require route changes. |
| Client-side filtering | Server-side RPC for all filters | Client-side is simpler for small datasets, but RPC option should be available for large sessions. |

**Installation:**
No new dependencies required. All necessary libraries already present in package.json.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── team-api.ts              # Team CRUD operations
│   ├── vote-aggregation.ts      # Enhanced with team filtering
│   └── session-export.ts        # Enhanced with team column
├── components/
│   ├── TeamPicker.tsx           # Dropdown for self-select team join
│   ├── TeamBadge.tsx            # Small badge showing participant's team
│   ├── TeamFilterTabs.tsx       # Horizontal tab bar for admin/projection
│   ├── TeamQRGrid.tsx           # Grid of team QR codes for projection overlay
│   └── QRCode.tsx               # Extend for team-specific URLs
└── pages/
    ├── AdminSession.tsx         # Add team configuration UI
    ├── ParticipantSession.tsx   # Add team picker when joining
    └── PresentationView.tsx     # Add team filter tabs
```

### Pattern 1: Team Storage — JSONB Array on Sessions Table
**What:** Store team names as a JSONB array column on the sessions table rather than a separate teams table.
**When to use:** For simple lists with known small maximum size (4-5 teams) that are session-scoped.
**Example:**
```sql
-- Migration: Add teams column to sessions table
ALTER TABLE sessions ADD COLUMN teams JSONB DEFAULT '[]'::jsonb;

-- Constraint: Maximum 5 teams
ALTER TABLE sessions ADD CONSTRAINT max_5_teams
  CHECK (jsonb_array_length(teams) <= 5);

-- Example data
-- teams: ["Team Alpha", "Team Beta", "Team Gamma"]
```

**Why this approach:**
- Simplifies queries: no join required to fetch session + teams
- Atomic updates: team configuration changes happen in single UPDATE
- Matches lifecycle: teams are locked when session goes live (same as session status)
- Performance: JSONB arrays are efficient for small lists ([PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html))

### Pattern 2: Participant-Team Association — team_id on Votes Table
**What:** Add a team_id TEXT column to the votes table to track which team each participant belongs to.
**When to use:** When filtering aggregated data by team.
**Example:**
```sql
-- Migration: Add team_id to votes table
ALTER TABLE votes ADD COLUMN team_id TEXT;

-- Index for efficient filtering
CREATE INDEX idx_votes_team_id ON votes(team_id);
CREATE INDEX idx_votes_session_team ON votes(session_id, team_id);
```

**Why this approach:**
- Team is locked when first vote is cast (matches requirement)
- Team appears on every vote row (simplifies aggregation filtering)
- No separate participants table needed (keeps architecture simple)
- Supports team switching before first vote (NULL team_id until locked)

### Pattern 3: Team-Specific QR Codes — URL Query Parameter
**What:** Generate team-specific URLs using query parameters rather than path segments.
**When to use:** For optional parameters that don't require route changes.
**Example:**
```typescript
// General URL (shows team picker)
const generalUrl = `${origin}/session/${sessionId}`;

// Team-specific URLs (auto-assign to team)
const teamAUrl = `${origin}/session/${sessionId}?team=${encodeURIComponent('Team Alpha')}`;
const teamBUrl = `${origin}/session/${sessionId}?team=${encodeURIComponent('Team Beta')}`;

// In ParticipantSession.tsx, read query param
const searchParams = new URLSearchParams(location.search);
const autoAssignTeam = searchParams.get('team');
```

**Why this approach:**
- No router changes required (existing `/session/:sessionId` route handles it)
- Clean fallback behavior (general QR still works)
- Standard URL pattern (query params for optional modifiers)

### Pattern 4: Vote Aggregation with Team Filtering
**What:** Extend existing `aggregateVotes()` and `buildConsistentBarData()` functions to accept optional team filter.
**When to use:** When displaying results filtered by team.
**Example:**
```typescript
// Enhanced vote aggregation function
export function aggregateVotes(votes: Vote[], teamFilter?: string | null): VoteCount[] {
  // Filter votes by team if specified
  const filteredVotes = teamFilter
    ? votes.filter(v => v.team_id === teamFilter)
    : votes;

  const total = filteredVotes.length;
  const counts = filteredVotes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.value] = (acc[vote.value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([value, count]) => ({
    value,
    count,
    percentage: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

// Usage in AdminSession.tsx
const aggregated = aggregateVotes(questionVotes, selectedTeam);
```

**Why this approach:**
- Minimal changes to existing aggregation logic
- Client-side filtering works for typical session sizes
- Can be backed by RPC if performance becomes an issue
- Consistent with existing patterns in codebase

### Pattern 5: Team Filter State Sync — Broadcast Channel
**What:** Broadcast team filter changes from admin to projection view using existing realtime channel.
**When to use:** When projection should mirror admin's team filter selection.
**Example:**
```typescript
// AdminSession.tsx — Admin changes team filter
function handleTeamFilterChange(teamId: string | null) {
  setSelectedTeam(teamId);
  channelRef.current?.send({
    type: 'broadcast',
    event: 'team_filter_changed',
    payload: { teamId },
  });
}

// PresentationView.tsx — Projection listens for filter changes
channel.on('broadcast', { event: 'team_filter_changed' }, ({ payload }) => {
  setSelectedTeam(payload.teamId);
});
```

**Why this approach:**
- Reuses existing realtime infrastructure
- Matches pattern used for question activation, slide changes, etc.
- Instant sync with no polling required
- Follows established pattern in `AdminSession.tsx` and `PresentationView.tsx`

### Pattern 6: CSV Export with Team Column
**What:** Add team_id as a column in the exported CSV for vote data.
**When to use:** When exporting session data with team information.
**Example:**
```typescript
// Enhanced VoteExportSchema
const VoteExportSchema = z.object({
  participant_id: z.string(),
  value: z.string(),
  reason: z.string().nullable(),
  team_id: z.string().nullable(), // NEW: team column
});

// In exportSession() function
votes: voteList
  .filter(v => v.question_id === q.id)
  .map(v => ({
    participant_id: v.participant_id,
    value: v.value,
    reason: v.reason,
    team_id: v.team_id, // NEW: include team
  })),
```

**Why this approach:**
- Single CSV file (user's requirement)
- Standard CSV structure (one row per vote)
- User can filter/pivot in Excel/Google Sheets
- Follows existing export pattern in `session-export.ts`

### Anti-Patterns to Avoid

- **Separate participants table:** Don't create a participants table just to store team associations. The votes table already has participant_id and adding team_id there is sufficient.
- **Nested team data in JSONB votes:** Don't store team details (name, color, etc.) in each vote's JSONB. Store only team_id and join with session.teams for display.
- **Stacked/segmented bars:** User explicitly requested filtered totals, not stacked bars showing all teams simultaneously. When a team is selected, show ONLY that team's votes.
- **Team changes during voting:** Don't allow team switching after first vote is cast. Lock the team by storing team_id when the first vote is created.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom canvas/SVG QR renderer | qrcode.react (already in project) | Handles error correction levels, sizing, optimization, and edge cases |
| CSV generation | String concatenation with manual escaping | Existing session-export pattern or export-to-csv library | Handles quoting, escaping, and special characters correctly |
| Team name validation | Ad-hoc string checks | Zod schema with .refine() | Validates duplicates, empty names, special characters, max length |
| URL encoding | Manual encodeURI | URLSearchParams API | Properly handles special characters in team names |

**Key insight:** The codebase already has robust patterns for QR codes, CSV export, and schema validation. Extend these rather than building new implementations from scratch.

---

## Common Pitfalls

### Pitfall 1: Team Configuration After Go Live
**What goes wrong:** Admin tries to add/remove teams after session is active, breaking participant-team associations.
**Why it happens:** No enforcement that teams are locked when session status changes to 'active'.
**How to avoid:**
- Add UI check: disable team editor when `session.status !== 'draft'`
- Add database constraint or trigger to prevent team updates on active sessions
- Show warning message if admin tries to edit teams post-launch
**Warning signs:** Participants see "Team X" but it's no longer in session.teams array.

### Pitfall 2: Team Filter Not Updating Participation Stats
**What goes wrong:** Participation count shows total participants even when team filter is active.
**Why it happens:** Forgetting to filter participant count calculation by team.
**How to avoid:** Create a helper function that returns filtered participant count:
```typescript
function getParticipantCount(votes: Vote[], teamFilter?: string | null): number {
  const filteredVotes = teamFilter
    ? votes.filter(v => v.team_id === teamFilter)
    : votes;
  return new Set(filteredVotes.map(v => v.participant_id)).size;
}
```
**Warning signs:** "3 participants voted" shows when team filter is active, but only 2 participants are on that team.

### Pitfall 3: Team Picker Not Shown When Teams Enabled
**What goes wrong:** Participant joins via general QR but doesn't see team picker, gets assigned no team.
**Why it happens:** Not checking if session has teams configured before showing picker.
**How to avoid:** Fetch session.teams on participant join, show picker only if teams.length > 0:
```typescript
if (session.teams && session.teams.length > 0 && !autoAssignTeam) {
  setShowTeamPicker(true);
}
```
**Warning signs:** Votes have NULL team_id even though session has teams configured.

### Pitfall 4: Team-Specific QR Showing Picker
**What goes wrong:** User scans team-specific QR code but still sees team picker instead of auto-assignment.
**Why it happens:** Not reading or applying the `?team=` query parameter.
**How to avoid:**
- Parse query param on mount: `const autoTeam = new URLSearchParams(location.search).get('team')`
- Auto-assign team and skip picker if autoTeam is present
- Validate autoTeam exists in session.teams before assigning
**Warning signs:** Team-specific QR codes generate correct URLs but participants still manually select teams.

### Pitfall 5: Projection Not Syncing Team Filter
**What goes wrong:** Admin selects a team filter but projection shows "All Teams" view.
**Why it happens:** Projection doesn't listen to `team_filter_changed` broadcast event.
**How to avoid:**
- Add broadcast listener in PresentationView.tsx for team filter changes
- Initialize projection's team filter from session state on load
- Show visual indicator on projection when a team filter is active
**Warning signs:** Admin sees filtered results but projection shows unfiltered totals.

### Pitfall 6: RLS Policies Blocking Team Queries
**What goes wrong:** Queries fail or return empty results when filtering by team.
**Why it happens:** Row-level security policies don't account for team_id column in WHERE clauses.
**How to avoid:**
- Test RLS policies with team_id filters before deployment
- Ensure "Anyone can read votes" policy allows filtering by team_id
- No RLS changes required for team_id (it's just a filter column, not an access control)
**Warning signs:** Queries work in SQL editor but fail in application with RLS enabled.

### Pitfall 7: Team Badge Blocking Vote Buttons
**What goes wrong:** Team badge overlaps with vote buttons on participant view.
**Why it happens:** Poor placement or z-index conflicts.
**How to avoid:**
- Place team badge in top-right corner, away from voting UI
- Use small, subtle badge (similar to existing ParticipantCount component)
- Test on mobile viewport sizes
**Warning signs:** Participants report difficulty tapping vote buttons on mobile.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### QR Code Component with Custom URL
Source: Existing codebase `src/components/QRCode.tsx` + [qrcode.react documentation](https://github.com/zpao/qrcode.react)

```typescript
import { QRCodeSVG } from 'qrcode.react';

interface TeamQRCodeProps {
  sessionId: string;
  teamName: string;
}

export function TeamQRCode({ sessionId, teamName }: TeamQRCodeProps) {
  const teamUrl = `${window.location.origin}/session/${sessionId}?team=${encodeURIComponent(teamName)}`;

  return (
    <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-xl shadow-lg">
      <QRCodeSVG
        value={teamUrl}
        size={200}
        level="M"
        marginSize={1}
      />
      <p className="text-sm font-medium text-gray-700">{teamName}</p>
    </div>
  );
}
```

### Team Filter Tabs Component
Source: Existing Tailwind patterns in codebase

```typescript
interface TeamFilterTabsProps {
  teams: string[];
  selectedTeam: string | null;
  onTeamChange: (teamId: string | null) => void;
}

export function TeamFilterTabs({ teams, selectedTeam, onTeamChange }: TeamFilterTabsProps) {
  return (
    <div className="flex gap-2 border-b border-gray-200">
      <button
        onClick={() => onTeamChange(null)}
        className={`px-4 py-2 font-medium transition-colors ${
          selectedTeam === null
            ? 'border-b-2 border-blue-500 text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        All Teams
      </button>
      {teams.map((team) => (
        <button
          key={team}
          onClick={() => onTeamChange(team)}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTeam === team
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {team}
        </button>
      ))}
    </div>
  );
}
```

### Team Picker Dropdown
Source: Standard React pattern

```typescript
interface TeamPickerProps {
  teams: string[];
  onJoinTeam: (teamId: string) => void;
}

export function TeamPicker({ teams, onJoinTeam }: TeamPickerProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  function handleJoin() {
    if (selectedTeam) {
      onJoinTeam(selectedTeam);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Select Your Team</h2>
      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Choose a team...</option>
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>
      <button
        onClick={handleJoin}
        disabled={!selectedTeam}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        Join Team
      </button>
    </div>
  );
}
```

### Team Badge Component
Source: Similar to ParticipantCount component

```typescript
interface TeamBadgeProps {
  teamName: string;
}

export function TeamBadge({ teamName }: TeamBadgeProps) {
  return (
    <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
      {teamName}
    </div>
  );
}
```

### Database Migration for Teams
Source: Existing migration patterns in `supabase/migrations/`

```sql
-- Migration: 20260215_080_add_teams.sql

-- Add teams column to sessions table
ALTER TABLE sessions ADD COLUMN teams JSONB DEFAULT '[]'::jsonb;

-- Add team_id to votes table
ALTER TABLE votes ADD COLUMN team_id TEXT;

-- Index for efficient team filtering
CREATE INDEX idx_votes_team_id ON votes(team_id);
CREATE INDEX idx_votes_session_team ON votes(session_id, team_id);

-- Constraint: Maximum 5 teams per session
ALTER TABLE sessions ADD CONSTRAINT max_5_teams
  CHECK (jsonb_array_length(teams) <= 5);

-- Comment for documentation
COMMENT ON COLUMN sessions.teams IS 'Array of team names for this session (max 5)';
COMMENT ON COLUMN votes.team_id IS 'Team assignment for this participant (locked on first vote)';
```

### Team Configuration UI Helper
Source: Zod validation pattern from `template-api.ts`

```typescript
import { z } from 'zod';

const TeamListSchema = z.array(z.string().min(1).max(50))
  .max(5)
  .refine(
    (teams) => new Set(teams).size === teams.length,
    { message: 'Team names must be unique' }
  );

export function validateTeamList(teams: string[]): { valid: boolean; error?: string } {
  try {
    TeamListSchema.parse(teams);
    return { valid: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { valid: false, error: err.errors[0].message };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CSV string building | Schema-validated export with Zod | Phase 22 (2026-02) | Type-safe exports, consistent format |
| Inline QR generation | QRCodeSVG component | Phase 2 | Reusable, consistent QR codes |
| Direct vote counting | aggregateVotes() + buildConsistentBarData() | Phase 14 | Consistent bar ordering, template support |
| Manual realtime subscriptions | useRealtimeChannel hook | Phase 10 | Simplified channel management |

**Current patterns to follow:**
- Use Zod schemas for all data validation
- Use existing aggregation functions for vote counting
- Use broadcast events for admin-to-projection sync
- Use Tailwind for all styling (no CSS modules or styled-components)
- Use TypeScript interfaces from types/database.ts

**Deprecated/outdated:**
- None relevant to this phase

---

## Open Questions

1. **Should team filter state persist in URL query params?**
   - What we know: Admin's team filter selection affects projection view via broadcast
   - What's unclear: Should filter state survive page reload (via URL param) or reset to "All Teams"?
   - Recommendation: Reset to "All Teams" on reload for simplicity. Broadcast handles live sync.

2. **Should team assignment be stored in a separate row or only on votes?**
   - What we know: Requirement says participant can switch teams until first vote
   - What's unclear: Do we need to track team assignment before any votes are cast?
   - Recommendation: Store team_id only on votes table. If participant hasn't voted yet, they have no team_id (NULL). Team picker shows again on page refresh until first vote locks it in.

3. **Should there be a team join confirmation step?**
   - What we know: Dropdown + Join button is the UI pattern
   - What's unclear: Should there be a confirmation ("You are now on Team Alpha") or just proceed to voting?
   - Recommendation: Show brief confirmation toast ("Joined Team Alpha"), then proceed to voting immediately. Similar to existing vote submission feedback.

4. **How should participation count work with team filter?**
   - What we know: Participation stats should be scoped to selected team filter
   - What's unclear: Should it show "3 of 12 participants voted" (team out of total) or "3 participants voted" (team only)?
   - Recommendation: Show team-scoped count only ("3 participants voted") when filter is active. Simpler and clearer.

---

## Sources

### Primary (HIGH confidence)
- [qrcode.react GitHub](https://github.com/zpao/qrcode.react) - QR code component API and TypeScript types
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html) - JSONB data type specification
- Existing codebase patterns:
  - `src/lib/vote-aggregation.ts` - Vote counting and filtering patterns
  - `src/lib/session-export.ts` - CSV export schema and download utilities
  - `src/components/QRCode.tsx` - QR code component usage
  - `supabase/migrations/` - Database migration patterns and conventions
  - `src/types/database.ts` - TypeScript type definitions

### Secondary (MEDIUM confidence)
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) - Team filtering pattern with RLS
- [How to Use Row-Level Security in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-row-level-security-postgresql/view) - Team member access patterns
- [PostgreSQL JSONB - Powerful Storage for Semi-Structured Data](https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage) - JSONB vs separate table tradeoffs
- [Supabase RPC guide and best practices](https://www.restack.io/docs/supabase-knowledge-supabase-rpc-guide) - RPC performance optimization

### Tertiary (LOW confidence)
- [When To Avoid JSONB In A PostgreSQL Schema](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) - General JSONB guidance (not specific to this use case)
- [export-to-csv - npm](https://www.npmjs.com/package/export-to-csv) - Alternative CSV library (current pattern is sufficient)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Patterns match existing codebase conventions
- Pitfalls: MEDIUM - Based on common RLS and state sync issues, not project-specific

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days, stable domain with established patterns)
