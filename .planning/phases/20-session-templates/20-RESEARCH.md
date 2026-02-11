# Phase 20: Session Templates - Research

**Researched:** 2026-02-11
**Domain:** Session template persistence (JSONB blueprints, template CRUD, UI patterns)
**Confidence:** HIGH

## Summary

Session templates capture the complete session structure (sequence items, slides, batches, questions, response template assignments) as reusable blueprints stored in Supabase. This phase extends the existing response_templates pattern to session-level templates, using JSONB for blueprint storage and a sidebar/drawer UI for template management.

The standard approach uses PostgreSQL JSONB columns for blueprint serialization, Zustand stores for client-side state, and established UI patterns for inline editing and type-to-confirm deletion. The codebase already demonstrates these patterns in ResponseTemplatePanel and ImportExportPanel — this phase adapts them for session templates.

**Primary recommendation:** Use JSONB `blueprint` column with `jsonb_path_ops` GIN index, extend existing Zustand pattern, reuse ConfirmDialog component, implement inline rename with Enter-to-save, and use structuredClone() for deep copying blueprints.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL JSONB | Built-in | Blueprint storage | Native PostgreSQL type, indexable, flexible schema evolution without migrations |
| Zustand | 5.0.5 | Template state management | Already used for session-store and template-store, lightweight, TypeScript-first |
| Supabase Storage | @supabase/supabase-js 2.93.1 | Slide image references | Existing pattern for session-images bucket, RLS policies already established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structuredClone() | Native browser API | Deep cloning blueprints | Creating template copies without shared references, handles Dates/Maps/Sets correctly |
| PostgreSQL GIN index | Built-in | JSONB query performance | If querying blueprint contents (not needed for simple read/write by ID) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB blueprint | Normalized session_template_items table | JSONB simpler for read-heavy templates, normalized better if querying structure frequently |
| structuredClone() | JSON.parse(JSON.stringify()) | structuredClone handles circular refs, Dates, but JSON method works for simple objects |
| Zustand | React Context + useState | Zustand provides better performance with selectors, familiar pattern in codebase |

**Installation:**
No new packages required — all dependencies already in package.json.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── SessionTemplatePanel.tsx    # Main template UI (sidebar/drawer)
│   ├── TemplateListItem.tsx        # Inline edit row (optional extraction)
│   └── ConfirmDialog.tsx           # Existing component for delete confirmation
├── stores/
│   └── session-template-store.ts   # Zustand store for template CRUD
├── lib/
│   └── session-template-api.ts     # Supabase CRUD operations
└── types/
    └── database.ts                 # SessionTemplate interface
```

### Pattern 1: JSONB Blueprint Schema
**What:** Store session structure as JSONB column with metadata columns for querying/display
**When to use:** Template read/write by ID, no need to query blueprint internals
**Example:**
```sql
-- Migration: session_templates table
CREATE TABLE session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  blueprint JSONB NOT NULL,  -- Full session structure
  item_count INTEGER NOT NULL DEFAULT 0,  -- Cached for display
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index if querying blueprint contents (likely not needed initially)
-- CREATE INDEX idx_session_templates_blueprint
--   ON session_templates USING GIN (blueprint jsonb_path_ops);

-- Auto-update updated_at (inline PL/pgSQL pattern per MEMORY.md)
CREATE OR REPLACE FUNCTION update_session_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_session_templates_updated_at
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE PROCEDURE update_session_templates_updated_at();
```

### Pattern 2: Blueprint Serialization
**What:** Convert live session state to/from JSONB blueprint
**When to use:** Save/load operations
**Example:**
```typescript
// Serialize session structure to blueprint
interface SessionBlueprint {
  version: 1;  // Schema version for future migrations
  sessionItems: {
    item_type: 'batch' | 'slide';
    position: number;
    batch?: { name: string; questions: QuestionBlueprint[] };
    slide?: { image_path: string; caption: string | null };
  }[];
}

