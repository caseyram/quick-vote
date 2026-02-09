# Phase 11: Template Database & CRUD - Research

**Researched:** 2026-02-09
**Domain:** Supabase global templates, Zustand CRUD patterns, React form management with drag-and-drop
**Confidence:** HIGH

## Summary

Phase 11 implements a global template system for reusable response options stored in Supabase. This research investigated three primary domains: (1) database schema design for globally-shared templates with JSONB arrays, (2) Zustand store patterns for CRUD operations, and (3) UI patterns for template management including drag-and-drop reordering and confirmation dialogs.

The standard approach is to create a `response_templates` table with JSONB storage for option arrays, use Zustand's action pattern for template CRUD methods, and leverage the existing @dnd-kit/sortable preset for option reordering. Templates should use Row Level Security (RLS) allowing read access to authenticated users but write access only to session creators. The existing `ConfirmDialog` component handles delete confirmations.

**Primary recommendation:** Create `response_templates` table with JSONB `options` column, extend session-store with template management methods (or create dedicated template-store), use existing @dnd-kit patterns for option reordering, and implement edit propagation checks by querying for linked questions with votes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Postgres | Current | Global template storage | Project standard, supports JSONB arrays natively with indexing |
| @dnd-kit/sortable | ^10.0.0 | Option reordering UI | Already installed, proven pattern in BatchList/QuestionForm |
| Zustand | ^5.0.5 | Template state management | Project standard, simple action pattern for CRUD |
| @supabase/supabase-js | ^2.93.1 | Database client | Project standard, handles RLS automatically |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing ConfirmDialog | Current | Delete/edit confirmation | Reuse existing component for consistency |
| Existing QuestionForm | Current | Option input pattern | Mirror option input UX from question creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB array | Separate `template_options` table | Normalized but overkill for simple ordered lists; JSONB simpler |
| Single store | Separate template store | Separation cleaner but adds complexity; extending session-store acceptable |
| Custom drag-drop | React DnD | Already using dnd-kit; maintain consistency |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
```

## Architecture Patterns

### Recommended Database Schema

Create `response_templates` table with JSONB options:

```sql
-- Response templates table
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  options JSONB NOT NULL CHECK (jsonb_array_length(options) >= 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for name lookups (unique constraint creates index automatically)
-- GIN index for JSONB operations if querying options content
CREATE INDEX idx_response_templates_options ON response_templates USING GIN (options);

-- Updated_at trigger using existing moddatetime extension
CREATE TRIGGER handle_response_templates_updated_at
  BEFORE UPDATE ON response_templates
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);

-- Add template link to questions table
ALTER TABLE questions
  ADD COLUMN template_id UUID REFERENCES response_templates(id) ON DELETE SET NULL;

-- Index foreign key for lookup performance
CREATE INDEX idx_questions_template_id ON questions(template_id);
```

**Why JSONB for options:** Simple ordered array structure, efficient storage, PostgreSQL native support with GIN indexing for querying. Check constraint ensures minimum 2 options.

**Why UNIQUE on name:** User decision from CONTEXT.md - template names must be unique to avoid confusion.

**Why ON DELETE SET NULL:** When template deleted, questions keep their current options but lose template link (per CONTEXT.md: "detaches linked questions").

**Why GIN index on options:** Enables efficient queries like "find templates containing option X" if needed later. Optional but cheap for small datasets.

### Pattern 1: Zustand CRUD Store Extension

**What:** Extend session-store (or create template-store) with CRUD methods following existing patterns.

**When to use:** Template management requires create, read, update, delete operations with optimistic updates.

**Example:**
```typescript
// Source: Zustand docs (https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)
// Mirrors existing session-store pattern in project

interface ResponseTemplate {
  id: string;
  name: string;
  options: string[];
  created_at: string;
  updated_at: string;
}

interface TemplateState {
  templates: ResponseTemplate[];
  loading: boolean;
  error: string | null;

