# Phase 15: Admin Results Template Ordering - Research

**Researched:** 2026-02-10
**Domain:** Data aggregation, state management, component integration
**Confidence:** HIGH

## Summary

Phase 15 addresses tech debt item #1 from the v1.2 milestone audit: admin result views (AdminSession and SessionResults) display bar chart columns without consulting response templates, potentially showing results in a different order than participants voted. The solution is straightforward — both components already import from vote-aggregation.ts but bypass the buildConsistentBarData() helper that handles template ordering.

The fix requires:
1. AdminSession.tsx: Replace 2 inline `aggregated.map()` calls with buildConsistentBarData()
2. SessionResults.tsx: Add template store integration and pass templateOptions parameter
3. Both files already have minimal dependencies (template store, vote-aggregation utility)

SessionReview.tsx demonstrates the correct pattern and serves as the reference implementation. The technical approach is proven, tested in production since Phase 13, and backward compatible.

**Primary recommendation:** Follow SessionReview.tsx pattern — integrate template store, lookup template by question.template_id, pass template.options to buildConsistentBarData().

## Standard Stack

This phase uses existing project infrastructure — no new libraries required.

### Core Dependencies (Already Present)
| Library | Purpose | Already Used By |
|---------|---------|-----------------|
| Zustand (useTemplateStore) | Template state management | SessionReview, VoteMultipleChoice, QuestionForm |
| vote-aggregation.ts | Consistent bar data building with template support | SessionReview (correct), AdminSession (missing), SessionResults (missing) |
| template-api.ts | fetchTemplates() utility | ResponseTemplatePanel, QuestionForm |

### Integration Points
| Component | Current State | Required Change |
|-----------|---------------|-----------------|
| AdminSession.tsx | Imports vote-aggregation, missing buildConsistentBarData usage | Add template lookup, replace 2 inline map calls |
| SessionResults.tsx | Imports vote-aggregation, missing template store | Add useTemplateStore import, template lookup logic |
| SessionReview.tsx | ✓ Reference implementation (correct) | No changes needed |

**Installation:** None required — all dependencies present.

## Architecture Patterns

### Pattern 1: Template-Aware Bar Data Building
**What:** Look up template by question.template_id, pass template.options to buildConsistentBarData()
**When to use:** Any component displaying aggregated results for multiple choice questions
**Example:**
```typescript
// Source: SessionReview.tsx lines 16-34
import { buildConsistentBarData } from '../lib/vote-aggregation';
import { useTemplateStore } from '../stores/template-store';

function buildBarData(question: Question, aggregated: VoteCount[]) {
  // Use consistent ordering for stable column positions
  const ordered = buildConsistentBarData(question, aggregated);
  return ordered.map((vc, index) => {
    let color: string;
    if (question.type === 'agree_disagree') {
      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }
    return {
      label: vc.value,
      count: vc.count,
      percentage: vc.percentage,
      color,
    };
  });
}
```

**Key characteristics:**
- buildConsistentBarData() handles both agree_disagree (hardcoded order) and multiple_choice (template order)
- Backward compatible — works with or without template_id
- Color assignment happens AFTER ordering (position-based indexing maintained)

### Pattern 2: Template Lookup from Store
**What:** Access template store, find template by ID, extract options array
**When to use:** Component needs to derive display data from question.template_id
**Example:**
```typescript
// Source: VoteMultipleChoice.tsx lines 45-58
import { useTemplateStore } from '../stores/template-store';

const template = useTemplateStore(state =>
  question.template_id
    ? state.templates.find(t => t.id === question.template_id)
    : null
);

// Derive display options: template takes precedence over question.options
const displayOptions = useMemo(() => {
  if (question.template_id && template?.options) {
    return template.options;
  }
  return question.options ?? [];
}, [question.template_id, question.options, template?.options]);
```

**Key characteristics:**
- Template lookup is optional — gracefully handles missing template_id
- useMemo ensures stable reference (prevents re-renders)
- Template options take precedence when template_id is set

### Pattern 3: Template Loading Timing
**What:** Ensure templates are loaded before components need them
**When to use:** Admin components that display template-dependent data
**Example:**
```typescript
// Source: ResponseTemplatePanel.tsx lines 32-37
useEffect(() => {
  fetchTemplates().catch((err) => {
    console.error('Failed to fetch templates:', err);
  });
}, []);
```