interface QuestionBlueprint {
  text: string;
  type: VoteType;
  options: string[] | null;
  anonymous: boolean;
  position: number;
  template_id: string | null;  // Response template reference
}

// Save: session state → blueprint
function serializeSession(
  sessionItems: SessionItem[],
  batches: Batch[],
  questions: Question[]
): SessionBlueprint {
  const batchMap = new Map(batches.map(b => [b.id, b]));
  const batchQuestionsMap = new Map<string, Question[]>();

  // Group questions by batch_id
  questions.forEach(q => {
    if (q.batch_id) {
      const list = batchQuestionsMap.get(q.batch_id) || [];
      list.push(q);
      batchQuestionsMap.set(q.batch_id, list);
    }
  });

  return {
    version: 1,
    sessionItems: sessionItems
      .sort((a, b) => a.position - b.position)
      .map(item => {
        if (item.item_type === 'batch' && item.batch_id) {
          const batch = batchMap.get(item.batch_id);
          const batchQuestions = batchQuestionsMap.get(item.batch_id) || [];
          return {
            item_type: 'batch',
            position: item.position,
            batch: {
              name: batch?.name || 'Untitled Batch',
              questions: batchQuestions
                .sort((a, b) => a.position - b.position)
                .map(q => ({
                  text: q.text,
                  type: q.type,
                  options: q.options,
                  anonymous: q.anonymous,
                  position: q.position,
                  template_id: q.template_id,
                })),
            },
          };
        } else {
          return {
            item_type: 'slide',
            position: item.position,
            slide: {
              image_path: item.slide_image_path || '',
              caption: item.slide_caption,
            },
          };
        }
      }),
  };
}

// Load: blueprint → session state (deep clone to avoid shared refs)
function deserializeSession(blueprint: SessionBlueprint) {
  return structuredClone(blueprint);  // Deep clone prevents mutation
}
```

### Pattern 3: Zustand Store CRUD Pattern
**What:** Extend existing template-store.ts pattern for session templates
**When to use:** All client-side template state management
**Example:**
```typescript
// src/stores/session-template-store.ts
import { create } from 'zustand';
import type { SessionTemplate } from '../types/database';

interface SessionTemplateState {
  templates: SessionTemplate[];
  loading: boolean;
  error: string | null;

  setTemplates: (templates: SessionTemplate[]) => void;
  addTemplate: (template: SessionTemplate) => void;
  updateTemplate: (id: string, updates: Partial<SessionTemplate>) => void;
  removeTemplate: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionTemplateStore = create<SessionTemplateState>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  setTemplates: (templates) =>
    set({ templates: [...templates].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )}),
  addTemplate: (template) =>
    set((state) => ({
      templates: [template, ...state.templates],
    })),
  updateTemplate: (id, updates) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

### Pattern 4: Inline Rename with Enter-to-Save
**What:** Click template name to edit in-place, Enter to save, Esc to cancel
**When to use:** Template list rename action
**Example:**
```typescript
// Inline edit component state
const [editingId, setEditingId] = useState<string | null>(null);
const [editValue, setEditValue] = useState('');

function handleNameClick(template: SessionTemplate) {
  setEditingId(template.id);
  setEditValue(template.name);
}

function handleKeyDown(e: React.KeyboardEvent, templateId: string) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSaveRename(templateId, editValue.trim());
  } else if (e.key === 'Escape') {
    setEditingId(null);
  }
}

// Render
{editingId === template.id ? (
  <input
    type="text"
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onKeyDown={(e) => handleKeyDown(e, template.id)}
    onBlur={() => handleSaveRename(template.id, editValue.trim())}
    autoFocus
    className="..."
  />
) : (
  <button onClick={() => handleNameClick(template)}>
    {template.name}
  </button>
)}
```

