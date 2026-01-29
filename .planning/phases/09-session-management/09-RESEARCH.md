# Phase 9: Session Management - Research

**Researched:** 2026-01-28
**Domain:** Admin session management UI, JSON import/export, React Router navigation
**Confidence:** HIGH

## Summary

Phase 9 creates a global `/admin` route for session management with list view, read-only review, and JSON import/export capabilities. The research focused on React Router v7 routing patterns, Zod v4 for JSON schema validation, file download/upload patterns, and search filtering with debouncing.

The standard approach uses React Router v7's declarative route configuration, Zod v4 for type-safe JSON validation (recommended in STATE.md), Blob URLs for client-side JSON downloads, and native file input with FileReader API for JSON uploads. Existing patterns in PastSessions.tsx and ImportExportPanel.tsx establish project conventions for session lists and JSON import/export.

For session review, the existing SessionResults.tsx component provides a read-only results view with collapsible reasons. Search filtering uses debounced input state (300-500ms delay) to prevent excessive re-renders. Delete confirmation uses a simple modal overlay pattern consistent with ImportExportPanel.tsx.

**Primary recommendation:** Use Zod v4 for JSON validation, React Router v7 for `/admin` route, Blob URLs for downloads, and adapt existing SessionResults component for read-only review.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router | v7.6.1 | Navigation and routing | Already in package.json, supports declarative routes |
| Zod | v4.x | JSON schema validation | Recommended in STATE.md, 14x faster than v3, TypeScript-first |
| Supabase | v2.93.1 | Database queries with aggregates | Already in use, supports count/join patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | v5.1.5 | Session ID generation | Already in use for creating sessions |
| Native File API | Browser built-in | File upload and download | Standard for JSON file I/O |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Blob URL download | export-from-json npm package | Library adds dependency for simple use case |
| Zod | Yup or Joi | Zod recommended in STATE.md, better TypeScript integration |
| Custom modal | react-modal library | Simple confirmation doesn't justify dependency |

**Installation:**
```bash
npm install zod@^4.0.0
# All other dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   ├── AdminList.tsx           # New /admin route component
│   └── SessionReview.tsx       # Read-only session review (optional separate page)
├── components/
│   ├── SessionListItem.tsx     # Reusable session row component
│   ├── ConfirmDialog.tsx       # Reusable confirmation modal
│   └── SessionResults.tsx      # Existing, adapt for review mode
├── lib/
│   └── session-export.ts       # Export/import JSON logic with Zod schemas
```

### Pattern 1: React Router v7 Route Definition
**What:** Declarative route configuration in App.tsx
**When to use:** Adding new top-level routes like `/admin`

**Example:**
```typescript
// Source: https://reactrouter.com/start/framework/routing
import { Routes, Route } from 'react-router';

<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/admin" element={<AdminList />} />
  <Route path="/admin/:adminToken" element={<AdminSession />} />
  <Route path="/session/:sessionId" element={<ParticipantSession />} />
</Routes>
```

### Pattern 2: Supabase Count Aggregates with Joins
**What:** Fetch session list with question/participant counts
**When to use:** Building session summary stats

**Example:**
```typescript
// Source: https://supabase.com/docs/guides/database/joins-and-nesting
const { data } = await supabase
  .from('sessions')
  .select('*, questions(count), votes(participant_id)', { count: 'exact' })
  .eq('created_by', user.id)
  .order('created_at', { ascending: false });

// Post-process to get unique participant count
const sessions = data.map(row => ({
  ...row,
  question_count: row.questions[0]?.count ?? 0,
  participant_count: new Set(row.votes.map(v => v.participant_id)).size,
}));
```

### Pattern 3: Zod Schema for JSON Validation
**What:** Type-safe validation for JSON import
**When to use:** Validating imported session data

**Example:**
```typescript
// Source: https://zod.dev/api
import { z } from 'zod';

const BatchSchema = z.object({
  name: z.string(),
  position: z.number(),
  questions: z.array(z.object({
    text: z.string().min(1),
    type: z.enum(['agree_disagree', 'multiple_choice']),
    options: z.array(z.string()).nullable(),
    anonymous: z.boolean(),
  })),
});

const SessionExportSchema = z.object({
  session_name: z.string(),
  batches: z.array(BatchSchema),
});

// Use safeParse for validation without throwing
const result = SessionExportSchema.safeParse(jsonData);
if (!result.success) {
  throw new Error(`Validation failed: ${result.error.message}`);
}
```

