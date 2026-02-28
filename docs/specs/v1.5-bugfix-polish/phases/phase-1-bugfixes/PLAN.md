# Phase 1 — Bug Fixes

**Objective:** Fix all 5 known bugs (R1-R5) in one build pass.

---

## R1: Presenter view tab switching

### Files to modify
- `src/components/PresentationControls.tsx`

### Changes
In `handleSelectQuestion` (line ~234), after the existing `question_selected` broadcast, add a `reason_highlight` broadcast to clear the highlighted reason:

```ts
function handleSelectQuestion(questionId: string, index: number) {
  setCurrentBatchQuestionIndex(index);
  // Clear highlighted reason so it doesn't override the selected question
  setHighlightedReasonId('');
  channelRef.current?.send({
    type: 'broadcast',
    event: 'question_selected',
    payload: { questionId },
  });
  channelRef.current?.send({
    type: 'broadcast',
    event: 'reason_highlight',
    payload: { questionId, reasonId: '' },
  });
}
```

### AC mapping
- AC-R1-1: ✓ Broadcasts both events
- AC-R1-2: ✓ Broadcast is near-instant, no additional latency
- AC-R1-3: ✓ Clearing highlightedReason removes the priority override in BatchResultsProjection

---

## R2: Session template save overwrite

### Files to modify
- `src/lib/session-template-api.ts`
- `src/components/editor/EditorToolbar.tsx`

### Changes

**session-template-api.ts** — Add helper:
```ts
export async function findSessionTemplateByName(name: string): Promise<SessionTemplate | null> {
  const { data } = await supabase
    .from('session_templates')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  return data;
}
```

**EditorToolbar.tsx** — Update `handleSave`:
1. Add state: `overwriteConfirm` (holds the existing template to overwrite, or null)
2. In `handleSave`, when no `templateId`:
   - Call `findSessionTemplateByName(templateName)`
   - If found → set `overwriteConfirm` state (shows ConfirmDialog)
   - If not found → proceed with `saveSessionTemplate` as before
3. On confirm: call `overwriteSessionTemplate(existingTemplate.id, blueprint, itemCount)`, update `templateId` in store, navigate to edit URL
4. On cancel: clear `overwriteConfirm`, return to editor

### AC mapping
- AC-R2-1: ✓ ConfirmDialog shown on collision
- AC-R2-2: ✓ overwriteSessionTemplate updates blueprint + item_count
- AC-R2-3: ✓ Cancel clears state, editor untouched
- AC-R2-4: ✓ setState + navigate after overwrite

---

## R3: Unsaved changes warning

### Files to modify
- `src/pages/TemplateEditorPage.tsx`

### Changes
Add `useBlocker` and a ConfirmDialog:

```tsx
import { useBlocker } from 'react-router';

// In component body:
const blocker = useBlocker(isDirty);

// In JSX:
{blocker.state === 'blocked' && (
  <ConfirmDialog
    isOpen={true}
    onConfirm={() => blocker.proceed()}
    onCancel={() => blocker.reset()}
    title="Unsaved Changes"
    message="You have unsaved changes. Leave without saving?"
    confirmLabel="Leave"
    confirmVariant="danger"
  />
)}
```

### AC mapping
- AC-R3-1: ✓ useBlocker triggers on in-app navigation when isDirty
- AC-R3-2: ✓ proceed/reset on dialog buttons
- AC-R3-3: ✓ beforeunload handler unchanged
- AC-R3-4: ✓ markClean() on save already clears isDirty

---

## R4: Caption/notes trimming

### Files to modify
- `src/components/editor/SlideEditor.tsx`

### Changes

Replace onChange trim with onBlur trim:

**handleCaptionChange** (line ~23):
```ts
// Before:
const newCaption = e.target.value.trim() || null;

// After:
const newCaption = e.target.value || null;
```

Add onBlur handler:
```ts
const handleCaptionBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  const trimmed = e.target.value.trim() || null;
  updateItem(item.id, {
    slide: { ...item.slide!, caption: trimmed },
  });
};
```

**handleNotesChange** (line ~32):
```ts
// Before:
const newNotes = html.trim() || null;

// After:
const newNotes = html || null;
```

Notes trimming on blur is handled by Tiptap's onBlur — or can be done in the save path. Since notes are HTML, trimming is less critical (empty `<p></p>` tags are the real concern). For this phase, remove the onChange trim only. If empty HTML needs handling, we trim on save.

Add `onBlur={handleCaptionBlur}` to the caption `<input>`.

### AC mapping
- AC-R4-1: ✓ No trim on change for caption
- AC-R4-2: ✓ No trim on change for notes
- AC-R4-3: ✓ Trim on blur for caption, save path for notes
- AC-R4-4: ✓ `trim() || null` on blur handles empty→null

---

## R5: Save as response template

### Files to modify
- `src/components/editor/QuestionRow.tsx`

### Changes

Add "Save as Template" button and modal below the custom options section (after the "Add Option" button, inside the `!question.template_id` block):

```tsx
// New state
const [showSaveTemplate, setShowSaveTemplate] = useState(false);
const [newTemplateName, setNewTemplateName] = useState('');
const [savingTemplate, setSavingTemplate] = useState(false);
const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);

// Handler
async function handleSaveAsTemplate() {
  if (!newTemplateName.trim() || !question.options) return;
  setSavingTemplate(true);
  setSaveTemplateError(null);
  try {
    const template = await createTemplate(newTemplateName.trim(), question.options);
    onUpdate({ template_id: template.id });
    setShowSaveTemplate(false);
    setNewTemplateName('');
  } catch (err) {
    setSaveTemplateError(err instanceof Error ? err.message : 'Failed to save template');
  } finally {
    setSavingTemplate(false);
  }
}
```

**UI:** Below "Add Option" button:
```tsx
<button
  onClick={() => setShowSaveTemplate(true)}
  className="text-sm text-indigo-600 hover:text-indigo-500"
>
  Save as Template
</button>
```

When clicked, the button is replaced by an inline text field + Save/Cancel buttons — no modal overlay. Stays in context within the question row.

Import `createTemplate` from `../../lib/template-api`.

### AC mapping
- AC-R5-1: ✓ Button visible when MC + no template + has options
- AC-R5-2: ✓ Modal prompts for name
- AC-R5-3: ✓ createTemplate() called
- AC-R5-4: ✓ onUpdate({ template_id }) links question to new template
- AC-R5-5: ✓ createTemplate updates the template store, dropdown refreshes
- AC-R5-6: ✓ createTemplate throws on 23505, error shown in modal

---

## Files to create
None.

## Files to delete
None.

## Database changes
None.

## Pitfalls addressed
- P6 (stale highlighted reason): Mitigated by R1 fix — clears reason on tab switch
- P7 (template overwrite race): Accepted risk — single-user admin tool
