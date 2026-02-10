# Phase 14: Export/Import Integration - Research

**Researched:** 2026-02-09
**Domain:** JSON export/import with Zod schema validation and Supabase data integrity
**Confidence:** HIGH

## Summary

Phase 14 extends the existing JSON export/import system to include response templates alongside session data. The codebase already has a mature export/import implementation using Zod for schema validation, Supabase for database operations, and a two-function architecture (`exportSession` for full fidelity with votes, `exportSessionData` for structure-only).

The work involves:
1. Extending Zod schemas to include template definitions and template_id references
2. Fetching templates referenced by questions during export
3. Upserting templates during import with name-based deduplication
4. Preserving template-question associations through the round-trip

The existing patterns in `session-export.ts` and `session-import.ts` provide proven blueprints for this extension. The system already handles complex scenarios like unbatched questions, batch/question interleaving, and structure-only imports that ignore vote data.

**Primary recommendation:** Extend the existing export/import architecture by adding template support to both export functions, using Zod for schema validation, and implementing upsert-with-deduplication during import. Follow the established pattern of separating export (full fidelity) from import (structure-only).

## Standard Stack

### Core

The project already uses these libraries (no new dependencies needed):

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.25.76 | Runtime schema validation | Industry standard for TypeScript schema validation, already used throughout the import/export system |
| @supabase/supabase-js | 2.93.2 | Database client | Project's database layer, provides type-safe queries and RLS |
| TypeScript | 5.7.3 | Type safety | Ensures data integrity across export/import boundary |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.2.4 | Testing framework | Unit tests for schema validation and round-trip integrity |
| @testing-library/react | 16.3.2 | Component testing | Test import/export UI feedback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | JSON Schema + Ajv | More verbose, less TypeScript integration, no benefit for this project |
| Name-based dedup | UUID-based matching | Would fail on cross-instance imports, breaks user expectation |
| Separate template export | Inline template in each question | Massive redundancy, larger files, error-prone |

**Installation:**
```bash
# No new dependencies needed - all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure

Based on existing codebase:

```
src/lib/
├── session-export.ts        # Export functions (extend for templates)
├── session-import.ts        # Import validation & database write (extend for templates)
├── template-api.ts          # Template CRUD operations (already exists)
└── supabase.ts             # Supabase client

src/types/
└── database.ts             # TypeScript interfaces (ResponseTemplate already defined)
```

### Pattern 1: Zod Schema Extension

**What:** Extend existing Zod schemas to include template data while maintaining backward compatibility

**When to use:** When adding new fields to existing export/import formats

**Example:**
```typescript
// Current pattern from session-export.ts (lines 32-36)
export const SessionExportSchema = z.object({
  session_name: z.string(),
  created_at: z.string(),
  batches: z.array(BatchExportSchema),
});

// Extended pattern for templates
const TemplateExportSchema = z.object({
  name: z.string(),
  options: z.array(z.string()).min(2),
});

export const SessionExportSchemaV2 = z.object({
  session_name: z.string(),
  created_at: z.string(),
  batches: z.array(BatchExportSchema),
  templates: z.array(TemplateExportSchema).optional(), // Optional for backward compat
});

