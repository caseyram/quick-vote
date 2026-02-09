# Phase 12: Template Assignment & Defaults - Research

**Researched:** 2026-02-09
**Domain:** React form state management, Zustand store patterns, database foreign key relationships
**Confidence:** HIGH

## Summary

Phase 12 extends the existing response template system (Phase 11) to allow admin users to assign templates to multiple choice questions and set per-session defaults. The core technical challenge involves coordinating form state between three modes: custom options, template-assigned (locked), and transitioning between them with proper data integrity checks.

The standard stack already exists in the project (React 19, Zustand 5, Supabase with PostgreSQL). The key patterns needed are: controlled select components for template dropdown, state coordination for lock/unlock modes, confirmation dialogs for destructive operations, and database foreign key relationships with vote-based constraints.

**Primary recommendation:** Use React controlled select elements with Zustand store methods for assignment/detachment, leverage existing `checkTemplateVotes()` pattern from Phase 11 to block assignment when votes exist, and add nullable foreign key column to sessions table for default template. Follow existing UI patterns from `ResponseTemplatePanel` and `QuestionForm` for consistency.

## Standard Stack

The established libraries/tools for this domain are already in use in the project.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | UI framework | Project standard, controlled components pattern |
| Zustand | ^5.0.5 | State management | Project standard, simple API for complex mutations |
| Supabase | Latest | Backend/database | Project standard, PostgreSQL with RLS |
| TypeScript | Latest | Type safety | Project standard, prevents form state bugs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | Existing | Drag and drop | Already used in TemplateEditor (not needed this phase) |
| Tailwind CSS | Existing | Styling | Project standard for all UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native select | react-select | Project uses native HTML elements, avoid unnecessary dependencies |
| Immer middleware | Manual spread | Project doesn't use Immer, simple mutations sufficient |
| Formik/React Hook Form | Manual state | Project uses local state for forms, small form scope |

**Installation:**
No new packages required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── QuestionForm.tsx              # Modified: add template selector
│   ├── TemplateSelector.tsx          # NEW: reusable dropdown component
│   ├── ConfirmDialog.tsx             # Existing: reuse for detach confirmation
│   └── ResponseTemplatePanel.tsx     # Existing: reference for UI patterns
├── stores/
│   ├── session-store.ts              # Modified: add default template methods
│   └── template-store.ts             # Existing: no changes needed
├── lib/
│   ├── template-api.ts               # Modified: add assignment/detachment functions
│   └── question-api.ts               # NEW: question operations (optional extraction)
└── types/
    └── database.ts                   # Modified: add default_template_id to Session
```

### Pattern 1: Controlled Select Component
**What:** Template dropdown as controlled component with value/onChange
**When to use:** Template selection in QuestionForm
**Example:**
```typescript
// Source: https://react.dev/reference/react-dom/components/select
function TemplateSelector({
  value,
  onChange,
  templates
}: {
  value: string | null;
  onChange: (templateId: string | null) => void;
  templates: ResponseTemplate[];
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onChange(val === '' ? null : val);
      }}
    >
      <option value="">None (custom options)</option>
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
```

### Pattern 2: Form State Coordination (Mode Toggle)
**What:** Template assignment acts as mode switch between locked/unlocked options
**When to use:** QuestionForm with conditional rendering based on template_id
**Example:**
```typescript
// Simplified pattern from QuestionForm
function QuestionForm({ editingQuestion }: { editingQuestion?: Question }) {
  const [templateId, setTemplateId] = useState<string | null>(
    editingQuestion?.template_id ?? null
  );
  const [customOptions, setCustomOptions] = useState<string[]>(
    !editingQuestion?.template_id && editingQuestion?.options
      ? editingQuestion.options
      : ['', '']
  );

  const template = useTemplateStore(s =>
    s.templates.find(t => t.id === templateId)
  );

  // Display options: locked from template OR editable custom
  const displayOptions = template ? template.options : customOptions;
  const isLocked = !!template;

  return (
    <>
      <TemplateSelector value={templateId} onChange={setTemplateId} />
      {isLocked ? (
        <LockedOptionsList options={displayOptions} templateName={template.name} />
      ) : (
        <EditableOptionsList options={customOptions} onChange={setCustomOptions} />
      )}
    </>
  );
}
```

### Pattern 3: Vote-Based Constraint Checking
**What:** Prevent template assignment/switch when votes exist (data integrity)
**When to use:** Before applying template selection in QuestionForm edit mode
**Example:**
```typescript
// Source: Existing pattern from template-api.ts checkTemplateVotes()
async function handleTemplateChange(newTemplateId: string | null) {
  if (editingQuestion) {
    // Check if question has votes
    const { data: votes } = await supabase
      .from('votes')
      .select('id')
      .eq('question_id', editingQuestion.id)
      .limit(1);

    if (votes && votes.length > 0) {
      setErrorMsg('Cannot change template: question has received votes');
      return;
    }
  }

  setTemplateId(newTemplateId);
}
```

### Pattern 4: Confirmation Dialog for Detachment
**What:** Show confirmation when detaching template (copies options as custom)
**When to use:** When user selects "None" from dropdown or clicks "Detach" link
**Example:**
```typescript
// Source: Existing pattern from ResponseTemplatePanel
const [detachConfirm, setDetachConfirm] = useState<{
  templateId: string;
  templateName: string;
  options: string[];
} | null>(null);

