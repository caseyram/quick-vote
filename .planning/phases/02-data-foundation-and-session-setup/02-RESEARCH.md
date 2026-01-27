# Phase 2: Data Foundation and Session Setup - Research

**Researched:** 2026-01-27
**Domain:** Supabase PostgreSQL schema design, RLS policies, anonymous auth, React routing, session/question CRUD
**Confidence:** HIGH

## Summary

Phase 2 builds the data layer and admin experience for QuickVote: database schema (sessions, questions), Row Level Security policies, anonymous auth integration, client-side routing, and admin CRUD for session/question management. The admin creates a session, receives a unique admin URL, adds questions, and can revisit later. A separate participant URL exists but exposes no admin token.

The standard approach uses Supabase anonymous auth (`signInAnonymously()`) to give every client a JWT, enabling RLS policies that work for both admin and participant access patterns. The database schema follows the architecture research with two key identifiers: a UUID `admin_token` (secret, for admin URLs) and a nanoid `session_id` (public, for participant URLs). React Router v7 in declarative mode handles client-side routing. Zustand v5 manages session and question state.

**Primary recommendation:** Build the schema in the Supabase SQL editor, integrate anonymous auth on app load, use RLS policies that distinguish admin operations via `admin_token` passed as a parameter, and build the admin UI with React Router v7 declarative routing + Zustand for state.

## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.93.1 (installed) | Database queries, auth, realtime | Already installed. v2 is current stable line. No v3 has shipped. |
| react-router | ^7.9.x | Client-side routing (admin/participant URLs) | React Router v7 is the standard. Import from `"react-router"`, not `"react-router-dom"`. |
| zustand | ^5.0.10 | Client-side state management | Decided in STATE.md. v5 is current, minimal API change from v4 (dropped deprecated features). |
| nanoid | ^5.1.6 | URL-friendly unique IDs for public session codes | 118 bytes, URL-safe, cryptographically strong. Already decided in STACK.md research. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase CLI | latest | Type generation, migrations (optional) | Run `npx supabase gen types typescript` after schema changes to get typed client. Optional for Phase 2 -- can also define types manually. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router | TanStack Router | More type-safe but larger learning curve. React Router v7 is sufficient for QuickVote's simple route structure. |
| nanoid for session codes | crypto.randomUUID() | UUID is 36 chars with hyphens -- ugly in URLs. nanoid produces 21-char URL-safe IDs. Use UUID for DB primary keys and admin_token, nanoid for public session_id. |
| Manual types | supabase gen types | Generated types are better long-term but require CLI setup. For Phase 2, manually defining types is acceptable and faster to start. |

**Installation:**
```bash
npm install react-router zustand nanoid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── supabase.ts              # Existing Supabase client
├── types/
│   └── database.ts              # TypeScript types for DB tables
├── stores/
│   └── session-store.ts         # Zustand store for session/question state
├── pages/
│   ├── Demo.tsx                 # Existing (keep for now)
│   ├── Home.tsx                 # Landing page -- "Create Session" CTA
│   ├── AdminSession.tsx         # Admin view for a session (questions CRUD)
│   └── ParticipantSession.tsx   # Participant view (placeholder for Phase 3)
├── components/
│   ├── QuestionForm.tsx         # Add/edit question form
│   ├── QuestionList.tsx         # Sortable list of questions
│   └── Layout.tsx               # Shared layout wrapper
├── hooks/
│   └── use-auth.ts              # Anonymous auth initialization hook
├── App.tsx                      # Router setup
└── main.tsx                     # Entry point
```

### Pattern 1: Anonymous Auth on App Load
**What:** Call `supabase.auth.signInAnonymously()` once when the app loads. Store the session. All subsequent Supabase calls use the authenticated JWT.
**When to use:** On every page load, before any data operations.
**Why:** Gives every client (admin or participant) a JWT with `auth.uid()`, enabling RLS policies. Without this, the client uses the `anon` Postgres role which has weaker security guarantees.