  setTemplates: (templates: ResponseTemplate[]) => void;
  addTemplate: (template: ResponseTemplate) => void;
  updateTemplate: (id: string, updates: Partial<ResponseTemplate>) => void;
  removeTemplate: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) =>
    set((state) => ({
      templates: [...state.templates, template].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
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

### Pattern 2: Template CRUD with RLS

**What:** Database operations respecting Row Level Security for global shared data.

**When to use:** All template CRUD operations - authenticated users read, creators write.

**Example:**
```typescript
// Source: Project pattern from session-store operations

// RLS Policies for response_templates:
/*
CREATE POLICY "Anyone can read templates"
  ON response_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create templates"
  ON response_templates FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creator can update templates"
  ON response_templates FOR UPDATE TO authenticated
  USING (true);  -- Global templates, any authenticated user can edit

CREATE POLICY "Creator can delete templates"
  ON response_templates FOR DELETE TO authenticated
  USING (true);  -- Global templates, any authenticated user can delete
*/

// Create template
async function createTemplate(name: string, options: string[]) {
  const { data, error } = await supabase
    .from('response_templates')
    .insert({ name, options })
    .select()
    .single();

  if (error) throw error;
  useTemplateStore.getState().addTemplate(data);
  return data;
}

// Update template with propagation check
async function updateTemplate(id: string, updates: { name?: string; options?: string[] }) {
  // Check if any linked questions have votes
  if (updates.options) {
    const { data: linkedQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('template_id', id);

    if (linkedQuestions && linkedQuestions.length > 0) {
      const questionIds = linkedQuestions.map(q => q.id);
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('id')
        .in('question_id', questionIds)
        .limit(1);

      if (votesError) throw votesError;
      if (votes && votes.length > 0) {
        throw new Error('Cannot edit options: linked questions have received votes');
      }
    }
  }

  const { data, error } = await supabase
    .from('response_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  useTemplateStore.getState().updateTemplate(id, data);
  return data;
}

// Delete template with usage check
async function deleteTemplate(id: string): Promise<{ usageCount: number }> {
  // Get usage count
  const { data: linkedQuestions, error: countError } = await supabase
    .from('questions')
    .select('id')
    .eq('template_id', id);

  if (countError) throw countError;
  const usageCount = linkedQuestions?.length ?? 0;

  // Delete (ON DELETE SET NULL detaches questions)
  const { error } = await supabase
    .from('response_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
  useTemplateStore.getState().removeTemplate(id);
  return { usageCount };
}
```

### Pattern 3: Option Reordering with dnd-kit

**What:** Drag-and-drop reordering for template options mirroring QuestionForm pattern.

**When to use:** Template editor for reordering options within a template.

**Example:**
```typescript
// Source: Project's BatchCard.tsx pattern, adapted for options
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function TemplateOptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex((_, i) => i === active.id);
      const newIndex = options.findIndex((_, i) => i === over.id);
      onChange(arrayMove(options, oldIndex, newIndex));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={options.map((_, i) => i)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {options.map((opt, index) => (
            <SortableOptionItem
              key={index}
              index={index}
              value={opt}
              onChange={(value) => {
                const updated = [...options];
                updated[index] = value;
                onChange(updated);
              }}
              onRemove={() => onChange(options.filter((_, i) => i !== index))}
              canRemove={options.length > 2}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableOptionItem({ index, value, onChange, onRemove, canRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: index });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {/* Drag handle - matches QuestionForm "Remove" button style */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-500">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </div>

      {/* Input - mirrors QuestionForm option input style */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Option ${index + 1}`}
        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Remove button - matches QuestionForm style */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="px-2 py-2 text-red-400 hover:text-red-300 text-sm font-medium"
        >
          Remove
        </button>
      )}
    </div>
  );
}
```

### Pattern 4: Confirmation Dialogs for Destructive Actions

**What:** Reuse existing ConfirmDialog component for delete/edit confirmations.

**When to use:** Before deleting templates (show usage count) and before propagating edits (show affected count).

**Example:**
```typescript
// Source: Existing ConfirmDialog.tsx in project
function TemplateManager() {
  const [deleteConfirm, setDeleteConfirm] = useState<{ template: ResponseTemplate; usageCount: number } | null>(null);
  const [editConfirm, setEditConfirm] = useState<{ template: ResponseTemplate; linkedCount: number } | null>(null);

  async function handleDeleteClick(template: ResponseTemplate) {
    // Check usage
    const { data: linkedQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('template_id', template.id);

    setDeleteConfirm({
      template,
      usageCount: linkedQuestions?.length ?? 0,
    });
  }

  async function handleEditConfirm(template: ResponseTemplate, newOptions: string[]) {
    // Check linked questions
    const { data: linkedQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('template_id', template.id);

    if (linkedQuestions && linkedQuestions.length > 0) {
      setEditConfirm({
        template,
        linkedCount: linkedQuestions.length,
      });
    } else {
      // No linked questions, edit directly
      await updateTemplate(template.id, { options: newOptions });
    }
  }

  return (
    <>
      {/* Template list UI */}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Template"
        message={
          deleteConfirm?.usageCount
            ? `This template is used by ${deleteConfirm.usageCount} question(s). Deleting will detach those questions.`
            : 'Delete this template?'
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={async () => {
          if (deleteConfirm) {
            await deleteTemplate(deleteConfirm.template.id);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Edit propagation confirmation */}
      <ConfirmDialog
        isOpen={!!editConfirm}
        title="Update Template"
        message={`${editConfirm?.linkedCount} question(s) will be updated with the new options.`}
        confirmLabel="Update"
        confirmVariant="primary"
        onConfirm={async () => {
          if (editConfirm) {
            await updateTemplate(editConfirm.template.id, { options: /* new options */ });
            setEditConfirm(null);
          }
        }}
        onCancel={() => setEditConfirm(null)}
      />
    </>
  );
}
```

### Anti-Patterns to Avoid

- **Don't normalize options into separate table:** JSONB array is simpler for ordered lists; normalization adds JOIN complexity without benefit
- **Don't allow template edits without vote check:** Per CONTEXT.md, if any linked question has votes, block option edits to protect data integrity
- **Don't use global position field for options:** Array index is sufficient; adding position complicates reordering
- **Don't bypass RLS with service_role key:** Templates are global but should respect auth; use authenticated client
- **Don't duplicate template names:** Unique constraint enforced; show clear error if name conflict

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom pointer tracking, scroll handling | @dnd-kit/sortable with existing patterns | Project already uses dnd-kit; handles edge cases like scrolling, accessibility, touch |
| Confirmation dialogs | Modal state management | Existing ConfirmDialog component | Consistent UX, handles loading states, already tested |
| JSONB validation | Client-side-only checks | PostgreSQL check constraints + pg_jsonschema | Server-side validation prevents corruption, check constraint ensures min 2 options |
| Array reordering | Manual splice/index logic | @dnd-kit's arrayMove utility | Optimized, handles edge cases, tested |
| Option input UI | New component | Mirror QuestionForm option inputs | Consistent UX reduces cognitive load, proven pattern |

**Key insight:** Template management is CRUD + drag-drop + confirmations - all patterns already exist in codebase. Reuse aggressively for consistency and speed.

## Common Pitfalls

### Pitfall 1: Editing Template Options Without Checking for Votes

**What goes wrong:** Admin edits template options while linked questions have votes, corrupting vote data or creating mismatch between stored vote values and current option list.

**Why it happens:** No validation checks whether linked questions have received votes before allowing option edits.

**How to avoid:** Before allowing option edits, query for linked questions, then check if any have votes. Block edit if votes exist. Name changes are safe.

**Warning signs:**
- Vote value "Option A" stored but current template has "Option X" instead
- Bar chart showing votes for options that don't exist
- Export/results showing orphaned vote values

### Pitfall 2: Template Name Conflicts

**What goes wrong:** User tries to create/rename template with name that already exists, leading to constraint violation error.

**Why it happens:** UNIQUE constraint on name column enforced at database level, but UI doesn't show helpful error message.

**How to avoid:**
- Catch constraint violation error (code 23505) and show user-friendly message: "Template name already exists"
- Optional: Check name availability before submitting (may race, so catch error anyway)

**Warning signs:**
- Generic "constraint violation" error shown to user
- Template creation fails silently
- User confused why template wasn't created

### Pitfall 3: Deleting Templates Without Usage Warning

**What goes wrong:** Admin deletes template thinking it's unused, but it's linked to many questions. Questions lose template link unexpectedly.

**Why it happens:** No usage count shown before deletion.

**How to avoid:** Always query linked questions count before showing delete confirmation. Show count in dialog message.

**Warning signs:**
- Questions suddenly show as "custom" instead of template-linked
- Admin surprised that questions lost template association

### Pitfall 4: JSONB Array Length Not Validated

**What goes wrong:** Template created with 0 or 1 option, breaking multiple-choice question assumptions (need at least 2 options).

**Why it happens:** No validation on options array length.

**How to avoid:**
- Check constraint on database: `CHECK (jsonb_array_length(options) >= 2)`
- Client-side validation: disable save if < 2 non-empty options
- Mirror QuestionForm validation: "Multiple choice questions need at least 2 non-empty options"

**Warning signs:**
- Templates with 1 option appear in list
- Questions created from template fail validation
- Participant voting UI breaks with single option

### Pitfall 5: Not Indexing template_id on Questions

**What goes wrong:** Queries to check template usage (e.g., "find all questions using this template") become slow as question count grows.

**Why it happens:** PostgreSQL doesn't automatically index foreign key columns.

**How to avoid:** Explicitly create index: `CREATE INDEX idx_questions_template_id ON questions(template_id);`

**Warning signs:**
- Delete confirmation dialog takes seconds to show usage count
- Template list load time increases with question count
- Database slow query logs show sequential scans on questions table

### Pitfall 6: Allowing Duplicate Option Text Within Template

**What goes wrong:** Template has options ["Yes", "No", "Yes"], confusing participants and breaking vote counting logic.

**Why it happens:** No validation preventing duplicate option values.

**How to avoid:**
- Client-side: Check for duplicates before save, show error: "Duplicate options not allowed"
- Optional database constraint: Create function to validate JSONB array has unique values

**Warning signs:**
- Bar charts showing same label twice
- Vote aggregation counting same option multiple times or merging them
- Participants confused which "Yes" to click

## Code Examples

Verified patterns from official sources and project codebase:

### Loading Templates on Component Mount

```typescript
// Source: Project pattern from AdminSession.tsx
function TemplatePanel() {
  const templates = useTemplateStore((s) => s.templates);
  const setTemplates = useTemplateStore((s) => s.setTemplates);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplates() {
      setLoading(true);
      const { data, error } = await supabase
        .from('response_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to load templates:', error);
      } else {
        setTemplates(data ?? []);
      }
      setLoading(false);
    }

    loadTemplates();
  }, [setTemplates]);

  if (loading) return <div>Loading templates...</div>;

  return (
    <div>
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}
```

### Creating Template with Validation

```typescript
// Source: Project's QuestionForm.tsx validation pattern
async function handleCreateTemplate(name: string, options: string[]) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    setError('Template name is required');
    return;
  }

  const filteredOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (filteredOptions.length < 2) {
    setError('Templates need at least 2 non-empty options');
    return;
  }

  // Check for duplicates
  const uniqueOptions = new Set(filteredOptions);
  if (uniqueOptions.size !== filteredOptions.length) {
    setError('Duplicate options are not allowed');
    return;
  }

  setSaving(true);
  try {
    const { data, error } = await supabase
      .from('response_templates')
      .insert({ name: trimmedName, options: filteredOptions })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        setError('A template with this name already exists');
      } else {
        setError(error.message);
      }
      return;
    }

    useTemplateStore.getState().addTemplate(data);
    // Reset form or close modal
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create template');
  } finally {
    setSaving(false);
  }
}
```

### Realtime Template Updates (Optional Enhancement)

```typescript
// Source: Project's AdminSession.tsx realtime pattern
function setupTemplateRealtimeChannel(channel: RealtimeChannel) {
  channel.on(
    'postgres_changes' as any,
    {
      event: '*',
      schema: 'public',
      table: 'response_templates',
    },
    (payload: any) => {
      const newTemplate = payload.new as ResponseTemplate;

      if (payload.eventType === 'INSERT') {
        const existing = useTemplateStore.getState().templates.find(t => t.id === newTemplate.id);
        if (!existing) {
          useTemplateStore.getState().addTemplate(newTemplate);
        }
      } else if (payload.eventType === 'UPDATE') {
        useTemplateStore.getState().updateTemplate(newTemplate.id, newTemplate);
      } else if (payload.eventType === 'DELETE') {
        useTemplateStore.getState().removeTemplate(payload.old.id);
      }
    }
  );
}