// Questions need template_id added
const QuestionExportSchemaV2 = QuestionExportSchema.extend({
  template_id: z.string().nullable(),
});
```

**Key insight:** Making `templates` optional ensures old export files (pre-template) can still be imported without errors.

### Pattern 2: Export Data Collection

**What:** Fetch referenced templates by collecting unique template_ids from questions

**When to use:** When exporting related data that shouldn't include unused records

**Example:**
```typescript
// Existing pattern from session-export.ts (lines 77-107)
async function exportSession(sessionId: string) {
  // Fetch session, batches, questions, votes
  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', sessionId);

  // NEW: Collect unique template IDs
  const templateIds = new Set<string>();
  for (const q of questions ?? []) {
    if (q.template_id) {
      templateIds.add(q.template_id);
    }
  }

  // NEW: Fetch only referenced templates
  const { data: templates } = await supabase
    .from('response_templates')
    .select('*')
    .in('id', Array.from(templateIds));

  return {
    session_name: session.title,
    created_at: session.created_at,
    batches: batchedExport,
    templates: templates?.map(t => ({
      name: t.name,
      options: t.options,
    })) ?? [],
  };
}
```

**Why collect instead of fetch all:** Only exports templates actually used by the session, keeping export files minimal and focused.

### Pattern 3: Upsert with Name-Based Deduplication

**What:** Match templates by name during import, reuse existing or update options

**When to use:** When importing globally-shared resources with human-readable names

**Example:**
```typescript
// NEW pattern (based on 14-CONTEXT.md decisions)
async function importTemplates(
  templates: Array<{ name: string; options: string[] }>
): Promise<Map<string, string>> {
  // Map of template name -> template ID for question linking
  const templateMap = new Map<string, string>();

  for (const tmpl of templates) {
    // Check if template with this name exists
    const { data: existing } = await supabase
      .from('response_templates')
      .select('id, options')
      .eq('name', tmpl.name)
      .single();

    if (existing) {
      // Compare options (arrays)
      const optionsMatch = JSON.stringify(existing.options) === JSON.stringify(tmpl.options);

      if (optionsMatch) {
        // Reuse existing template
        templateMap.set(tmpl.name, existing.id);
      } else {
        // Same name, different options - overwrite per 14-CONTEXT.md
        const { data: updated } = await supabase
          .from('response_templates')
          .update({ options: tmpl.options })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (updated) {
          templateMap.set(tmpl.name, updated.id);
        }
      }
    } else {
      // New template - insert
      const { data: created } = await supabase
        .from('response_templates')
        .insert({ name: tmpl.name, options: tmpl.options })
        .select('id')
        .single();

      if (created) {
        templateMap.set(tmpl.name, created.id);
      }
    }
  }

  return templateMap;
}
```

**Critical detail:** Per 14-CONTEXT.md, if name matches but options differ, overwrite the existing template. This ensures imported template definitions are authoritative.

### Pattern 4: Template-Question Association Restoration

**What:** Use template name map to restore template_id references when inserting questions

**When to use:** When importing related records that need foreign key associations

**Example:**
```typescript
// Extend existing importSessionData pattern (session-import.ts lines 189-350)
async function importSessionData(
  sessionId: string,
  data: ImportData
): Promise<{ batchCount: number; questionCount: number; templateCount: number }> {

  // NEW: Import templates first, get name->ID map
  const templateMap = await importTemplates(data.templates ?? []);

  // Existing: insert batches...

  // Modified: insert questions with template_id restoration
  const questionInserts = allQuestions.map((item, idx) => ({
    session_id: sessionId,
    batch_id: item.originalBatchPosition === null
      ? null
      : batchIdByOriginalPosition.get(item.originalBatchPosition) ?? null,
    text: item.question.text,
    type: item.question.type,
    options: item.question.options,
    anonymous: item.question.anonymous,
    position: questionStartPos + idx,
    status: 'pending' as const,
    // NEW: Restore template_id by looking up in map
    template_id: item.question.template_id
      ? (templateMap.get(item.question.template_id) ?? null)
      : null,
  }));

  // ... rest of insertion logic

  return {
    batchCount: insertedBatches.length,
    questionCount: totalQuestions,
    templateCount: templateMap.size,
  };
}
```

**Key insight:** Template import must happen BEFORE question import, so the name->ID map is available for foreign key restoration.

### Pattern 5: Two-Function Export Strategy

**What:** Maintain two export functions with different use cases

**When to use:** When different callers need different fidelity levels

**Existing functions:**
- `exportSession(sessionId)` - Full fidelity including votes (session-export.ts line 77)
- `exportSessionData(questions, batches, sessionName?)` - Structure-only for migration (session-import.ts line 50)

**Decision point (from 14-CONTEXT.md):** Add template support to both or just primary?

**Recommendation:** Add to BOTH functions for consistency:
- `exportSession`: Fetch templates from DB via template_ids in questions
- `exportSessionData`: Accept templates as parameter (caller provides)

**Example:**
```typescript
// Modified signature
export function exportSessionData(
  questions: Question[],
  batches: Batch[],
  templates: ResponseTemplate[],  // NEW parameter
  sessionName?: string
): string {
  // Build template array for export
  const exportTemplates = templates.map(t => ({
    name: t.name,
    options: t.options,
  }));

  const exportData = {
    session_name: sessionName,
    created_at: new Date().toISOString(),
    batches: exportBatches,
    templates: exportTemplates,  // NEW field
  };

  return JSON.stringify(exportData, null, 2);
}
```

### Anti-Patterns to Avoid

- **Exporting all global templates:** Only export templates referenced by questions in the session. Exporting unused templates pollutes the import.
- **UUID-based template matching:** Templates are global resources identified by human-readable names. Matching by UUID fails when importing across Supabase instances.
- **Inline template duplication:** Storing full template definition in each question creates massive redundancy. Use top-level templates array with references.
- **Silent import failures:** If template import fails, the entire import should fail (all-or-nothing per 14-CONTEXT.md). Partial imports create inconsistent state.
- **Skipping backward compatibility:** Old export files (pre-template) must import without errors. Make templates field optional in import schema.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validation with if/else chains | Zod schemas with `.safeParse()` | Type inference, composability, clear error messages already proven in codebase |
| Array comparison for options | Manual loop comparison | `JSON.stringify(arr1) === JSON.stringify(arr2)` | Handles nested arrays, null values, order-sensitive comparison correctly |
| Template deduplication | Custom Map/Set logic | Supabase `.select().eq('name')` then conditional upsert | Atomic database operations, handles race conditions, leverages unique constraint |
| Export file generation | Manual JSON construction | `JSON.stringify(data, null, 2)` with Blob download | Proper escaping, formatting, browser compatibility (pattern exists in session-export.ts line 172) |
| Import validation feedback | Custom error formatting | Zod error `.issues` array mapping | Structured errors with paths, existing pattern in session-import.ts line 171 |

**Key insight:** The existing export/import system has battle-tested patterns for all these concerns. Don't reinvent - extend the proven patterns.

## Common Pitfalls

### Pitfall 1: Template Import Ordering

**What goes wrong:** Inserting questions before templates are imported causes foreign key constraint failures

**Why it happens:** Questions have `template_id` foreign key to `response_templates.id`. If template doesn't exist yet, insert fails.

**How to avoid:**
1. Import templates FIRST in `importSessionData`
2. Build name->ID map from template import results
3. Use map to populate `template_id` when inserting questions

**Warning signs:**
- Foreign key constraint errors during import: `violates foreign key constraint "questions_template_id_fkey"`
- Questions inserted with `template_id: null` when they should have template references

### Pitfall 2: Template Name Case Sensitivity

**What goes wrong:** "Yes/No" and "yes/no" treated as different templates, causing unexpected duplication

**Why it happens:** Postgres text columns are case-sensitive by default. Unique constraint on `name` is case-sensitive.

**How to avoid:**
- Use exact case-sensitive matching during import (per 14-CONTEXT.md decision)
- Document this behavior in user-facing messages
- Don't try to normalize case - it creates ambiguity

**Warning signs:**
- Users report "duplicate" templates with different capitalization
- Import creates new template instead of reusing existing one due to case mismatch

### Pitfall 3: Backward Compatibility Breaking

**What goes wrong:** Old export files (pre-template) fail to import after schema changes

**Why it happens:** Adding required `templates` field to import schema breaks validation for files that lack it

**How to avoid:**
- Make `templates` field `.optional()` in Zod schema
- Default to empty array if not present: `data.templates ?? []`
- Test with actual pre-template export file from Phase 13

**Warning signs:**
- Zod validation errors on known-good export files
- Error message: `Required at "templates"`

### Pitfall 4: Template ID Mapping Misalignment

**What goes wrong:** Questions link to wrong templates after import

**Why it happens:** Export contains template NAME in question's template_id field (string), but database needs template UUID

**How to avoid:**
- In export: Store template NAME (not ID) in question.template_id field
- In import: Use templateMap to convert name -> database UUID before question insert
- Alternative: Store template as separate top-level array, questions reference by array index (then map to name during import)

**Recommendation from research:** Store template NAME in export question.template_id field. This makes the export file human-readable and resilient to database UUID changes.

**Warning signs:**
- Questions have `template_id` pointing to non-existent template UUIDs
- Template rendering fails for imported questions

### Pitfall 5: All-or-Nothing Transaction Illusion

**What goes wrong:** Thinking Supabase client provides transaction boundaries for multi-table inserts

**Why it happens:** Supabase client doesn't expose Postgres transactions in JavaScript layer. Each `.insert()` is a separate HTTP request.

**How to avoid:**
- Accept that import is NOT fully atomic (existing note in session-import.ts line 186)
- If template import fails, throw error BEFORE inserting questions/batches
- Order operations: templates → batches → questions (fail early if templates fail)
- Consider implementing cleanup on failure (delete inserted templates if question insert fails)

**Warning signs:**
- Partial imports leave orphaned templates in database
- Second import attempt creates duplicate templates

### Pitfall 6: Template Options Array Deep Equality

**What goes wrong:** Template considered "different" when options are actually identical, causing unnecessary overwrites

**Why it happens:** JavaScript array comparison by reference: `['A','B'] !== ['A','B']`

**How to avoid:**
```typescript
// WRONG
if (existing.options === tmpl.options) { ... }