```typescript
// Source: Supabase Anonymous Sign-Ins docs
// https://supabase.com/docs/guides/auth/auth-anonymous

// hooks/use-auth.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initAuth() {
      // Check for existing session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No session -- sign in anonymously
        await supabase.auth.signInAnonymously();
      }
      setReady(true);
    }
    initAuth();
  }, []);

  return { ready };
}
```

**Important notes:**
- Anonymous sign-ins must be enabled in Supabase Dashboard > Project Settings > Authentication > User Signups > Anonymous Sign-Ins.
- Anonymous users get the `authenticated` Postgres role, NOT the `anon` role.
- The JWT includes an `is_anonymous` claim set to `true`.
- Default rate limit: 30 anonymous sign-ins per hour per IP.
- Abandoned anonymous accounts are NOT auto-cleaned by Supabase -- manual cleanup may be needed later.
- The anonymous user session persists in the browser (via cookie/localStorage managed by Supabase). Refreshing the page reuses the same session.

### Pattern 2: Dual-Identifier URL Security
**What:** Sessions have two separate identifiers: `admin_token` (UUID, secret) and `session_id` (nanoid, public). Admin URLs use the token; participant URLs use the public ID.
**When to use:** Always. This is the core security model.

```typescript
// URL structure
// Admin:       /admin/{admin_token}     -- UUID, unguessable
// Participant: /session/{session_id}    -- nanoid, public

// Route setup with react-router v7
import { BrowserRouter, Routes, Route } from 'react-router';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/:adminToken" element={<AdminSession />} />
        <Route path="/session/:sessionId" element={<ParticipantSession />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Pattern 3: Session Creation Flow
**What:** Admin clicks "Create Session" on the landing page. Client generates a nanoid for `session_id`, inserts the session row (DB generates UUID `admin_token`), and redirects to the admin URL.
**When to use:** Landing page CTA.

```typescript
// Source: Supabase JS docs + nanoid
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';

async function createSession(title: string) {
  const sessionId = nanoid(); // 21-char URL-safe ID

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      session_id: sessionId,
      title: title || 'Untitled Session',
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select('admin_token')
    .single();

  if (error) throw error;

  // Redirect to admin URL
  return `/admin/${data.admin_token}`;
}
```

### Pattern 4: Admin Token Verification
**What:** When the admin page loads, fetch the session by `admin_token`. If it exists, the user is the admin. If not, show 404.
**When to use:** On AdminSession page mount.

```typescript
async function loadAdminSession(adminToken: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, questions(*)')
    .eq('admin_token', adminToken)
    .single();

  if (error || !data) {
    // Not found or not authorized -- show 404
    return null;
  }

  return data;
}
```

### Pattern 5: Question CRUD with Position Ordering
**What:** Questions have a `position` integer for ordering. New questions get `max(position) + 1`. Reordering updates positions in a batch.
**When to use:** Admin question management.

```typescript
// Add a question at the end
async function addQuestion(sessionId: string, question: {
  text: string;
  type: 'agree_disagree' | 'multiple_choice';
  options?: string[];
}) {
  // Get current max position
  const { data: existing } = await supabase
    .from('questions')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0
    ? existing[0].position + 1
    : 0;

  const { data, error } = await supabase
    .from('questions')
    .insert({
      session_id: sessionId,
      text: question.text,
      type: question.type,
      options: question.options ?? null,
      position: nextPosition,
    })
    .select()
    .single();

  return { data, error };
}