// Add to supabase/migrations/.../realtime_publication.sql:
ALTER PUBLICATION supabase_realtime ADD TABLE response_templates;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage templates | Supabase global templates | Phase 11 (v1.2) | Templates now shared across sessions and devices, persistent |
| Static template lists in code | Dynamic CRUD management | Phase 11 (v1.2) | Admins can create custom templates without code changes |
| Template data in session export | Templates stored globally | Phase 11 (v1.2) | Export now references templates by ID, deduplicates on import |
| No template validation | JSONB check constraints | Phase 11 (v1.2) | Database enforces min 2 options, prevents corruption |

**Deprecated/outdated:**
- localStorage template storage (Phase 10 TemplatePanel.tsx) - being replaced with Supabase in Phase 11
- Exporting full template data - Phase 12 will reference by ID and deduplicate

## Open Questions

Things that couldn't be fully resolved:

1. **Template versioning for edit history**
   - What we know: CONTEXT.md doesn't require version history; templates update in-place
   - What's unclear: If admin wants to revert to old options, no audit trail exists
   - Recommendation: Out of scope for Phase 11; if needed later, add `history` JSONB column or separate `template_history` table

2. **Template categories or tags**
   - What we know: CONTEXT.md specifies "simple flat list — no search/filter needed"
   - What's unclear: As template count grows, discovery may become harder
   - Recommendation: Start with flat list; if >20 templates emerge, add search in later phase