// RIGHT
if (JSON.stringify(existing.options) === JSON.stringify(tmpl.options)) { ... }
```

**Warning signs:**
- Every import overwrites templates even when options haven't changed
- Template `updated_at` changes on every import

## Code Examples

Verified patterns from existing codebase and research:

### Export Templates (NEW)

```typescript
// Extend session-export.ts exportSession function
export async function exportSession(sessionId: string): Promise<SessionExport> {
  // ... existing code to fetch session, batches, questions, votes ...

  // NEW: Collect unique template IDs from questions
  const questionList = questions ?? [];
  const templateIds = new Set<string>();
  for (const q of questionList) {
    if (q.template_id) {
      templateIds.add(q.template_id);
    }
  }

  // NEW: Fetch only templates referenced by questions
  let templates: Array<{ name: string; options: string[] }> = [];
  if (templateIds.size > 0) {
    const { data: templateData } = await supabase
      .from('response_templates')
      .select('name, options')
      .in('id', Array.from(templateIds));

    templates = templateData ?? [];
  }

  // ... existing batch/question grouping logic ...

  return {
    session_name: session.title,
    created_at: session.created_at,
    batches: batchedExport,
    templates, // NEW field
  };
}
```

### Import Templates with Deduplication (NEW)

```typescript
// NEW function in session-import.ts
async function upsertTemplates(
  templates: Array<{ name: string; options: string[] }>
): Promise<Map<string, string>> {
  const nameToIdMap = new Map<string, string>();

  for (const tmpl of templates) {
    // Check for existing template with same name
    const { data: existing } = await supabase
      .from('response_templates')
      .select('id, options')
      .eq('name', tmpl.name)
      .maybeSingle();

    if (existing) {
      // Template with this name exists
      const optionsMatch = JSON.stringify(existing.options) === JSON.stringify(tmpl.options);

      if (optionsMatch) {
        // Same name, same options - reuse
        nameToIdMap.set(tmpl.name, existing.id);
      } else {
        // Same name, different options - overwrite per 14-CONTEXT.md
        const { data: updated, error } = await supabase
          .from('response_templates')
          .update({ options: tmpl.options })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) throw error;
        nameToIdMap.set(tmpl.name, updated.id);
      }
    } else {
      // New template - insert
      const { data: created, error } = await supabase
        .from('response_templates')
        .insert({ name: tmpl.name, options: tmpl.options })
        .select('id')
        .single();

      if (error) {
        // Handle unique constraint race condition
        if (error.code === '23505') {
          // Another process inserted it - retry fetch
          const { data: retry } = await supabase
            .from('response_templates')
            .select('id')
            .eq('name', tmpl.name)
            .single();
          if (retry) {
            nameToIdMap.set(tmpl.name, retry.id);
          }
        } else {
          throw error;
        }
      } else {
        nameToIdMap.set(tmpl.name, created.id);
      }
    }
  }

  return nameToIdMap;
}
```

### Extended Import Function (MODIFIED)

```typescript
// Modified session-import.ts importSessionData
export async function importSessionData(
  sessionId: string,
  data: ImportData
): Promise<{ batchCount: number; questionCount: number; templateCount: number }> {

  // NEW: Import templates FIRST, get name->ID mapping
  const templateMap = await upsertTemplates(data.templates ?? []);

  // Existing: Get existing batch/question positions for append
  const { data: existingBatches } = await supabase
    .from('batches')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  // ... existing batch/question interleaving logic ...

  // Modified: Insert questions with template_id from map
  const questionInserts = allQuestions.map((item, idx) => {
    // NEW: Resolve template_id from name
    let resolvedTemplateId: string | null = null;
    if (item.question.template_id) {
      // Export stores template NAME in template_id field
      resolvedTemplateId = templateMap.get(item.question.template_id) ?? null;
    }

    return {
      session_id: sessionId,
      batch_id: item.originalBatchPosition === null
        ? null
        : batchIdByOriginalPosition.get(item.originalBatchPosition) ?? null,
      text: item.question.text,
      type: item.question.type,
      options: item.question.options,
      anonymous: item.question.anonymous,
      position: questionStartPos + idx,
      status: 'pending' as const,
      template_id: resolvedTemplateId, // NEW: Restored from map
    };
  });

  if (questionInserts.length > 0) {
    const { error: qError } = await supabase
      .from('questions')
      .insert(questionInserts);

    if (qError) {
      throw new Error(`Failed to import questions: ${qError.message}`);
    }
    totalQuestions = questionInserts.length;
  }

  return {
    batchCount: insertedBatches.length,
    questionCount: totalQuestions,
    templateCount: templateMap.size, // NEW: Report template count
  };
}
```

### Extended Zod Schemas (MODIFIED)

```typescript
// Modified session-export.ts schemas
const TemplateExportSchema = z.object({
  name: z.string(),
  options: z.array(z.string()),
});

const QuestionExportSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  template_id: z.string().nullable(), // NEW: Template name reference
  votes: z.array(VoteExportSchema),
});

export const SessionExportSchema = z.object({
  session_name: z.string(),
  created_at: z.string(),
  batches: z.array(BatchExportSchema),
  templates: z.array(TemplateExportSchema).optional(), // NEW: Optional for backward compat
});

// Modified session-import.ts schemas
const QuestionImportSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  position: z.number().optional(),
  template_id: z.string().nullable().optional(), // NEW: Template name (optional for old exports)
  votes: z.array(z.any()).optional(),
});

export const ImportSchema = z.object({
  session_name: z.string().optional(),
  created_at: z.string().optional(),
  batches: z.array(BatchImportSchema).min(1, 'At least one batch is required'),
  templates: z.array(TemplateExportSchema).optional(), // NEW: Optional for backward compat
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON parsing | Zod runtime validation | Phase 9 (Session Management) | Type-safe imports, clear error messages |
| Votes included in import | Votes ignored during import | Phase 9 | Structure-only import prevents vote duplication |
| Simple array format | Batch-grouped format | Phase 6 (Batch Schema) | Preserves batch organization |
| No template support | Templates included in export/import | Phase 14 (current) | Template-question associations preserved |

**Deprecated/outdated:**
- Simple question array format: Still supported for backward compatibility but batch format is preferred (session-import.ts lines 32-38, 152-167)
- Exporting votes for migration: Votes are included in export for archival but ignored during import to prevent duplication

## Open Questions

Things that couldn't be fully resolved:

1. **Session default_template_id Restoration**
   - What we know: Sessions have a `default_template_id` field (database.ts line 26) used for auto-applying templates to new MC questions
   - What's unclear: Should import restore this setting? Or is it a local preference that shouldn't transfer?
   - Recommendation: DON'T restore default_template_id on import. It's a session-specific admin preference, not data. Per 14-CONTEXT.md, this is marked as "Claude's Discretion" - decision here is to skip it.

2. **Overwrite Feedback Detail Level**
   - What we know: Success message should show counts: "Imported 3 batches, 12 questions, 2 templates" (per 14-CONTEXT.md)
   - What's unclear: Should we also show which templates were overwritten vs reused?
   - Recommendation: Keep it simple - counts only per 14-CONTEXT.md. Overwrite details are internal mechanics users don't need to see.

3. **Template Import Rollback Strategy**
   - What we know: Import is NOT atomic across multiple tables (Supabase client limitation)
   - What's unclear: Should we implement cleanup logic to delete imported templates if question import fails?
   - Recommendation: Accept partial failure for now. Document that import may leave orphaned templates if question insert fails. Cleanup can be added in a later polish phase if it becomes a problem.

## Sources

### Primary (HIGH confidence)

- Existing codebase files:
  - `src/lib/session-export.ts` - Export implementation with Zod schemas
  - `src/lib/session-import.ts` - Import validation and database write logic
  - `src/lib/template-api.ts` - Template CRUD operations
  - `src/types/database.ts` - TypeScript interface definitions
  - `supabase/migrations/20250209_010_response_templates.sql` - Database schema

- 14-CONTEXT.md - User decisions from phase discussion:
  - Name collision handling (case-sensitive, overwrite on option mismatch)
  - Export scope (only referenced templates, no default_template_id)
  - Import feedback (counts only, all-or-nothing on failure)

- MEMORY.md - Project-specific patterns:
  - Supabase gotchas (moddatetime unavailable, manual migrations)
  - Zustand for state management
  - ~400 existing tests

### Secondary (MEDIUM confidence)

- Zod documentation (from training data, version 3.25.76):
  - `.optional()` for backward compatibility
  - `.safeParse()` for validation without throwing
  - Type inference with `z.infer<typeof Schema>`

- Supabase documentation (from training data, version 2.93.2):
  - `.select().eq().maybeSingle()` for conditional fetch
  - `.upsert()` exists but doesn't support conditional logic (hence manual upsert pattern)
  - Error code `23505` for unique constraint violations

### Tertiary (LOW confidence)

None - all research based on existing codebase and official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all libraries already in use
- Architecture: HIGH - Existing export/import patterns are proven and well-tested
- Pitfalls: HIGH - Based on actual codebase patterns and Supabase/Zod behavior

**Research date:** 2026-02-09
**Valid until:** 60 days (stable domain - JSON export/import patterns don't change rapidly)