// Reorder questions (batch update positions)
async function reorderQuestions(
  questionIds: string[],
  sessionId: string
) {
  // questionIds is in the new order
  const updates = questionIds.map((id, index) => ({
    id,
    session_id: sessionId,
    position: index,
  }));

  const { error } = await supabase
    .from('questions')
    .upsert(updates, { onConflict: 'id' });

  return { error };
}
```

### Pattern 6: React Router v7 Declarative Mode (SPA)
**What:** Use React Router v7 in declarative mode with `BrowserRouter`, `Routes`, and `Route`. No loaders, no data mode, no framework mode. Supabase data fetching happens in components via hooks/effects.
**When to use:** This is a Vite SPA, not a framework app. Declarative mode is correct.

```typescript
// Import from "react-router" (NOT "react-router-dom" in v7)
import { BrowserRouter, Routes, Route } from 'react-router';
```

**Critical:** In React Router v7, the package is `react-router` (not `react-router-dom`). All imports come from `react-router`. The `react-router-dom` package is no longer needed.

### Pattern 7: Zustand Store for Session State
**What:** A Zustand store holds the current session, questions, and loading/error state. Components select slices they need.
**When to use:** Admin session page.

```typescript
// Source: Zustand v5 docs
// https://zustand.docs.pmnd.rs/

import { create } from 'zustand';

interface Session {
  id: string;
  session_id: string;
  admin_token: string;
  title: string;
  status: string;
  created_at: string;
}

interface Question {
  id: string;
  session_id: string;
  text: string;
  type: 'agree_disagree' | 'multiple_choice';
  options: string[] | null;
  position: number;
  anonymous: boolean;
  status: string;
}

interface SessionState {
  session: Session | null;
  questions: Question[];
  loading: boolean;
  error: string | null;

  setSession: (session: Session) => void;
  setQuestions: (questions: Question[]) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (orderedIds: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  questions: [],
  loading: false,
  error: null,

  setSession: (session) => set({ session }),
  setQuestions: (questions) => set({ questions: questions.sort((a, b) => a.position - b.position) }),
  addQuestion: (question) => set((state) => ({
    questions: [...state.questions, question].sort((a, b) => a.position - b.position),
  })),
  updateQuestion: (id, updates) => set((state) => ({
    questions: state.questions.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    ),
  })),
  removeQuestion: (id) => set((state) => ({
    questions: state.questions.filter((q) => q.id !== id),
  })),
  reorderQuestions: (orderedIds) => set((state) => ({
    questions: orderedIds
      .map((id, index) => {
        const q = state.questions.find((q) => q.id === id);
        return q ? { ...q, position: index } : null;
      })
      .filter(Boolean) as Question[],
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

### Anti-Patterns to Avoid
- **Putting admin_token in the database SELECT for participants:** RLS must ensure participant queries NEVER return the `admin_token` column. Use a separate select for admin vs participant access.
- **Using auto-increment IDs for session URLs:** Sequential IDs are guessable. Use UUID for admin_token and nanoid for session_id.
- **Skipping anonymous auth and using anon key directly:** Without anonymous auth, RLS policies cannot use `auth.uid()`. The anon key uses the `anon` Postgres role, not `authenticated`. This limits RLS expressiveness.
- **Creating routes that expose admin_token in participant-facing URLs:** The participant route must ONLY contain the public `session_id`. Never `admin_token`.
- **Fetching questions without ordering by position:** Always `ORDER BY position ASC` when fetching questions. The database does not guarantee insertion order.

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,        -- nanoid, public, for participant URLs
  admin_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- secret, for admin URLs
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'lobby', 'active', 'ended')),
  created_by UUID REFERENCES auth.users(id),  -- anonymous auth user who created it
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for participant lookup by session_id
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
-- Index for admin lookup by admin_token
CREATE INDEX idx_sessions_admin_token ON sessions(admin_token);
```

### Questions Table
```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agree_disagree', 'multiple_choice')),
  options JSONB,                          -- for MC: ["Option A", "Option B", ...]
  position INTEGER NOT NULL DEFAULT 0,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed', 'revealed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching questions by session
CREATE INDEX idx_questions_session_id ON questions(session_id);
```

### Votes Table (Schema Only -- Not Used in Phase 2)
```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,           -- auth.uid() from anonymous auth
  value TEXT NOT NULL,                    -- the chosen option
  display_name TEXT,                      -- nullable, for named voting
  locked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, participant_id)     -- idempotent votes from day one
);