### Pattern 5: Type-to-Confirm Delete
**What:** GitHub-style delete confirmation requiring exact name entry
**When to use:** High-friction safety for destructive actions
**Example:**
```typescript
// Custom confirmation dialog with text input
interface TypeToConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText: string;  // Text user must type exactly
  loading?: boolean;
}

export function TypeToConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText,
  loading = false,
}: TypeToConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const isMatch = inputValue === confirmText;

  return (
    <div className="...modal...">
      <h3>{title}</h3>
      <p>{message}</p>
      <p className="text-sm text-gray-600">
        Type <strong>{confirmText}</strong> to confirm:
      </p>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={confirmText}
        className="..."
      />
      <button
        onClick={onConfirm}
        disabled={!isMatch || loading}
        className="..."
      >
        {loading ? 'Deleting...' : 'Delete Template'}
      </button>
    </div>
  );
}
```

### Pattern 6: Inline Success State Button
**What:** Save button shows checkmark/green state briefly, no toast notification
**When to use:** Save confirmation per CONTEXT.md decision
**Example:**
```typescript
const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

async function handleSave() {
  setSaveStatus('saving');
  try {
    await saveTemplate(...);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  } catch (err) {
    setSaveStatus('idle');
    // Show error
  }
}

// Render
<button
  onClick={handleSave}
  disabled={saveStatus !== 'idle'}
  className={saveStatus === 'success' ? 'bg-green-600' : 'bg-indigo-600'}
>
  {saveStatus === 'saving' && 'Saving...'}
  {saveStatus === 'success' && '✓ Saved'}
  {saveStatus === 'idle' && 'Save Template'}
</button>
```

### Anti-Patterns to Avoid
- **Storing absolute Storage URLs in blueprint:** Store relative paths only (e.g., `session_id/filename.jpg`), construct full URLs at display time to avoid broken links if bucket changes
- **Normalizing blueprint into separate tables:** JSONB is simpler for templates (read-heavy, infrequent writes), normalization adds complexity without query benefits
- **Skipping structuredClone() on load:** JSON.parse/stringify works but fails with circular refs and special types; structuredClone is safer
- **Toasts for save confirmation:** CONTEXT.md specifies inline button state, not toasts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep cloning objects | Custom recursive clone function | `structuredClone()` | Native browser API (2026), handles circular refs, Maps, Sets, Dates; safer than JSON.parse/stringify |
| JSONB schema versioning | Manual migration on read | Version field + switch statement | Future-proof blueprint changes (e.g., v1 → v2 schema evolution) |
| Confirmation dialogs | Custom modal per use case | Extend existing ConfirmDialog component | Codebase already has ConfirmDialog.tsx with danger variant, loading states |
| Template name uniqueness | Client-side validation only | PostgreSQL UNIQUE constraint | Database enforces uniqueness, prevents race conditions |
| Slide image path validation | String checks | Reuse existing session-images Storage patterns | RLS policies and path construction already proven in Phase 16 |

**Key insight:** The codebase already has proven patterns (ResponseTemplatePanel, ImportExportPanel, ConfirmDialog) — reuse these architectures instead of inventing new ones.

## Common Pitfalls

### Pitfall 1: JSONB Document Size and TOAST Storage
**What goes wrong:** Large blueprints (>2KB) move to TOAST storage, incurring extra I/O on every read
**Why it happens:** Session with many slides and batches creates large JSONB documents
**How to avoid:** Keep blueprints focused on structure, not content — store slide image paths (not base64), question text (not votes/responses)
**Warning signs:** Template load queries showing unexpectedly slow performance, EXPLAIN ANALYZE showing TOAST fetches

### Pitfall 2: Shared References After Blueprint Load
**What goes wrong:** Modifying loaded blueprint mutates the original template data in store
**Why it happens:** JavaScript spread operator (`{...blueprint}`) is shallow copy — nested arrays/objects are shared references
**How to avoid:** Always use `structuredClone(blueprint)` when loading to create true deep copies
**Warning signs:** Editing a loaded session accidentally modifies the template preview, undo/cancel not working correctly

