# Phase 13: Consistent Rendering - Research

**Researched:** 2026-02-09
**Domain:** React component rendering, color mapping, template-driven UI consistency
**Confidence:** HIGH

## Summary

This phase ensures template-linked questions display identically for participants by implementing three core mechanisms: (1) template-order-driven option display, (2) position-based color mapping, and (3) vote-based display freezing. The technical approach leverages existing patterns (MULTI_CHOICE_COLORS array, question.template_id FK, checkQuestionVotes helper) and applies React's derived data pattern to compute display order at render time.

The standard approach for consistent rendering in React involves computing derived data (display order, color assignments) from authoritative sources (template.options array) using stable, deterministic functions. The key insight: templates already store option order in a JSONB array; the question.template_id FK provides the join; and the existing vote-checking infrastructure enables display freezing.

**Primary recommendation:** Use derived data pattern with useMemo to compute display order from template when template_id present, fall back to question.options order when template_id is null, and enforce freeze by checking for votes before allowing template assignment changes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | Component rendering | Stable hooks API (useMemo, useEffect) for derived data patterns |
| motion | 12.29.2 | Button animations | Already used in VoteMultipleChoice for tap feedback |
| TypeScript | Latest | Type safety | Ensures template.options and question.options type consistency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase | Client v2+ | Data fetching | Join template data via foreign key queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useMemo | Direct computation | useMemo prevents unnecessary recalculation on every render |
| FK join query | Separate template fetch | Join query fetches template data in single request (fewer round trips) |

**Installation:**
No new packages required. All dependencies already in package.json.

## Architecture Patterns

### Recommended Data Flow
```
Database (template.options)
  → Question (template_id FK)
    → VoteMultipleChoice (derive display order)
      → Render buttons with position-based colors
```

### Pattern 1: Derived Display Order
**What:** Compute display order at render time from authoritative source (template or question options)
**When to use:** Any time question.template_id is present

**Example:**
```typescript
// Source: Derived from React best practices (useMemo for derived data)
// https://react.dev/reference/react/useMemo

function VoteMultipleChoice({ question, /* ... */ }) {
  // Fetch template if template_id present
  const template = useTemplateStore(state =>
    state.templates.find(t => t.id === question.template_id)
  );

  // Derive display order: template takes precedence over question.options
  const displayOptions = useMemo(() => {
    if (question.template_id && template) {
      return template.options; // Template order is source of truth
    }
    return question.options ?? []; // Fall back to question order
  }, [question.template_id, question.options, template?.options]);

  // Map to buttons with position-based color
  return displayOptions.map((option, index) => {
    const color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    // ... render button
  });
}
```

### Pattern 2: Position-Based Color Mapping
**What:** Assign colors deterministically based on array index (not text content)
**When to use:** All multiple choice rendering (template and non-template)

**Example:**
```typescript
// Source: Current implementation in VoteMultipleChoice.tsx line 155
// Enhanced with template-aware display order

const displayOptions = /* ... derived as above ... */;

{displayOptions.map((option, index) => {
  // Position determines color: index 0 → color 0, index 1 → color 1, etc.
  const optionColor = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];

  return (
    <motion.button
      key={option}
      style={{ backgroundColor: isSelected ? optionColor : UNSELECTED }}
    >
      {option}
    </motion.button>
  );
})}
```

**Key insight:** Using modulo (%) ensures palette wraps for >8 options without errors.

### Pattern 3: Vote-Based Display Freeze
**What:** Once a question receives votes, lock its template assignment to prevent display order changes
**When to use:** Question edit flow, template assignment changes

**Example:**
```typescript
// Source: Existing pattern in QuestionForm.tsx lines 53, 82-86
// Pattern: Check votes before allowing template changes

useEffect(() => {
  if (editingQuestion) {
    checkQuestionVotes(editingQuestion.id).then(setHasVotes);
  }
}, [editingQuestion]);

function handleTemplateChange(newTemplateId: string | null) {
  if (editingQuestion && hasVotes) {
    setErrorMsg('Cannot change template: question has received votes');
    return; // Block change
  }
  setTemplateId(newTemplateId); // Allow change if no votes
}
```

### Pattern 4: Supabase FK Join Query
**What:** Fetch template data alongside question in single query using FK join
**When to use:** Loading questions for participant view

**Example:**
```typescript
// Source: Supabase join pattern
// https://supabase.com/docs/guides/database/joins-and-nesting

const { data: questions } = await supabase
  .from('questions')
  .select('*, response_templates(*)')  // Join via template_id FK
  .eq('session_id', sessionId);

// Result: questions include nested template object
// question.response_templates.options available directly
```

**Optimization:** Single query fetches both question and template data (reduces round trips).