-- Index for realtime subscription filter and result aggregation
CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_question_id ON votes(question_id);
```

### RLS Policies

```sql
-- ============================================
-- SESSIONS: RLS Policies
-- ============================================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can create a session
CREATE POLICY "Authenticated users can create sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anyone can read sessions (needed for participant join by session_id)
-- IMPORTANT: Use a view or column-level security to hide admin_token from participants
CREATE POLICY "Anyone can read sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

-- Only the creator can update their sessions
CREATE POLICY "Creator can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = created_by);

-- Only the creator can delete their sessions
CREATE POLICY "Creator can delete own sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = created_by);

-- ============================================
-- QUESTIONS: RLS Policies
-- ============================================
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read questions (participants need to see them)
CREATE POLICY "Anyone can read questions"
  ON questions FOR SELECT
  TO authenticated
  USING (true);

-- Only session creator can insert questions
-- Uses a subquery to check session ownership
CREATE POLICY "Session creator can insert questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

-- Only session creator can update questions
CREATE POLICY "Session creator can update questions"
  ON questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

-- Only session creator can delete questions
CREATE POLICY "Session creator can delete questions"
  ON questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

-- ============================================
-- VOTES: RLS Policies (schema exists for Phase 3)
-- ============================================
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert votes
CREATE POLICY "Authenticated users can insert votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = participant_id);

-- Anyone can read votes (needed for result aggregation)
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  TO authenticated
  USING (true);

-- Participants can update their own votes (change vote before lock-in)
CREATE POLICY "Users can update own votes"
  ON votes FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = participant_id);
```

### Admin Token Security Note

The `admin_token` column is exposed via the SELECT policy on `sessions` because the admin client needs to verify it. To prevent participants from seeing it, there are two approaches:

**Approach A (Recommended for v1):** Application-level filtering. When fetching for participants, explicitly select columns excluding `admin_token`:
```typescript
// Participant query -- no admin_token
const { data } = await supabase
  .from('sessions')
  .select('id, session_id, title, status, created_at')
  .eq('session_id', publicSessionId)
  .single();

// Admin query -- includes admin_token
const { data } = await supabase
  .from('sessions')
  .select('*')
  .eq('admin_token', adminToken)
  .single();