### Pitfall 3: Slide Image Path Breakage
**What goes wrong:** Template loads slide items but images fail to display because paths changed
**Why it happens:** Storing session-specific paths (e.g., `OLD_SESSION_ID/image.jpg`) breaks when loading into new session
**How to avoid:** Store relative paths in blueprint, but this is actually acceptable per CONTEXT.md — templates reference original Storage paths without duplication. If original image deleted, template shows broken image (acceptable tradeoff)
**Warning signs:** "Image not found" errors when loading templates created from old sessions

### Pitfall 4: Response Template Reference Breakage
**What goes wrong:** Questions load without response template assignments because template was deleted
**Why it happens:** Blueprint stores `template_id` but response_templates table row no longer exists
**How to avoid:** Show warning count on load per CONTEXT.md: "N response templates no longer exist — questions loaded without assignments"
**Warning signs:** Questions load with `template_id: null` silently, admin doesn't know assignments were lost

### Pitfall 5: Name Collision on Save
**What goes wrong:** Save fails with "Template 'X' already exists" error without recovery option
**Why it happens:** PostgreSQL UNIQUE constraint rejects duplicate names
**How to avoid:** Per CONTEXT.md, prompt before save: "Template 'X' exists. Overwrite or save as new?" — handle constraint violation gracefully with UI choice
**Warning signs:** User loses their save work because they can't resolve name conflict

### Pitfall 6: Forgetting Batch-Question Relationship
**What goes wrong:** Blueprint serializes batches and questions separately, loses batch_id → question linkage
**Why it happens:** Questions reference batches by ID, but IDs are session-specific
**How to avoid:** Inline questions into batch structure in blueprint (Pattern 2), reconstruct relationships on load by creating batches first, then assigning new batch_id to questions
**Warning signs:** Questions load unbatched even though template had batches

## Code Examples

Verified patterns from official sources:

### PostgreSQL JSONB with GIN Index
```sql
-- Source: Crunchy Data - Indexing JSONB in Postgres
-- https://www.crunchydata.com/blog/indexing-jsonb-in-postgres

-- Use jsonb_path_ops for better performance with containment queries
CREATE INDEX idx_session_templates_blueprint
  ON session_templates USING GIN (blueprint jsonb_path_ops);

-- Only add GIN index if actually querying blueprint contents
-- For simple read/write by ID, primary key index is sufficient
```

### structuredClone for Deep Copy
```javascript
// Source: MDN Web Docs - Window.structuredClone()
// https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone

// Deep clone a blueprint before loading
const loadedBlueprint = structuredClone(templateBlueprint);

// Handles nested objects, arrays, Dates, Maps, Sets, circular references
// Throws DataCloneError for functions, DOM nodes, symbols
```

### Zustand Store with Curried Create
```typescript
// Source: Zustand - Beginner TypeScript Guide
// https://zustand.docs.pmnd.rs/guides/beginner-typescript

// TypeScript requires curried form: create<T>()()
export const useSessionTemplateStore = create<SessionTemplateState>()((set) => ({
  templates: [],

  addTemplate: (template) =>
    set((state) => ({
      templates: [...state.templates, template],
    })),

  // State updates are immutable via spread
  updateTemplate: (id, updates) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
}));
```

### Inline Edit Input with Enter/Escape
```typescript
// Source: How to build an inline edit component in React
// https://www.emgoto.com/react-inline-edit/

function InlineEditName({ template, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(template.name);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value.trim());
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setValue(template.name);  // Reset
      setIsEditing(false);
    }
  }

  return isEditing ? (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        onSave(value.trim());
        setIsEditing(false);
      }}
      autoFocus
    />
  ) : (
    <button onClick={() => setIsEditing(true)}>
      {template.name}
    </button>
  );
}
```