function handleDetach(template: ResponseTemplate) {
  setDetachConfirm({
    templateId: template.id,
    templateName: template.name,
    options: template.options,
  });
}

async function confirmDetach() {
  if (!detachConfirm) return;

  // Copy template options to custom, clear template_id
  setCustomOptions([...detachConfirm.options]);
  setTemplateId(null);
  setDetachConfirm(null);
}
```

### Pattern 5: Zustand State Mutation for Session Defaults
**What:** Store methods for setting/clearing default template on session
**When to use:** Session settings panel (new component or in AdminSession)
**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs/guides/immutable-state-and-merging
// session-store.ts additions
interface SessionState {
  session: Session | null;
  // ... existing fields
  setSessionDefaultTemplate: (templateId: string | null) => Promise<void>;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  // ... existing state

  setSessionDefaultTemplate: async (templateId) => {
    const session = get().session;
    if (!session) return;

    const { data, error } = await supabase
      .from('sessions')
      .update({ default_template_id: templateId })
      .eq('id', session.id)
      .select()
      .single();

    if (error) throw error;

    set({ session: data });
  },
}));
```

### Pattern 6: Bulk Apply Confirmation
**What:** Offer to apply new default to existing templateless questions
**When to use:** After admin sets a session default template
**Example:**
```typescript
// Source: https://medium.com/@hrupanjan/building-a-flexible-confirmation-dialog-system-in-react-or-next-js-with-typescript-1e57965b523b
async function handleSetDefault(templateId: string) {
  // Update session
  await useSessionStore.getState().setSessionDefaultTemplate(templateId);

  // Check for templateless MC questions
  const templatelessQuestions = questions.filter(q =>
    q.type === 'multiple_choice' && !q.template_id
  );

  if (templatelessQuestions.length > 0) {
    // Show bulk apply confirmation
    setBulkApplyConfirm({
      templateId,
      questionCount: templatelessQuestions.length,
    });
  }
}

async function confirmBulkApply() {
  // Apply template to all templateless MC questions
  const updates = templatelessQuestions.map(q =>
    supabase
      .from('questions')
      .update({ template_id: bulkApplyConfirm.templateId })
      .eq('id', q.id)
  );

  await Promise.all(updates);
  // Refresh questions
}
```

### Anti-Patterns to Avoid
- **Don't duplicate vote-checking logic** - Extract to shared function like `checkQuestionVotes(questionId)` similar to `checkTemplateVotes()`
- **Don't mutate state directly** - Always use Zustand set function with spread operator for nested updates
- **Don't skip confirmation on detach** - User expects warning before losing template link, even though options are preserved
- **Don't allow template switch with votes** - Data integrity violation, options may no longer match vote values
- **Don't forget to clear selection** - Empty string value in select represents "None", handle explicitly

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vote existence check | Custom query each time | Extract `checkQuestionVotes(questionId)` helper | Reused in multiple places, matches Phase 11 pattern |
| Confirmation dialogs | Inline modal code | Existing `ConfirmDialog` component | Consistent UX, already handles loading states |
| Template dropdown | Custom searchable UI | Native HTML `<select>` element | Small list (~5-20 templates), no need for complexity |
| Foreign key column | JSONB template reference | PostgreSQL UUID FK with ON DELETE SET NULL | Database integrity, efficient joins, Phase 11 already set up |
| State updates | Direct property assignment | Zustand `set` with spread operator | Immutability, React re-render triggers |