```

**Approach B (More secure, consider for later):** Create a Postgres view that excludes `admin_token` and grant participants access only to the view. This provides column-level security at the database level.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-safe unique IDs | Custom random string generator | `nanoid` (118 bytes) | Cryptographically secure, URL-safe alphabet, collision-resistant. Custom generators often use `Math.random()` which is not cryptographically secure. |
| UUID generation | Custom UUID function | PostgreSQL `gen_random_uuid()` | DB-native, proper randomness, no client-side generation needed for admin tokens. |
| Client-side routing | Manual `window.location` parsing | `react-router` v7 | Handles browser history, URL params, nested routes, redirects. Manual parsing breaks on edge cases (back button, direct URL access, etc.). |
| State management | React Context with manual optimization | `zustand` v5 | Selector-based subscriptions prevent unnecessary re-renders. Context re-renders all consumers on any state change. |
| Anonymous auth / JWT | Custom token generation | Supabase `signInAnonymously()` | Gives proper JWT, integrates with RLS, handles session persistence, auto-refresh. Custom tokens would require an Edge Function and bypass Supabase's auth infrastructure. |
| Ordered list management | Manual position calculation | DB `position` column + batch upsert | The database is the source of truth. Client-side-only ordering loses state on refresh. |

**Key insight:** This phase is almost entirely "standard Supabase CRUD + React routing." The complexity is in the security model (dual identifiers, RLS), not in novel technology. Use the established patterns.

## Common Pitfalls

### Pitfall 1: RLS Blocks All Access When Enabled Without Policies
**What goes wrong:** You enable RLS on a table but forget to create policies. All queries return empty results with no error -- just an empty array.
**Why it happens:** RLS defaults to "deny all" when enabled. Supabase returns `[]` not an error for empty RLS results.
**How to avoid:** Always create policies immediately after enabling RLS. Test each CRUD operation after adding policies. If queries return empty results unexpectedly, check RLS policies first.
**Warning signs:** `.select()` returns `{ data: [], error: null }` when you know rows exist.

### Pitfall 2: Anonymous Auth Not Enabled in Supabase Dashboard
**What goes wrong:** `signInAnonymously()` returns an error like "Anonymous sign-ins are disabled."
**Why it happens:** Anonymous sign-ins are disabled by default in Supabase. Must be explicitly enabled in the Dashboard.
**How to avoid:** Before any code: go to Supabase Dashboard > Project Settings > Authentication > User Signups section > Enable "Anonymous Sign-Ins" > Save.
**Warning signs:** Auth error on first page load.

### Pitfall 3: Admin Token Leaked in Participant URLs
**What goes wrong:** A developer accidentally uses `admin_token` in the participant join URL, or includes it in a `select('*')` query that's used on the participant page.
**Why it happens:** Convenience -- `select('*')` grabs everything, including `admin_token`.
**How to avoid:** Always use explicit column lists in participant-facing queries. Never include `admin_token` in participant URL construction. Code review specifically for this.
**Warning signs:** Participant can see `admin_token` in browser DevTools network tab.

### Pitfall 4: nanoid Import Fails (ESM-only in v5)
**What goes wrong:** `import { nanoid } from 'nanoid'` throws an error in CommonJS environments.
**Why it happens:** nanoid v5 is ESM-only. No CommonJS support.
**How to avoid:** This is a non-issue for this project because Vite handles ESM natively. But if you see import errors, check that your build tool supports ESM.
**Warning signs:** Build errors mentioning "require is not defined" or ESM/CJS conflicts.

### Pitfall 5: Question Position Gaps After Deletion
**What goes wrong:** Questions have positions [0, 1, 2]. Delete question at position 1. Now positions are [0, 2]. New question gets position 3. The order looks correct but positions have gaps, making reordering logic fragile.
**Why it happens:** Deletion does not re-normalize positions.
**How to avoid:** After deletion, re-normalize positions (batch update remaining questions). OR treat positions as relative (sort by position, don't assume contiguous).
**Warning signs:** Questions display correctly but the `position` column has gaps like [0, 3, 7].

### Pitfall 6: Race Condition on Session Creation
**What goes wrong:** Two rapid clicks on "Create Session" create two sessions. The user sees a blank page because the redirect goes to the first session but the UI loaded the second.
**Why it happens:** No debouncing on the create button, no optimistic disable.
**How to avoid:** Disable the button on click, show loading state. Use a ref to track in-flight request. Only redirect on the first successful response.
**Warning signs:** Multiple sessions in the database with similar `created_at` timestamps.

## Code Examples

Verified patterns from official sources:

### Supabase Anonymous Auth Initialization
```typescript
// Source: https://supabase.com/docs/guides/auth/auth-anonymous
const { data, error } = await supabase.auth.signInAnonymously();
// data.user.id is the UUID for this anonymous user
// data.session contains the JWT
// The JWT's is_anonymous claim is true
```

### Supabase Typed Client Setup
```typescript
// Source: https://supabase.com/docs/reference/javascript/typescript-support
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Supabase Upsert (for reordering questions)
```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
const { data, error } = await supabase
  .from('questions')
  .upsert(
    [
      { id: 'q1', session_id: 'abc', position: 0 },
      { id: 'q2', session_id: 'abc', position: 1 },
      { id: 'q3', session_id: 'abc', position: 2 },
    ],
    { onConflict: 'id' }
  )
  .select();
```