### Anti-Patterns to Avoid
- **Storing display order separately:** Don't duplicate template.options into question metadata. Template.options is single source of truth.
- **Color-by-text-content:** Don't map colors based on option text ("Agree" → blue). Position-based mapping ensures consistency.
- **Ignoring vote freeze:** Don't allow template changes after votes exist. Display order changes invalidate existing vote data.
- **Re-fetching templates per question:** Use Zustand store (useTemplateStore) to cache templates globally, avoiding repeated fetches.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template data caching | Custom fetch wrapper | useTemplateStore (Zustand) | Already exists, handles real-time updates |
| Vote existence check | Manual count query | checkQuestionVotes(questionId) | Already exists in template-api.ts line 144 |
| Display order computation | Inline ternary in JSX | useMemo hook | Prevents recalculation on every render |
| Color array wrapping | Manual bounds checking | Modulo operator (index % length) | Standard pattern, already used throughout codebase |

**Key insight:** The infrastructure for consistent rendering already exists. This phase is about *connecting* existing pieces (template.options, MULTI_CHOICE_COLORS, checkQuestionVotes), not building new systems.

## Common Pitfalls

### Pitfall 1: Template Not Loaded When Rendering
**What goes wrong:** VoteMultipleChoice renders before template data fetched, falls back to question.options incorrectly
**Why it happens:** Async data fetching + React lifecycle timing
**How to avoid:**
- Ensure templates loaded in parent component (AdminSession, ParticipantSession) before rendering vote components
- Use loading state: if template_id present but template not found, show loading spinner
- Alternative: Prefetch templates on session load using fetchTemplates() in useEffect
**Warning signs:** Flickering/re-render as template loads, initial display order doesn't match template order

### Pitfall 2: Color Assignment After Array Filtering
**What goes wrong:** If you filter displayOptions (e.g., removing empty strings), original index lost, colors shift
**Why it happens:** Array.filter() returns new array with reindexed elements
**How to avoid:** Assign colors BEFORE any filtering, or ensure template.options never contains empty/invalid entries (enforced by CHECK constraint in migration)
**Warning signs:** Same question displays different colors on different renders, color order changes when option count changes

### Pitfall 3: Vote Freeze Not Enforced Client-Side
**What goes wrong:** Admin changes template after votes submitted, participant view changes, vote data becomes inconsistent
**Why it happens:** Forgetting to call checkQuestionVotes before allowing template changes
**How to avoid:**
- Use existing hasVotes state pattern from QuestionForm.tsx
- Disable template selector when hasVotes === true
- Show user-friendly error message explaining why change blocked
**Warning signs:** Votes for "Strongly Agree" show up under "Option 1" after template change

### Pitfall 4: Key Instability in Button Rendering
**What goes wrong:** React re-mounts buttons on re-render instead of updating them, animations break
**Why it happens:** Using array index as key instead of stable identifier (option text)
**How to avoid:** Use option text as key: `key={option}` (already correct in VoteMultipleChoice.tsx line 159)
**Warning signs:** Button animations restart on re-render, selection state lost unexpectedly

### Pitfall 5: Template Deletion Edge Case
**What goes wrong:** Question has template_id but template deleted (ON DELETE SET NULL), display order undefined
**Why it happens:** Template deleted by another admin after question created
**How to avoid:**
- Check if template exists: `if (question.template_id && template)`
- Fall back to question.options if template not found
- Already handled by derived order pattern (Pattern 1 above)
**Warning signs:** Questions with template_id showing blank/no options

## Code Examples

Verified patterns from official sources:

### Complete VoteMultipleChoice Refactor (Conceptual)
```typescript
// Source: Derived from existing VoteMultipleChoice.tsx + research patterns
// Location: src/components/VoteMultipleChoice.tsx

import { useMemo } from 'react';
import { MULTI_CHOICE_COLORS } from './BarChart';
import { useTemplateStore } from '../stores/template-store';

export default function VoteMultipleChoice({ question, /* ... */ }) {
  // Fetch template from store if template_id present
  const template = useTemplateStore(state =>
    question.template_id
      ? state.templates.find(t => t.id === question.template_id)
      : null
  );

  // Derive display order (Pattern 1)
  const displayOptions = useMemo(() => {
    // Template takes precedence if present
    if (question.template_id && template?.options) {
      return template.options;
    }
    // Fall back to question's own options
    return question.options ?? [];
  }, [question.template_id, question.options, template?.options]);

  const isCompact = displayOptions.length > 4;

  return (
    <div className="flex flex-col gap-3 px-4">
      {displayOptions.map((option, index) => {
        const isSelected = pendingSelection === option;
        // Position-based color (Pattern 2)
        const optionColor = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];

        return (
          <motion.button
            key={option} // Stable key (not index)
            onClick={() => handleSelect(option)}
            animate={{ backgroundColor: isSelected ? optionColor : UNSELECTED }}
            className={isCompact ? 'px-4 py-3' : 'px-5 py-5'}
          >
            {option}
          </motion.button>
        );
      })}
    </div>
  );
}
```