3. **Template ownership vs global access**
   - What we know: Templates stored globally, RLS allows all authenticated users to CRUD
   - What's unclear: Should templates show "created by" user? Should only creator edit?
   - Recommendation: Global access simplifies v1.2; if abuse occurs, add ownership column and RLS policies later

4. **Option color persistence**
   - What we know: CONTEXT.md states "colors assigned automatically based on position (not stored in template)"
   - What's unclear: If template options reordered, colors shift (e.g., "Agree" changes from green to red)
   - Recommendation: Accept this behavior for v1.2; color consistency would require storing color per option

## Sources

### Primary (HIGH confidence)
- [Supabase JSONB Documentation](https://supabase.com/docs/guides/database/json) - JSONB storage, indexing
- [Supabase Array Documentation](https://supabase.com/docs/guides/database/arrays) - Array operations
- [dnd-kit Sortable Documentation](https://docs.dndkit.com/presets/sortable) - Drag-and-drop patterns
- [PostgreSQL Foreign Key Documentation](https://www.postgresql.org/docs/current/ddl-constraints.html) - ON DELETE SET NULL behavior
- [Supabase Cascade Deletes](https://supabase.com/docs/guides/database/postgres/cascade-deletes) - Foreign key actions
- Project codebase: BatchList.tsx, QuestionForm.tsx, ConfirmDialog.tsx - Existing patterns

### Secondary (MEDIUM confidence)
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) - Store organization
- [Zustand Flux Pattern](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice) - CRUD actions
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security) - Global data access patterns
- [Medium: React Confirmation Dialog Patterns](https://medium.com/@hrupanjan/building-a-flexible-confirmation-dialog-system-in-react-or-next-js-with-typescript-1e57965b523b) - Dialog architecture
- [Medium: Restrict vs CASCADE vs SET NULL](https://medium.com/@sunnywilson.veshapogu/restrict-vs-cascade-vs-set-null-in-sql-choosing-the-right-foreign-key-rule-6d7c98484710) - Foreign key strategy

### Tertiary (LOW confidence)
- WebSearch: General React patterns, confirmation dialogs - Contextual understanding only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, proven patterns in codebase
- Architecture: HIGH - Database schema follows PostgreSQL/Supabase best practices, UI patterns match existing code
- Pitfalls: HIGH - Based on project patterns and common CRUD/validation mistakes

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable domain)