### React Router v7 Declarative Setup
```typescript
// Source: https://reactrouter.com/ (v7 docs)
// NOTE: In v7, import from "react-router" NOT "react-router-dom"
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router';

function App() {
  const { ready } = useAuth(); // anonymous auth

  if (!ready) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/:adminToken" element={<AdminSession />} />
        <Route path="/session/:sessionId" element={<ParticipantSession />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Zustand v5 Store Creation
```typescript
// Source: https://zustand.docs.pmnd.rs/guides/beginner-typescript
// NOTE: In Zustand v5, use create<T>()(fn) with double parens
import { create } from 'zustand';

interface SessionState {
  session: Session | null;
  setSession: (s: Session) => void;
}

const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

// Usage in component:
function MyComponent() {
  const session = useSessionStore((s) => s.session);
  // Only re-renders when session changes
}
```

### nanoid Usage
```typescript
// Source: https://github.com/ai/nanoid
import { nanoid } from 'nanoid';

const sessionId = nanoid();      // "V1StGXR8_Z5jdHi6B-myT" (21 chars)
const shortCode = nanoid(10);    // "IRFa-VaY2b" (custom length)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-router-dom` package | `react-router` package (single package) | React Router v7 (late 2024) | Import from `"react-router"` not `"react-router-dom"`. Single package covers all web routing. |
| Zustand `create(...)` | Zustand `create<T>()(...)` (curried) | Zustand v5 (2025) | Extra parens needed for TypeScript. No new features -- just dropped deprecated APIs. |
| nanoid CJS support | nanoid ESM-only | nanoid v5 (2024) | Must use ESM imports. Not an issue with Vite. |
| Supabase JS v2 anon key only | Supabase anonymous auth + JWT | Available since 2024 | `signInAnonymously()` gives proper JWT for RLS. Must be enabled in Dashboard. |
| `tailwind.config.js` | CSS-first config (`@import "tailwindcss"`) | Tailwind v4 (Feb 2025) | No JS config file needed. Already set up in Phase 1. |

**Deprecated/outdated:**
- `react-router-dom`: Use `react-router` instead for v7
- Zustand v4 `create(...)` without currying: Works but deprecated pattern
- `framer-motion` package name: Now `motion` (verify at install time -- not needed for Phase 2)

## Routing Strategy

### Finalized URL Structure (Freeze This)

| Route | Purpose | Who Sees It |
|-------|---------|-------------|
| `/` | Landing page, "Create Session" | Everyone |
| `/admin/:adminToken` | Admin session management | Admin only (via unique link) |
| `/session/:sessionId` | Participant entry & voting | Participants (via QR code / shared link) |

**The participant URL `/session/:sessionId` is frozen.** QR codes will be generated pointing to this path. Do not change it after Phase 2.

**Admin URLs are private.** The `adminToken` is a UUID -- 36 characters, unguessable (2^122 possibilities). Admin shares only the participant URL and keeps the admin URL to themselves.

### Vercel Rewrite Rule
Already in place from Phase 1:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
This ensures SPA routing works -- all paths serve `index.html` and React Router handles the rest.

## RLS Design Rationale

### Why Anonymous Auth Over Anon Key Alone

The project could theoretically work with just the Supabase `anon` key (no `signInAnonymously()`). However:

1. **Without anonymous auth:** All clients use the `anon` Postgres role. RLS policies can only distinguish "anon" from "authenticated" but cannot identify individual users. The `auth.uid()` function returns NULL.

2. **With anonymous auth:** Each client gets a unique `auth.uid()`. RLS policies can enforce "only the session creator can edit their session" by matching `auth.uid()` to `sessions.created_by`.

3. **Future benefit:** When Phase 3 adds voting, `auth.uid()` becomes the `participant_id` for vote de-duplication (UNIQUE constraint on `question_id, participant_id`).

**Decision: Use anonymous auth.** The small overhead (one API call on app load) pays for itself immediately in RLS expressiveness and later in vote identity.