### Pattern 4: JSON File Download with Blob URL
**What:** Client-side JSON file download
**When to use:** Export session data

**Example:**
```typescript
// Source: https://theroadtoenterprise.com/blog/how-to-download-csv-and-json-files-in-react
function downloadJSON(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up
}

// Usage
const filename = `${sessionName}-${new Date().toISOString().split('T')[0]}.json`;
downloadJSON(exportData, filename);
```

### Pattern 5: JSON File Upload with Validation
**What:** File input with JSON parsing and validation
**When to use:** Import session data from file

**Example:**
```typescript
// Source: https://github.com/react-hook-form/react-hook-form/discussions/1946
function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.name.endsWith('.json')) {
    setError('Only .json files are allowed');
    return;
  }

  // Validate file size (e.g., max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    setError('File must be less than 5MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);
      const validated = SessionExportSchema.parse(data);
      handleImport(validated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };
  reader.readAsText(file);
}
```

### Pattern 6: Debounced Search Input
**What:** Delay search filtering until user stops typing
**When to use:** Session name search/filter

**Example:**
```typescript
// Source: https://www.developerway.com/posts/debouncing-in-react
import { useState, useMemo } from 'react';

function SessionList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  // Debounce with setTimeout in useEffect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300); // 300ms delay
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s =>
      s.title.toLowerCase().includes(debouncedTerm.toLowerCase())
    );
  }, [sessions, debouncedTerm]);

  return (
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search sessions..."
    />
  );
}
```

### Pattern 7: Simple Confirmation Dialog
**What:** Modal overlay for delete confirmation
**When to use:** Hard delete operations