### Admin Results View Color Mapping
```typescript
// Source: Current implementation in AdminSession.tsx lines 1303-1319
// Already correct: maps by position (aggregated array index)

const aggregated = aggregateVotes(votes);
const barData = aggregated.map((vc, index) => {
  let color: string;
  if (q.type === 'agree_disagree') {
    const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
    color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
  } else {
    // Multiple choice: position-based color
    color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
  }
  return { label: vc.value, count: vc.count, percentage: vc.percentage, color };
});
```

**Note:** Admin view already uses position-based colors. No changes needed for admin results rendering.

### Vote Freeze Enforcement
```typescript
// Source: Existing pattern in QuestionForm.tsx
// Extend to template assignment scenarios

const [hasVotes, setHasVotes] = useState(false);

useEffect(() => {
  if (editingQuestion) {
    checkQuestionVotes(editingQuestion.id).then(setHasVotes);
  }
}, [editingQuestion]);

// Disable template changes if votes exist
<TemplateSelector
  value={templateId}
  onChange={handleTemplateChange}
  disabled={hasVotes && !!editingQuestion}
  disabledReason="Template locked: question has received votes"
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| question.options array only | template_id FK → template.options | Phase 11-12 (2025) | Template options now authoritative source for display order |
| Color by option text | Color by array position | Current (existing) | Ensures consistent color mapping across questions |
| Manual vote counting | checkQuestionVotes helper | Phase 12 (2025) | Centralized vote-checking logic |
| Prop drilling for templates | Zustand useTemplateStore | Phase 11 (2025) | Global template cache, no prop drilling |

**Deprecated/outdated:**
- Directly reading question.options for template-linked questions: Must check template_id and use template.options instead
- Ignoring vote freeze in template assignment: checkQuestionVotes required before allowing changes

## Open Questions

Things that couldn't be fully resolved:

1. **Should template fetch use FK join or store lookup?**
   - What we know: Supabase supports FK joins, useTemplateStore already loaded globally
   - What's unclear: Performance tradeoff between join query vs store lookup for 100+ questions
   - Recommendation: Start with store lookup (simpler, already implemented), optimize to FK join if performance issues observed

2. **Should we prevent template deletion if linked questions exist?**
   - What we know: ON DELETE SET NULL preserves question.options (graceful degradation)
   - What's unclear: Whether admins should be warned/blocked from deleting used templates
   - Recommendation: Allow deletion (current behavior), add warning in template UI showing usage count (getTemplateUsageCount already exists)

3. **Should batch voting and live voting use identical color derivation?**
   - What we know: Both use VoteMultipleChoice component, same MULTI_CHOICE_COLORS array
   - What's unclear: Whether any edge cases differ between modes
   - Recommendation: Verify in testing that both modes render identically (should work automatically since same component/data)

4. **What if question.options array order differs from template.options?**
   - What we know: QuestionForm locks options when template assigned, prevents manual editing
   - What's unclear: What if options were manually reordered before template assignment, or database inconsistency occurs?
   - Recommendation: Template.options takes precedence when template_id present (ignore question.options order entirely)

## Sources

### Primary (HIGH confidence)
- React official docs: useMemo for derived data - https://react.dev/reference/react/useMemo
- Existing codebase: VoteMultipleChoice.tsx (color mapping pattern, line 155)
- Existing codebase: QuestionForm.tsx (vote freeze pattern, lines 53, 82-86)
- Existing codebase: template-api.ts (checkQuestionVotes helper, line 144)
- Supabase docs: Join queries - https://supabase.com/docs/guides/database/joins-and-nesting
- Array.prototype.sort stability - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort (stable since ES2019)

### Secondary (MEDIUM confidence)
- [React key attribute best practices](https://www.developerway.com/posts/react-key-attribute) - Key stability for list rendering
- [React rendering lists](https://react.dev/learn/rendering-lists) - Official guidance on array rendering
- [Color in Design Systems](https://medium.com/eightshapes-llc/color-in-design-systems-a1c80f65fa3) - Position-based palette patterns
- [WCAG Contrast Requirements](https://webaim.org/articles/contrast/) - Button color contrast (4.5:1 for text, 3:1 for UI components)
- [Indexed Color](https://en.wikipedia.org/wiki/Indexed_color) - Array-based color lookup pattern

### Tertiary (LOW confidence)
- WebSearch results on React patterns (general guidance, not specific to this codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions confirmed via package.json
- Architecture: HIGH - Patterns verified in existing codebase (VoteMultipleChoice.tsx, QuestionForm.tsx, template-api.ts)
- Pitfalls: HIGH - Derived from actual codebase structure and known React rendering issues

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable domain, React patterns don't change rapidly)