### RLS Performance Note

From the official Supabase docs on RLS performance best practices:
- Wrap `auth.uid()` and `auth.jwt()` calls in `(select ...)` to enable the Postgres optimizer to cache the result per-statement (e.g., `(select auth.uid())` instead of `auth.uid()`).
- Add indexes on columns referenced in RLS policies (we have indexes on `session_id`, `admin_token`, etc.).
- Separate policies by operation (SELECT, INSERT, UPDATE, DELETE) rather than using `FOR ALL`.

All policies in our schema follow these best practices.

## Open Questions

Things that could not be fully resolved:

1. **Column-level security for admin_token**
   - What we know: RLS policies apply at the row level, not column level. The SELECT policy on `sessions` exposes all columns including `admin_token` to any authenticated user.
   - What's unclear: Whether Postgres column-level privileges work seamlessly with Supabase's auto-generated API, or if a view is needed.
   - Recommendation: For Phase 2, use application-level column selection (explicit `.select('col1, col2')` without `admin_token` in participant queries). Revisit for a database-level solution if needed before production.

2. **Question reordering UX (drag-and-drop library)**
   - What we know: The data model supports reordering via `position` column. The UI needs a drag-and-drop interaction.
   - What's unclear: Best library for React 19 drag-and-drop (dnd-kit, @hello-pangea/dnd, etc.). This is a UI concern that can be deferred.
   - Recommendation: For Phase 2, implement reordering with simple "move up / move down" buttons. Defer drag-and-drop to Phase 5 (polish). This avoids researching and integrating a DnD library now.

3. **Supabase Dashboard anonymous auth setup**
   - What we know: Must be enabled in Dashboard > Project Settings > Authentication. Cannot be done via CLI or SQL.
   - What's unclear: Whether it's already enabled for the project.
   - Recommendation: First task in Phase 2 should check/enable this setting as a checkpoint.

## Sources

### Primary (HIGH confidence)
- [Supabase Anonymous Sign-Ins Guide](https://supabase.com/docs/guides/auth/auth-anonymous) - API, RLS patterns, enabling steps
- [Supabase JS signInAnonymously() API Reference](https://supabase.com/docs/reference/javascript/auth-signinanonymously) - Method signature, parameters
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy patterns, performance best practices
- [Supabase Upsert Documentation](https://supabase.com/docs/reference/javascript/upsert) - onConflict syntax, options
- [Supabase TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) - gen types workflow
- [React Router v7 Documentation](https://reactrouter.com/) - SPA mode, declarative routing
- [React Router v7 createBrowserRouter API](https://api.reactrouter.com/v7/functions/react_router.createBrowserRouter.html) - API reference
- [Zustand v5 Documentation](https://zustand.docs.pmnd.rs/) - TypeScript guide, store creation
- [nanoid GitHub](https://github.com/ai/nanoid) - Usage, version, ESM-only note

### Secondary (MEDIUM confidence)
- [Supabase Database Migrations Guide](https://supabase.com/docs/guides/deployment/database-migrations) - CLI workflow for migrations
- [Supabase RLS Performance Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - `(select auth.uid())` pattern
- [React Router v7 SPA Mode](https://reactrouter.com/how-to/spa) - Framework mode SPA (not directly applicable but informative)

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified against npm registry (supabase-js 2.93.1 installed, react-router 7.9.x, zustand 5.0.10, nanoid 5.1.6)
- Architecture: HIGH - Schema follows established patterns from ARCHITECTURE.md research, verified against Supabase official docs
- RLS/Auth: HIGH - Anonymous auth API verified against official Supabase docs. RLS patterns follow documented best practices.
- Pitfalls: HIGH - Common issues documented in official Supabase troubleshooting docs and well-known in the ecosystem
- Routing: HIGH - React Router v7 declarative mode verified as correct approach for Vite SPA

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days -- stable technologies, unlikely to change)