**Key characteristics:**
- Call fetchTemplates() explicitly in component useEffect
- Don't rely on implicit loading from child component mounts
- Error handling prevents silent failures

### Anti-Patterns to Avoid
- **Inline aggregation mapping** — Bypasses consistent ordering. Use buildConsistentBarData() instead.
- **Color assignment before ordering** — Breaks position-based color mapping. Order first, then map colors by index.
- **Implicit template loading** — AdminSession currently relies on ResponseTemplatePanel mounting to trigger fetchTemplates(). Explicit call in AdminSession useEffect is more robust.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar chart column ordering | Custom sorting logic per component | buildConsistentBarData() from vote-aggregation.ts | Already handles agree_disagree hardcoded order, multiple_choice template order, backward compatibility, and fallback logic |
| Template state management | Local state or props drilling | useTemplateStore from template-store.ts | Centralized, reactive, used consistently across codebase |
| Template fetching | Direct Supabase calls | fetchTemplates() from template-api.ts | Updates store automatically, handles errors, used in 4+ components |

**Key insight:** vote-aggregation.ts already solves the ordering problem. Components just need to call it correctly with the optional templateOptions parameter.

## Common Pitfalls

### Pitfall 1: Forgetting Template Store Integration
**What goes wrong:** Component tries to look up template but store is empty (templates never loaded)
**Why it happens:** Template loading is implicit (triggered by ResponseTemplatePanel mount) rather than explicit
**How to avoid:** Add explicit fetchTemplates() call in AdminSession useEffect (tech debt item #2)
**Warning signs:** Template-linked questions show results in question.options order instead of template order, even though template_id is set

### Pitfall 2: Color Mapping After Reordering
**What goes wrong:** Colors assigned to options before buildConsistentBarData() reorders them, breaking position-based color consistency
**Why it happens:** Tempting to build full bar data objects early, then sort them
**How to avoid:** Always order first (buildConsistentBarData returns VoteCount[]), then map to bar data with colors by index
**Warning signs:** Same option gets different colors in different views, colors don't match participant vote buttons

### Pitfall 3: Modifying Two Places Inconsistently
**What goes wrong:** AdminSession has TWO locations that build bar data (ActiveQuestionHero live results + Previous Results grid). Updating only one creates inconsistency.
**Why it happens:** ActiveQuestionHero is a separate component at bottom of file, easy to miss during refactor
**How to avoid:** Search for all `aggregated.map()` or `MULTI_CHOICE_COLORS[index]` patterns in AdminSession.tsx, update all
**Warning signs:** Live results show correct order but grid below shows different order (or vice versa)

### Pitfall 4: Template Not Found Edge Case
**What goes wrong:** Question has template_id but template was deleted, causing undefined reference
**Why it happens:** ON DELETE SET NULL only clears template_id on questions table, but if data is stale or race condition occurs
**How to avoid:** buildConsistentBarData() already handles this — it falls back to question.options if templateOptions is undefined/empty
**Warning signs:** Questions with deleted templates show no columns or crash rendering

## Code Examples

Verified patterns from working codebase:

### Example 1: AdminSession Live Results (Current Incorrect Pattern)
```typescript
// Source: AdminSession.tsx lines 1458-1476 (ActiveQuestionHero component)
// CURRENT (INCORRECT) — bypasses template ordering
const barData = useMemo(() => {
  return aggregated.map((vc, index) => {
    let color: string;
    if (question.type === 'agree_disagree') {
      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color =
        AGREE_DISAGREE_COLORS[key] ??
        MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }
    return {
      label: vc.value,
      count: vc.count,
      percentage: vc.percentage,
      color,
    };
  });
}, [aggregated, question.type]);
```

### Example 2: AdminSession Previous Results Grid (Current Incorrect Pattern)
```typescript
// Source: AdminSession.tsx lines 1303-1322
// CURRENT (INCORRECT) — bypasses template ordering
const barData = aggregated.map((vc, index) => {
  let color: string;
  if (q.type === 'agree_disagree') {
    const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
    color =
      AGREE_DISAGREE_COLORS[key] ??
      MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
  } else {
    color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
  }
  return {
    label: vc.value,
    count: vc.count,
    percentage: vc.percentage,
    color,
  };
});
```

### Example 3: SessionResults buildBarData (Current Incorrect Pattern)
```typescript
// Source: SessionResults.tsx lines 18-34
// CURRENT (INCORRECT) — bypasses template ordering
function buildBarData(result: QuestionResult) {
  return result.aggregated.map((vc, index) => {
    let color: string;
    if (result.question.type === 'agree_disagree') {
      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }
    return {
      label: vc.value,
      count: vc.count,
      percentage: vc.percentage,
      color,
    };
  });
}
```

### Example 4: Correct Pattern (SessionReview Reference)
```typescript
// Source: SessionReview.tsx lines 16-34
// CORRECT — uses buildConsistentBarData with template support
function buildBarData(question: Question, aggregated: VoteCount[]) {
  // Use consistent ordering for stable column positions
  const ordered = buildConsistentBarData(question, aggregated);
  return ordered.map((vc, index) => {
    let color: string;
    if (question.type === 'agree_disagree') {
      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }
    return {
      label: vc.value,
      count: vc.count,
      percentage: vc.percentage,
      color,
    };
  });
}
```

**Key difference:** Correct pattern calls `buildConsistentBarData(question, aggregated)` BEFORE mapping to bar data objects. This ensures ordering happens first.

### Example 5: buildConsistentBarData Implementation
```typescript
// Source: vote-aggregation.ts lines 24-61
/**
 * Builds bar data with consistent column ordering.
 * For agree_disagree: always [Agree, Sometimes, Disagree]
 * For multiple_choice: uses templateOptions if provided, else question.options order (as authored)
 */
export function buildConsistentBarData(
  question: Question,
  aggregated: VoteCount[],
  templateOptions?: string[]
): VoteCount[] {
  // Define expected order based on question type
  let expectedOrder: string[];

  if (question.type === 'agree_disagree') {
    expectedOrder = ['Agree', 'Sometimes', 'Disagree'];
  } else if (templateOptions && templateOptions.length > 0) {
    expectedOrder = templateOptions;
  } else if (question.options && Array.isArray(question.options)) {
    // Use authored order for multiple choice
    expectedOrder = question.options;
  } else {
    // Fallback: return as-is
    return aggregated;
  }

  // Sort aggregated results to match expected order
  // Include items even if they have 0 votes (for consistent columns)
  return expectedOrder.map(value => {
    const found = aggregated.find(
      vc => vc.value.toLowerCase() === value.toLowerCase()
    );
    return found || {
      value,
      count: 0,
      percentage: 0
    };
  });
}
```

**Key features:**
- Optional templateOptions parameter (backward compatible)
- Handles agree_disagree (hardcoded order), multiple_choice with template, multiple_choice without template
- Case-insensitive matching
- Includes 0-vote options for consistent column layout

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Each component builds bar data inline | buildConsistentBarData() utility with template support | Phase 13 (v1.2) | SessionReview uses new pattern, AdminSession/SessionResults still use old |
| Template ordering only in participant view | Template ordering in participant AND admin views | Phase 15 (this phase) | Admin sees same result order as participants |
| Implicit template loading | Explicit fetchTemplates() call | Phase 15 (this phase) | More robust, doesn't rely on child component mount order |

**Deprecated/outdated:**
- Inline `aggregated.map()` without buildConsistentBarData — bypasses template ordering logic added in Phase 13

## Open Questions

None. The technical approach is proven and tested in production via SessionReview.tsx since Phase 13 completion.

## Sources

### Primary (HIGH confidence)
- vote-aggregation.ts — buildConsistentBarData() implementation and API
- SessionReview.tsx — Reference implementation (correct pattern)
- VoteMultipleChoice.tsx — Template lookup pattern from store
- AdminSession.tsx — Current incorrect implementation (2 locations)
- SessionResults.tsx — Current incorrect implementation
- template-store.ts — Template state management
- template-api.ts — fetchTemplates() utility
- v1.2-MILESTONE-AUDIT.md — Tech debt item #1 and #2 descriptions

### Secondary (MEDIUM confidence)
- Phase 13 verification documents — buildConsistentBarData testing and validation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already present in codebase
- Architecture: HIGH — reference implementation exists and proven in production
- Pitfalls: HIGH — derived from audit findings and code inspection

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days — stable infrastructure, no breaking changes expected)