**Key insight:** This phase is primarily about composition of existing patterns. The database schema (foreign keys) already exists from Phase 11. The UI patterns (dropdowns, confirmations, locked states) have precedent in the codebase. The complexity is in state coordination, not implementation.

## Common Pitfalls

### Pitfall 1: Not Handling Empty String from Select
**What goes wrong:** `<select>` returns empty string for "None" option, but app uses `null` for no template
**Why it happens:** HTML select value is always a string, including empty string for default/none
**How to avoid:** Convert empty string to null in onChange handler
**Warning signs:** Template assignment bugs, "None" option not working
**Prevention:**
```typescript
onChange={(e) => {
  const val = e.target.value;
  onChange(val === '' ? null : val);  // Convert '' to null
}}
```

### Pitfall 2: Race Condition with Template Fetch
**What goes wrong:** Template selector renders before templates are loaded, shows empty dropdown
**Why it happens:** Templates fetched async on mount, form renders immediately
**How to avoid:** Show loading skeleton or disable selector until templates loaded
**Warning signs:** Dropdown appears empty briefly, selected template doesn't show on edit
**Prevention:**
```typescript
const { templates, loading } = useTemplateStore();

{loading ? (
  <div className="h-10 bg-gray-100 animate-pulse rounded" />
) : (
  <TemplateSelector templates={templates} ... />
)}
```

### Pitfall 3: Forgetting Vote Check on Template Switch
**What goes wrong:** Admin switches template on question with votes, invalidates participant data
**Why it happens:** Vote check only implemented on detach, not on template change
**How to avoid:** Check votes before ANY template_id change in edit mode
**Warning signs:** Vote counts don't match options after template switch
**Prevention:**
```typescript
// Check votes for BOTH detach (null) AND switch (different template)
if (editingQuestion && newTemplateId !== editingQuestion.template_id) {
  const hasVotes = await checkQuestionVotes(editingQuestion.id);
  if (hasVotes) {
    setError('Cannot change template: question has received votes');
    return;
  }
}
```

### Pitfall 4: Shallow Merge Overwriting Session Fields
**What goes wrong:** Updating session.default_template_id with `set({ default_template_id: ... })` replaces entire session object
**Why it happens:** Zustand `set` only merges at top level, not nested objects
**How to avoid:** Spread existing session object when updating nested properties
**Warning signs:** Session data disappears after setting default template
**Prevention:**
```typescript
// WRONG - replaces entire session
set({ session: { default_template_id: templateId } });

// CORRECT - merges with existing session
set((state) => ({
  session: state.session ? { ...state.session, default_template_id: templateId } : null
}));
```

### Pitfall 5: Not Persisting Options on Detach
**What goes wrong:** Detaching template clears options, losing user's data
**Why it happens:** Setting template_id to null without copying template.options to question.options
**How to avoid:** Always copy current template options to custom options before clearing template_id
**Warning signs:** Options disappear when detaching, question becomes invalid
**Prevention:**
```typescript
// WRONG - loses options
await supabase.from('questions').update({ template_id: null });

// CORRECT - copy options first (fork pattern)
const currentOptions = template ? template.options : customOptions;
await supabase.from('questions').update({
  template_id: null,
  options: currentOptions  // Preserve options as custom
});
```

### Pitfall 6: Applying Default to Questions with Votes
**What goes wrong:** Bulk apply overwrites options on questions that have received votes
**Why it happens:** Bulk apply doesn't check vote status per question
**How to avoid:** Filter out questions with votes before bulk apply
**Warning signs:** Vote data corruption, participant confusion
**Prevention:**
```typescript
// Check votes for each question before bulk update
const templatelessQuestions = questions.filter(q =>
  q.type === 'multiple_choice' && !q.template_id
);

// Filter out questions with votes
const safeToUpdate = await Promise.all(
  templatelessQuestions.map(async (q) => {
    const hasVotes = await checkQuestionVotes(q.id);
    return hasVotes ? null : q;
  })
).then(results => results.filter(q => q !== null));

// Only update questions without votes
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Controlled Select with TypeScript
```typescript
// Source: https://react.dev/reference/react-dom/components/select
interface TemplateSelectorProps {
  value: string | null;
  onChange: (templateId: string | null) => void;
  templates: ResponseTemplate[];
  disabled?: boolean;
  hasVotes?: boolean;
}