### Supabase JSONB Insert/Update
```typescript
// Source: Existing codebase pattern from template-api.ts

async function saveSessionTemplate(
  name: string,
  blueprint: SessionBlueprint,
  itemCount: number
) {
  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      name,
      blueprint,  // JSONB column accepts plain objects
      item_count: itemCount,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (duplicate name)
    if (error.code === '23505') {
      throw new Error(`Template "${name}" already exists`);
    }
    throw error;
  }

  return data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON.parse(JSON.stringify()) for cloning | structuredClone() | Chrome 98+ (2022), Safari 15.4+ (2022) | Native API handles edge cases, better performance |
| localStorage for templates | Supabase table with JSONB | Phase 11 pattern (response_templates) | Multi-device access, realtime sync potential |
| Separate modals for each action | Reusable ConfirmDialog component | v1.2 (Phase 11-15) | Consistent UX, less code duplication |
| Manual UNIQUE checks in code | PostgreSQL UNIQUE constraint | Standard SQL practice | Database enforces integrity, prevents race conditions |

**Deprecated/outdated:**
- **Lodash cloneDeep**: structuredClone is native browser API, no dependency needed (17.4kb → 0kb)
- **JSON.parse/stringify for deep clone**: Fails with circular refs, Dates become strings, functions lost
- **Custom recursive clone functions**: Edge cases, maintenance burden; structuredClone handles all cases

## Open Questions

Things that couldn't be fully resolved:

1. **Should templates include default_template_id reference for nested templates?**
   - What we know: Sessions have `default_template_id` for response templates (STPL context)
   - What's unclear: Whether session templates should also capture which response template is the session default
   - Recommendation: Exclude from initial blueprint — session-level settings are "fresh per session" per CONTEXT.md, but planner can decide if it's useful metadata

2. **How to handle slide images when template is loaded multiple times?**
   - What we know: Templates reference original Storage paths, no duplication per CONTEXT.md
   - What's unclear: If same template loaded 10 times, all sessions reference same images — is this acceptable?
   - Recommendation: Accept shared image references as specified, but planner should consider RLS implications (images owned by original session creator, accessible to all?)

3. **Should blueprint version field support automatic migrations?**
   - What we know: Blueprint has `version: 1` field for future-proofing
   - What's unclear: Whether to implement migration logic now or wait for v2 schema needs
   - Recommendation: Include version field, but defer migration logic until actually needed (YAGNI principle)

4. **GIN index on blueprint column — needed or premature optimization?**
   - What we know: Templates are read by ID, not queried by blueprint contents
   - What's unclear: Future features might want to search templates by content (e.g., "find templates with question X")
   - Recommendation: Skip GIN index initially, add only if query patterns emerge (write overhead not worth it for current use case)

## Sources

### Primary (HIGH confidence)
- [PostgreSQL JSONB Official Documentation](https://www.postgresql.org/docs/current/datatype-json.html) - JSONB type specification
- [MDN Web Docs - structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) - Deep clone API
- [Zustand Official Docs - TypeScript Guide](https://zustand.docs.pmnd.rs/guides/beginner-typescript) - Store patterns
- [Crunchy Data - Indexing JSONB in Postgres](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) - GIN index performance
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage) - Storage patterns and RLS

### Secondary (MEDIUM confidence)
- [AWS - PostgreSQL as JSON Database Best Practices](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) - JSONB blueprint patterns
- [pganalyze - Understanding GIN Indexes](https://pganalyze.com/blog/gin-index) - Performance tradeoffs
- [Builder.io - Deep Cloning the Modern Way](https://www.builder.io/blog/structured-clone) - structuredClone vs alternatives
- [How to build inline edit in React](https://www.emgoto.com/react-inline-edit/) - Inline edit pattern

### Tertiary (LOW confidence)
- [react-delete-confirm library](https://github.com/nfpiche/react-delete-confirm) - Type-to-confirm pattern inspiration
- [react-progress-button library](https://github.com/mathieudutour/react-progress-button) - Inline success state pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, JSONB is PostgreSQL native
- Architecture: HIGH - Patterns proven in existing codebase (ResponseTemplatePanel, ImportExportPanel)
- Pitfalls: MEDIUM - Identified from general JSONB/React experience, not QuickVote-specific testing

**Research date:** 2026-02-11
**Valid until:** ~30 days (stable domain — JSONB, Zustand patterns don't change rapidly)