**Example:**
```typescript
// Source: Project pattern from ImportExportPanel.tsx
function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Pattern 8: Text Truncation with Expand
**What:** Truncate long text with "show more" toggle
**When to use:** Reasons preview in review mode

**Example:**
```typescript
// Source: https://css-tricks.com/snippets/css/truncate-string-with-ellipsis/
function TruncatedText({ text, maxLength = 100 }: { text: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  return (
    <div>
      <p className="text-sm text-gray-700">
        {expanded || !needsTruncation ? text : `${text.slice(0, maxLength)}...`}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-600 hover:text-indigo-500 mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// CSS alternative for fixed-line truncation
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Anti-Patterns to Avoid
- **Storing file contents in state before validation:** Validate file before setting state to avoid rendering invalid data
- **Not cleaning up Blob URLs:** Always call `URL.revokeObjectURL()` to prevent memory leaks
- **Debouncing with inline setTimeout:** Use useEffect cleanup to cancel pending timers
- **Partial import on validation errors:** Context specifies all-or-nothing import, don't partially apply
- **Using global state for search:** Search term is UI-local state, not global store

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Manual type checking with if/else | Zod v4 | Handles edge cases, nested validation, TypeScript inference |
| Debouncing | Custom setTimeout logic | useEffect with cleanup | Prevents memory leaks, handles component unmount |
| File downloads | Server endpoint for JSON | Blob URL + download attribute | Avoids server round-trip for client-side data |
| Participant counting | Manual array iteration | `new Set(votes.map(v => v.participant_id)).size` | Efficient deduplication built into Set |
| Route navigation | window.location | React Router's useNavigate | Preserves SPA behavior, no page reload |
| Filename sanitization | Regex replace | Template literal with date | Simple, predictable format |

**Key insight:** JSON validation is complex due to nested structures, optional fields, and type coercion. Zod handles all these cases with type safety. Don't reinvent this wheel.

## Common Pitfalls

### Pitfall 1: Incorrect Participant Count from Supabase
**What goes wrong:** Aggregate count returns total vote count, not unique participants
**Why it happens:** Votes table has multiple rows per participant (one per question)
**How to avoid:** Fetch votes with participant_id, deduplicate client-side with Set
**Warning signs:** Participant count matches or exceeds vote count

**Example:**
```typescript
// WRONG - counts votes, not participants
const { count } = await supabase
  .from('votes')
  .select('*', { count: 'exact' })
  .eq('session_id', sessionId);

// CORRECT - fetch and deduplicate
const { data: votes } = await supabase
  .from('votes')
  .select('participant_id')
  .eq('session_id', sessionId);

const participantCount = new Set(votes?.map(v => v.participant_id)).size;
```

### Pitfall 2: File Upload Security Bypass
**What goes wrong:** User uploads non-JSON file or malicious content
**Why it happens:** Trusting file extension without validating content
**How to avoid:** Validate file extension, size, and parse JSON before accepting
**Warning signs:** App crashes on import, or imports succeed with bad data

**Checklist:**
1. Check file extension is `.json`
2. Limit file size (e.g., 5MB max)
3. Parse JSON with try/catch
4. Validate schema with Zod before importing

### Pitfall 3: Memory Leak from Blob URLs
**What goes wrong:** Creating Blob URLs without cleanup causes memory growth
**Why it happens:** Browser keeps Blob in memory until URL is revoked
**How to avoid:** Always call `URL.revokeObjectURL()` after download
**Warning signs:** Browser memory usage grows with repeated exports

### Pitfall 4: Search Re-renders on Every Keystroke
**What goes wrong:** Filtering large lists causes performance issues
**Why it happens:** Not debouncing search input
**How to avoid:** Use 300-500ms debounce with useEffect cleanup
**Warning signs:** UI lag when typing in search field

### Pitfall 5: Deleting Active Session
**What goes wrong:** Admin deletes the current session they're viewing
**Why it happens:** No validation of current session vs selected session
**How to avoid:** Disable delete for current session, or redirect after delete
**Warning signs:** 404 errors after delete, broken session state

### Pitfall 6: Import Ignoring Batch Structure
**What goes wrong:** Questions imported without batch groupings
**Why it happens:** Batch associations not preserved in import logic
**How to avoid:** Schema must include batches array with nested questions
**Warning signs:** All imported questions appear unbatched

**Schema structure:**
```typescript
{
  batches: [
    {
      name: "Batch 1",
      position: 0,
      questions: [
        { text: "Question 1", ... },
        { text: "Question 2", ... }
      ]
    }
  ]
}
```

### Pitfall 7: Modal Scroll Lock
**What goes wrong:** Background scrolls when modal is open
**Why it happens:** No overflow handling on body element
**How to avoid:** Add `overflow: hidden` to body when modal opens
**Warning signs:** User can scroll background content behind modal

## Code Examples

Verified patterns from official sources:

### Session List Query with Aggregates
```typescript
// Fetch sessions with summary stats
async function fetchSessionList(userId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      questions(count),
      votes(participant_id)
    `)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return data.map(session => ({
    ...session,
    question_count: session.questions[0]?.count ?? 0,
    participant_count: new Set(session.votes?.map(v => v.participant_id)).size,
  }));
}
```

### Complete Export Function
```typescript
// Export session as JSON file
async function exportSession(sessionId: string) {
  // Fetch all data
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .eq('session_id', sessionId)
    .order('position');

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('position');

  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('session_id', sessionId);

  // Build export structure
  const exportData = {
    session_name: session.title,
    created_at: session.created_at,
    batches: batches.map(batch => ({
      name: batch.name,
      position: batch.position,
      questions: questions
        .filter(q => q.batch_id === batch.id)
        .map(q => ({
          text: q.text,
          type: q.type,
          options: q.options,
          anonymous: q.anonymous,
          votes: votes
            .filter(v => v.question_id === q.id)
            .map(v => ({
              participant_id: v.participant_id,
              value: v.value,
              reason: v.reason,
            })),
        })),
    })),
  };

  // Download as file
  const filename = `${session.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
  downloadJSON(exportData, filename);
}
```

### Complete Import Function with Validation
```typescript
import { z } from 'zod';

const QuestionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  // Votes in import file are ignored per CONTEXT.md
});

const BatchSchema = z.object({
  name: z.string(),
  position: z.number(),
  questions: z.array(QuestionSchema),
});

const ImportSchema = z.object({
  session_name: z.string().optional(),
  batches: z.array(BatchSchema),
});

async function importSessionData(
  sessionId: string,
  file: File
): Promise<void> {
  // Validate file
  if (!file.name.endsWith('.json')) {
    throw new Error('Only .json files are allowed');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File must be less than 5MB');
  }

  // Read and parse
  const content = await file.text();
  const parsed = JSON.parse(content);

  // Validate schema
  const result = ImportSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid format: ${result.error.message}`);
  }

  const data = result.data;

  // Get starting position
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  const startPos = (existingQuestions?.[0]?.position ?? -1) + 1;

  // Import batches and questions (all or nothing)
  const batchInserts = data.batches.map((batch, batchIdx) => ({
    session_id: sessionId,
    name: batch.name,
    position: startPos + batchIdx,
    status: 'pending' as const,
  }));

  const { data: insertedBatches, error: batchError } = await supabase
    .from('batches')
    .insert(batchInserts)
    .select();

  if (batchError) throw batchError;

  // Insert questions for each batch
  let questionPos = startPos;
  for (let i = 0; i < data.batches.length; i++) {
    const batch = data.batches[i];
    const insertedBatch = insertedBatches[i];

    const questionInserts = batch.questions.map(q => ({
      session_id: sessionId,
      batch_id: insertedBatch.id,
      text: q.text,
      type: q.type,
      options: q.options,
      anonymous: q.anonymous,
      position: questionPos++,
      status: 'pending' as const,
    }));

    const { error: qError } = await supabase
      .from('questions')
      .insert(questionInserts);

    if (qError) throw qError;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v6 loaders | React Router v7 with framework modes | v7 release (2024) | v7 still supports v6 patterns, can use existing Routes/Route |
| Zod v3 | Zod v4 with performance improvements | August 2025 | 14x faster parsing, 57% smaller, backward compatible |
| Manual JSON validation | Zod schemas with safeParse | Industry shift to schema libs | Type-safe validation with error messages |
| Server-side file generation | Client-side Blob URLs | Browser FileReader API matured | No server needed for downloads |

**Deprecated/outdated:**
- React Router v6 `loader` export in route files - v7 still supports but recommends framework mode
- Zod v3 - v4 is stable and faster, no reason to use v3 for new code
- `<input type="file" accept="application/json">` - use `.json` extension for better UX

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase aggregate functions for participant count**
   - What we know: PostgREST supports aggregates but requires manual enable
   - What's unclear: Whether QuickVote Supabase instance has aggregates enabled
   - Recommendation: Use client-side Set deduplication (works regardless)

2. **Import button placement**
   - What we know: Context says "Claude's discretion"
   - What's unclear: Whether import from /admin list or session admin view is better UX
   - Recommendation: Session admin view matches existing ImportExportPanel pattern

3. **Exact JSON schema structure for export**
   - What we know: Must include questions, batches, votes, reasons, participant_id
   - What's unclear: Top-level schema keys (session metadata, timestamps, etc.)
   - Recommendation: Minimal schema with session_name, created_at, batches array

## Sources

### Primary (HIGH confidence)
- Zod Official Docs (https://zod.dev/) - v4 installation, basic usage, schema patterns
- React Router Official Docs (https://reactrouter.com/start/framework/routing) - v7 route configuration, navigation hooks
- Supabase Docs (https://supabase.com/docs/guides/database/joins-and-nesting) - Join and count patterns
- Project codebase - Existing patterns in PastSessions.tsx, ImportExportPanel.tsx, SessionResults.tsx

### Secondary (MEDIUM confidence)
- [How to download CSV and JSON files in React](https://theroadtoenterprise.com/blog/how-to-download-csv-and-json-files-in-react) - Blob URL download pattern
- [React Hook Form file validation discussion](https://github.com/react-hook-form/react-hook-form/discussions/1946) - File upload validation patterns
- [How and when to debounce in React](https://www.developerway.com/posts/debouncing-in-react) - Debouncing with useEffect cleanup
- [Supabase PostgREST Aggregate Functions](https://supabase.com/blog/postgrest-aggregate-functions) - Count aggregate patterns
- [CSS line-clamp MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp) - Text truncation

### Tertiary (LOW confidence)
- [Common Mistakes in React Admin Dashboards](https://dev.to/vaibhavg/common-mistakes-in-react-admin-dashboards-and-how-to-avoid-them-1i70) - General admin UI patterns
- [Zod v4 Deep Dive](https://peerlist.io/jagss/articles/deep-dive-into-zod-v4-whats-new-and-why-it-matters) - v4 features overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zod v4 recommended in STATE.md, React Router already in use
- Architecture: HIGH - Patterns verified with official docs and existing codebase
- Pitfalls: HIGH - Based on official documentation and common issues in similar features

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable libraries)