export function TemplateSelector({
  value,
  onChange,
  templates,
  disabled = false,
  hasVotes = false,
}: TemplateSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue === '' ? null : newValue);
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-300">
        Response Template
      </label>
      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled || hasVotes}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">None (custom options)</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      {hasVotes && (
        <p className="text-xs text-yellow-500">
          Template locked: question has received votes
        </p>
      )}
    </div>
  );
}
```

### Locked Options Display
```typescript
// Pattern from existing QuestionForm with read-only mode
interface LockedOptionsListProps {
  options: string[];
  templateName: string;
  onDetach: () => void;
}

function LockedOptionsList({ options, templateName, onDetach }: LockedOptionsListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-300">Options</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-indigo-900 text-indigo-200 rounded">
            Template: {templateName}
          </span>
          <button
            type="button"
            onClick={onDetach}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Detach
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {options.map((option, index) => (
          <div
            key={index}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
          >
            {option}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Options are locked while template is assigned. Detach to customize.
      </p>
    </div>
  );
}
```

### Vote Check Helper
```typescript
// Source: Extracted pattern from template-api.ts checkTemplateVotes()
/**
 * Check if a question has received any votes.
 * Used to prevent template assignment changes on questions with votes.
 */
export async function checkQuestionVotes(questionId: string): Promise<boolean> {
  const { data: votes, error } = await supabase
    .from('votes')
    .select('id')
    .eq('question_id', questionId)
    .limit(1);

  if (error) throw error;

  return votes !== null && votes.length > 0;
}
```

### Session Default Template Update
```typescript
// Source: Zustand immutable state pattern
// https://zustand.docs.pmnd.rs/guides/immutable-state-and-merging

// In session-store.ts
setSessionDefaultTemplate: async (templateId: string | null) => {
  const session = get().session;
  if (!session) throw new Error('No active session');

  const { data, error } = await supabase
    .from('sessions')
    .update({ default_template_id: templateId })
    .eq('id', session.id)
    .select()
    .single();

  if (error) throw error;

  // Merge update with existing session
  set((state) => ({
    session: state.session ? { ...state.session, ...data } : null,
  }));
},
```

### Detach Confirmation Flow
```typescript
// Source: Existing pattern from ResponseTemplatePanel
const [detachConfirm, setDetachConfirm] = useState<{
  questionId: string;
  templateName: string;
  options: string[];
} | null>(null);

async function handleDetachClick() {
  if (!template) return;

  setDetachConfirm({
    questionId: editingQuestion.id,
    templateName: template.name,
    options: template.options,
  });
}

async function confirmDetach() {
  if (!detachConfirm) return;

  try {
    // Update question: clear template_id, preserve options as custom
    const { error } = await supabase
      .from('questions')
      .update({
        template_id: null,
        options: detachConfirm.options,  // Fork template options
      })
      .eq('id', detachConfirm.questionId);

    if (error) throw error;

    // Update local state
    setTemplateId(null);
    setCustomOptions([...detachConfirm.options]);
    setDetachConfirm(null);
  } catch (err) {
    setErrorMsg(err instanceof Error ? err.message : 'Failed to detach template');
  }
}

// Render confirmation dialog
{detachConfirm && (
  <ConfirmDialog
    isOpen={true}
    onConfirm={confirmDetach}
    onCancel={() => setDetachConfirm(null)}
    title="Detach from template?"
    message={`Options from "${detachConfirm.templateName}" will become editable. The template itself won't be affected.`}
    confirmLabel="Detach"
    confirmVariant="primary"
  />
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-select library | Native HTML select | React 19 (2024) | Simpler, no dependencies for small lists |
| Redux for forms | Zustand + local state | Zustand 5 (2024) | Less boilerplate, better TypeScript |
| Immer for nested updates | Manual spread operator | N/A | Project choice, simpler for shallow nesting |
| Class components | Function components + hooks | React 16.8+ (2019) | Already standard in project |
| Formik for forms | Controlled components | N/A | Project pattern, forms are simple |

**Deprecated/outdated:**
- **findDOMNode for refs** - Use callback refs or useRef hook
- **componentWillReceiveProps** - Use useEffect with dependencies
- **String refs** - Use callback refs or createRef/useRef

## Open Questions

Things that couldn't be fully resolved:

1. **Session settings UI location**
   - What we know: No dedicated settings panel exists yet, AdminSession page has main UI
   - What's unclear: Should default template selector be in a new settings section, or integrated into existing panel areas?
   - Recommendation: Add to ResponseTemplatePanel as a session-scoped section (keeps template features co-located). Alternative: new SessionSettingsPanel if more settings will be added in future phases.

2. **Clear default mechanism**
   - What we know: User decisions say "Claude's discretion" for clear mechanism
   - What's unclear: Dropdown with "None" option vs explicit "Clear Default" button
   - Recommendation: Use dropdown with "None (no default)" option for consistency with template selector pattern. Simpler UX, single control.

3. **Template application timing with default**
   - What we know: Default should pre-select template on create, and offer bulk apply to existing
   - What's unclear: Should bulk apply happen automatically, or always require confirmation?
   - Recommendation: Always show confirmation with count of affected questions. Prevents accidental overwrites, gives user control.

## Sources

### Primary (HIGH confidence)
- [Zustand Official Docs - Immutable State and Merging](https://zustand.docs.pmnd.rs/guides/immutable-state-and-merging) - State update patterns
- [React Official Docs - Select Element](https://react.dev/reference/react-dom/components/select) - Controlled select pattern
- [React Official Docs - Using TypeScript](https://react.dev/learn/typescript) - Event handler types
- Existing codebase patterns:
  - `src/components/ResponseTemplatePanel.tsx` - Confirmation dialogs, template operations
  - `src/components/QuestionForm.tsx` - Form state management
  - `src/lib/template-api.ts` - Vote checking pattern
  - `src/stores/session-store.ts` - Zustand store structure
  - `supabase/migrations/20250209_010_response_templates.sql` - Foreign key schema

### Secondary (MEDIUM confidence)
- [React Form Design Patterns](https://www.dronahq.com/react-form-ui-tips/) - Form-heavy UI best practices
- [Working with Zustand - TkDodo's Blog](https://tkdodo.eu/blog/working-with-zustand) - Real-world Zustand patterns
- [React Input Readonly Attributes - DhiWise](https://www.dhiwise.com/post/mastering-react-input-readonly-attributes-best-practices) - Read-only field patterns
- [Building Confirmation Dialog - Medium](https://medium.com/@hrupanjan/building-a-flexible-confirmation-dialog-system-in-react-or-next-js-with-typescript-1e57965b523b) - Confirmation dialog patterns

### Tertiary (LOW confidence)
- [Supabase Foreign Keys GitHub Issues](https://github.com/supabase/supabase/issues/26648) - Nullable FK patterns (2024, not 2026-specific)
- [React Select Clear Selection - GitHub Issues](https://github.com/JedWatson/react-select/issues/3028) - Dropdown reset patterns (react-select specific, not applicable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, versions verified from package.json
- Architecture: HIGH - Patterns directly from React/Zustand official docs and existing codebase
- Pitfalls: HIGH - Based on common React form state bugs and verified with official docs
- Database schema: HIGH - Foreign key columns already exist from Phase 11 migration
- UI patterns: HIGH - Existing components (ConfirmDialog, ResponseTemplatePanel) provide precedent
- Vote checking: HIGH - Pattern already implemented in template-api.ts

**Research date:** 2026-02-09
**Valid until:** ~30 days (stable ecosystem, React 19 and Zustand 5 mature)

**Notes:**
- Phase 11 already implemented the database schema (template_id FK on questions table)
- Session schema needs migration to add default_template_id nullable FK column
- No new npm packages required
- Core complexity is state coordination, not new patterns
- All code examples verified against official documentation or existing codebase
