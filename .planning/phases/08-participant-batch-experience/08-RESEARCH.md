# Phase 8: Participant Batch Experience - Research

**Researched:** 2026-01-28
**Domain:** Multi-step form navigation patterns, keyboard event handling, Motion v12 animations, React state management for sequential navigation
**Confidence:** HIGH

## Summary

Phase 8 implements the participant-facing batch voting experience, enabling self-paced navigation through multiple questions with immediate vote persistence and completion tracking. This research investigated three primary domains: (1) multi-step form navigation patterns in React with state management for current position tracking, (2) keyboard event handling for desktop arrow key navigation with proper cleanup, and (3) Motion v12 animation capabilities for completion feedback and transitions.

The standard approach uses React local state (`currentIndex`) to track position within the batch's question array, with Next/Previous buttons that increment/decrement the index. Votes submit immediately on answer (matching live mode behavior), using the existing VoteAgreeDisagree/VoteMultipleChoice components with minor modifications. Keyboard navigation uses a global `keydown` listener attached in a useEffect with proper cleanup. Completion animation uses Motion's `useAnimate` hook (already in use for agree/disagree pulse) with `scale: [1, 1.05, 1]` for a quick "check" effect.

User decisions from CONTEXT.md lock critical choices: buttons-only navigation (no swipe), linear navigation (no jumping), no review screen (submit on last question), and partial submission allowed. This simplifies implementation—batch mode becomes a sequential carousel through questions with a submit button replacing Next on the final question.

**Primary recommendation:** Use local state `currentQuestionIndex` to track position, render `questions[currentQuestionIndex]` with existing vote components, add `useEffect` for keyboard listener with cleanup, trigger `useAnimate` scale pulse on vote submission, and replace Next with Submit button when `currentQuestionIndex === questions.length - 1`.

## Standard Stack

No new dependencies required. Built entirely with existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | Local state for navigation index, useEffect for keyboard | Already used; useState/useEffect are standard patterns for sequential navigation |
| Motion | ^12.29.2 | Completion animations (scale pulse), question transitions | Already installed; useAnimate hook provides imperative animations for completion feedback |
| Zustand | ^5.0.5 | Session state for active batch, question array | Already used; stores batch questions fetched from batch_activated broadcast |
| @supabase/supabase-js | ^2.93.1 | Vote submission, question fetching | Already used; same vote upsert pattern as live mode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local state index | Zustand store for currentIndex | Local state is sufficient; index resets on unmount which is desired behavior |
| Keyboard event listener | React Router keyboard navigation | This isn't routing, it's component-level navigation; listener is simpler |
| Submit button replacement | Separate review screen | CONTEXT.md explicitly rejected review screen; submit on last question is decided |
| AnimatePresence exit | Instant question swap | Motion's exit animations are already used for question transitions; keep consistency |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
src/
  pages/
    ParticipantSession.tsx     # MODIFY: Add batch_activated listener, batch view mode
  components/
    BatchVotingCarousel.tsx    # NEW: Sequential navigation through batch questions
    VoteAgreeDisagree.tsx      # MODIFY: Add onVoteSubmit callback for completion animation
    VoteMultipleChoice.tsx     # MODIFY: Add onVoteSubmit callback for completion animation
```

### Pattern 1: Sequential Index Navigation (Multi-Step Form Pattern)

**What:** Track current position with local state `currentQuestionIndex`, render `questions[currentQuestionIndex]`, use Next/Prev buttons to increment/decrement. Submit replaces Next on final question.

**When to use:** This is the decided architecture from CONTEXT.md. Linear navigation only, no jumping between questions.

**Example:**
```typescript
// Source: Multi-step form patterns (Build with Matija, 2026)
// Adapted for batch question navigation

function BatchVotingCarousel({ questions, sessionId, participantId }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Mark batch as completed
    await supabase
      .from('batches')
      .update({ status: 'closed' })
      .eq('id', batchId);

    // Transition to waiting view
    setView('waiting');
  };

  return (
    <div className="h-dvh flex flex-col">
      {/* Progress indicator */}
      <div className="px-4 py-3 text-center">
        <p className="text-gray-400 text-sm">
          Question {currentIndex + 1} of {questions.length}
        </p>
      </div>

      {/* Current question with AnimatePresence for transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {currentQuestion.type === 'agree_disagree' ? (
            <VoteAgreeDisagree question={currentQuestion} {...props} />
          ) : (
            <VoteMultipleChoice question={currentQuestion} {...props} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation footer */}
      <div className="px-4 py-4 flex gap-3">
        <button
          onClick={handlePrevious}
          disabled={isFirstQuestion}
          className="px-6 py-3 rounded-xl font-semibold bg-gray-800 text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {isLastQuestion ? (
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Submit Batch
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
```

**Why this pattern:**
- Matches multi-step form navigation patterns (industry standard)
- Local state resets on unmount (batch ends) which is desired behavior
- Conditional rendering of Submit/Next button is clear and explicit
- Works with existing AnimatePresence transitions from live mode

### Pattern 2: Keyboard Navigation with Proper Cleanup

**What:** Attach a `keydown` event listener to window in useEffect, handle ArrowLeft/ArrowRight, and clean up on unmount to prevent memory leaks.

**When to use:** For desktop keyboard navigation. CONTEXT.md marks this as "Claude's discretion" so implementation details are flexible.

**Example:**
```typescript
// Source: React keyboard navigation best practices (freeCodeCamp, whereisthemouse.com)
// Pattern: WAI-ARIA standard—tab to widget, arrows to navigate within

function BatchVotingCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Only handle if not typing in input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup to prevent memory leaks
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [questions.length]); // Re-attach if question count changes

  // ... rest of component
}
```

**Why this pattern:**
- WAI-ARIA standard: arrow keys navigate within widget (questions are the widget)
- Cleanup function prevents memory leaks (critical for SPA navigation)
- Check for input/textarea focus prevents conflicting with reason text entry
- Math.min/max bounds prevent out-of-range errors
- Works on desktop only (mobile has no arrow keys, which is fine)

### Pattern 3: Completion Animation with Motion useAnimate

**What:** Use Motion's `useAnimate` hook to trigger a quick scale pulse (`scale: [1, 1.05, 1]`) when a vote is submitted, providing tactile feedback.

**When to use:** CONTEXT.md specifies "subtle animation (quick check/pulse) when answering each question." This matches the existing agree/disagree pulse pattern.

**Example:**
```typescript
// Source: Existing VoteAgreeDisagree.tsx lines 110-121 (pulse on selection)
// Adapted for completion feedback on vote submit

function VoteMultipleChoice({ question, onVoteSubmit }: Props) {
  const [buttonRef, animateButton] = useAnimate();
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  const submitVote = useCallback(async () => {
    if (!pendingSelection) return;
    setSubmitting(true);
    haptic.tap();

    try {
      const { data, error } = await supabase
        .from('votes')
        .upsert(/* ... */);

      if (data && buttonRef.current) {
        // Completion animation: quick pulse
        animateButton(
          buttonRef.current,
          { scale: [1, 1.05, 1] },
          { duration: 0.3, ease: 'easeOut' }
        );

        // Notify parent (carousel) that vote submitted
        onVoteSubmit?.();
      }
    } finally {
      setSubmitting(false);
    }
  }, [pendingSelection, animateButton, onVoteSubmit]);

  return (
    <div className="flex flex-col h-full">
      {/* ... question text ... */}

      {/* Option buttons */}
      {options.map((option) => (
        <motion.button
          ref={pendingSelection === option ? buttonRef : null}
          key={option}
          onClick={() => setPendingSelection(option)}
          animate={{
            backgroundColor: pendingSelection === option ? optionColor : UNSELECTED,
          }}
          whileTap={{ scale: 0.97 }}
          // ... rest of button
        />
      ))}

      {/* Submit button */}
      <button onClick={submitVote} disabled={!pendingSelection}>
        Submit Vote
      </button>
    </div>
  );
}
```

**Why this pattern:**
- Consistent with existing agree/disagree pulse animation (lines 112-118 of VoteAgreeDisagree.tsx)
- `scale: [1, 1.05, 1]` is a subtle "check" pulse—not intrusive
- `useAnimate` provides imperative control (trigger on vote submit, not on selection change)
- `onVoteSubmit` callback lets carousel respond if needed (e.g., auto-advance on timer)

### Pattern 4: Batch Activation Listener (Mirrors Live Question Pattern)

**What:** Add `batch_activated` broadcast listener to ParticipantSession setupChannel callback. Fetch questions by batch_id, transition to batch voting view.

**When to use:** This is the established pattern from Phase 7 (Batch Activation). Participants receive broadcast, fetch questions, enter batch mode.

**Example:**
```typescript
// Source: Phase 7 RESEARCH.md (batch_activated broadcast pattern)
// Existing live question pattern: AdminSession.tsx lines 294-332

const setupChannel = useCallback((channel: RealtimeChannel) => {
  // ... existing listeners (question_activated, voting_closed, etc.) ...

  // NEW: batch_activated listener
  channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }) => {
    const { batchId, questionIds } = payload as { batchId: string; questionIds: string[] };

    // Fetch all batch questions
    const { data: batchQuestions } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds)
      .order('position');

    if (batchQuestions && batchQuestions.length > 0) {
      setBatchQuestions(batchQuestions);
      setActiveBatchId(batchId);
      setView('batch-voting');
    }
  });

  // NEW: batch_closed listener
  channel.on('broadcast', { event: 'batch_closed' }, () => {
    setBatchQuestions([]);
    setActiveBatchId(null);
    setView('waiting');
    setWaitingMessage('Batch completed');
  });
}, []);
```

**Why this pattern:**
- Consistent with existing broadcast listeners (question_activated, voting_closed)
- Fetches questions by ID array (prevents full question data in broadcast payload)
- Order by position ensures correct sequence in carousel
- Transitions to new 'batch-voting' view (separate from 'voting' for live mode)

### Anti-Patterns to Avoid

- **Storing currentIndex in Zustand**: Index should be local state. Batch ends, index resets—no need for persistence.
- **Auto-advancing on vote submit**: CONTEXT.md doesn't specify this. Keep navigation explicit (user clicks Next).
- **Polling for vote state**: Votes already use upsert with `locked_in: false`. No polling needed; fetch on mount if needed.
- **Custom swipe gestures**: CONTEXT.md explicitly rejected swipe. Buttons only.
- **Review screen before submit**: CONTEXT.md explicitly rejected. Submit replaces Next on last question.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress indicator "3 of 10" | Custom state logic | Simple math: `currentIndex + 1` and `questions.length` | No library needed; one line of code |
| Keyboard navigation | Custom event delegation | Standard window.addEventListener with cleanup | React docs recommend this; no library needed |
| Completion animation | Custom CSS animation | Motion's `useAnimate` hook | Already installed; imperative control is cleaner |
| Vote persistence | Custom debouncing/queuing | Supabase upsert with `locked_in: false` | Already implemented in live mode; reuse pattern |
| Disabled button styling | Custom opacity/cursor CSS | Tailwind `disabled:` variants | Already used throughout app |

**Key insight:** Batch mode navigation is a standard multi-step form problem. The web has solved this pattern extensively—use local state for position, Math.min/max for bounds, and conditional rendering for the last step. Don't reinvent sequential navigation.

## Common Pitfalls

### Pitfall 1: Stale Closure in Keyboard Event Listener

**What goes wrong:** The keyboard event handler captures `questions` array and `currentIndex` state at the time of listener attachment. When questions change (e.g., batch switches) or index updates, the listener still references old values, causing out-of-bounds errors or navigation to wrong questions.

**Why it happens:** Event listeners are closures. They capture variables from their scope at creation time. If those variables change, the listener doesn't see the updates unless it's removed and re-attached.

**How to avoid:** Include dependencies in useEffect array OR use functional state updates with refs for bounds checking.

```typescript
// WRONG: Stale closure
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      setCurrentIndex(currentIndex + 1); // Stale currentIndex!
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []); // Empty deps = listener never updates

// RIGHT: Functional updates with bounds
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [questions.length]); // Re-attach when question count changes
```

**Warning signs:** Arrow keys don't work after navigating manually, or keyboard navigation crashes with out-of-bounds errors.

### Pitfall 2: Missing Keyboard Listener Cleanup

**What goes wrong:** Keyboard event listener is attached when batch voting starts but not removed when batch ends. User navigates away from batch view (e.g., admin closes batch, participant goes to results), but listener is still active. Arrow key presses now trigger errors because `currentIndex` state no longer exists or questions array is empty.

**Why it happens:** Forgetting to return cleanup function from useEffect. React doesn't automatically remove event listeners—only effects with cleanup functions get properly torn down.

**How to avoid:** ALWAYS return cleanup function that removes the listener. Test by navigating away from batch view and pressing arrow keys—should be no console errors.

```typescript
// WRONG: No cleanup
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  // Missing cleanup!
}, []);

// RIGHT: Cleanup on unmount
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, []);
```

**Warning signs:** Console errors when pressing arrow keys after leaving batch view. "Cannot read property of undefined" errors related to currentIndex or questions.

### Pitfall 3: Keyboard Navigation Conflicts with Reason Input

**What goes wrong:** Participant is typing an optional reason in the textarea. They press arrow keys to move cursor left/right within text. Instead, the question changes, losing their half-written reason and disorienting the user.

**Why it happens:** Keyboard event listener is global (window level). It doesn't distinguish between "arrow key for navigation" and "arrow key for text editing."

**How to avoid:** Check if focus is on an input/textarea before handling arrow keys. If focus is in a text field, ignore the event.

```typescript
// WRONG: Global handler without context check
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') {
    setCurrentIndex(prev => prev + 1);
  }
}

// RIGHT: Ignore if typing in input/textarea
function handleKeyDown(event: KeyboardEvent) {
  // Don't navigate if user is typing
  if (event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement) {
    return;
  }

  if (event.key === 'ArrowRight') {
    setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
  }
}
```

**Warning signs:** User reports "questions change when I'm typing my reason." Lost text in reason field when navigating.

### Pitfall 4: No Visual Feedback for Disabled Previous Button

**What goes wrong:** On the first question, the Previous button is disabled (`disabled={isFirstQuestion}`). However, if only opacity is reduced, users may not realize it's disabled—they click repeatedly, expecting it to work, leading to frustration.

**Why it happens:** Tailwind's `disabled:opacity-50` is subtle. On dark backgrounds, the opacity change may not be obvious. Users need stronger visual cues for disabled state.

**How to avoid:** Combine opacity with cursor-not-allowed and consider adding a tooltip or aria-label explaining why the button is disabled.

```typescript
// WEAK: Only opacity change
<button
  disabled={isFirstQuestion}
  className="disabled:opacity-50"
>
  Previous
</button>

// BETTER: Opacity + cursor + reduced opacity to near-invisible
<button
  disabled={isFirstQuestion}
  className="bg-gray-800 text-white disabled:opacity-30 disabled:cursor-not-allowed"
  aria-label={isFirstQuestion ? "No previous question" : "Go to previous question"}
>
  Previous
</button>
```

**Warning signs:** Users click Previous button on first question multiple times. Accessibility audits flag lack of disabled state clarity.

### Pitfall 5: Losing Vote State on Question Navigation

**What goes wrong:** Participant answers Question 1, clicks Next to Question 2, then clicks Previous back to Question 1. Their answer is gone—they have to re-select and re-submit.

**Why it happens:** Vote components (VoteAgreeDisagree, VoteMultipleChoice) fetch existing votes on mount via useEffect. If the vote was submitted but the component unmounts/remounts during navigation, the fetch should restore state. However, if the fetch fails or isn't triggered, state is lost.

**How to avoid:** Ensure vote components ALWAYS fetch existing vote on mount. The existing code already does this (VoteMultipleChoice lines 32-61). Verify network requests are made when navigating back to answered questions.

```typescript
// Existing pattern in VoteMultipleChoice.tsx (lines 32-61)
useEffect(() => {
  let cancelled = false;

  async function fetchExistingVote() {
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('question_id', question.id)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (!cancelled && data) {
      setCurrentVote(data);
      setPendingSelection(data.value);
      setReason(data.reason ?? '');
      setSubmitted(true);
    }
  }

  // Reset state, then fetch
  setCurrentVote(null);
  setPendingSelection(null);
  setSubmitted(false);
  setReason('');
  fetchExistingVote();

  return () => { cancelled = true; };
}, [question.id, participantId, setCurrentVote]);
```

**Warning signs:** User reports "my answers disappear when I go back." Network tab shows missing SELECT requests when navigating to previous questions.

### Pitfall 6: Batch Completion Without Confirmation

**What goes wrong:** Participant is on the last question, answers it, clicks Submit (thinking it's submitting the current vote like before). Batch immediately completes and they're transitioned to waiting screen. They didn't realize Submit meant "finish entire batch" and may have wanted to review earlier answers.

**Why it happens:** CONTEXT.md explicitly rejected confirmation dialogs ("instant completion — no confirmation dialog"). However, if the Submit button looks identical to the previous "Submit Vote" buttons, users may not realize it's batch-final.

**How to avoid:** Make Submit button visually distinct. Use different text ("Submit Batch" or "Complete Batch"), different color, or larger size to signal finality. Per CONTEXT.md, no confirmation dialog—but visual distinction is critical.

```typescript
// WEAK: Submit looks like previous vote submit buttons
<button onClick={handleSubmit} className="bg-indigo-600">
  Submit
</button>

// BETTER: Distinct styling and text
<button
  onClick={handleSubmit}
  className="flex-1 px-6 py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 text-white"
>
  Complete Batch
</button>
```

**Warning signs:** User feedback "I didn't realize I was done" or "I wanted to go back but couldn't." Support requests asking how to re-enter batch.

### Pitfall 7: Empty Batch Handling

**What goes wrong:** Admin activates a batch with zero questions (edge case—possible if questions were deleted after batch creation). Participant receives `batch_activated` broadcast with empty `questionIds` array. Batch carousel renders with `questions.length === 0`, causing division by zero in progress indicator or immediate crash.

**Why it happens:** No validation that batch has questions before rendering carousel. Edge case not considered in happy path.

**How to avoid:** Validate `questions.length > 0` before rendering carousel. If zero, show error message and don't transition to batch view.

```typescript
// In batch_activated listener
channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }) => {
  const { batchId, questionIds } = payload;

  if (!questionIds || questionIds.length === 0) {
    console.warn('Batch activated with no questions');
    setErrorMessage('This batch has no questions.');
    return; // Don't transition to batch view
  }

  const { data: batchQuestions } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (!batchQuestions || batchQuestions.length === 0) {
    setErrorMessage('Unable to load batch questions.');
    return;
  }

  setBatchQuestions(batchQuestions);
  setView('batch-voting');
});
```

**Warning signs:** Console errors "Cannot read length of undefined" or "Division by zero." Crash on batch activation with empty question set.

## Code Examples

Verified patterns from official sources and existing codebase:

### Progress Indicator (Text Counter)

```typescript
// Source: Material UI Stepper patterns, multi-step form conventions
// Simple text counter—no library needed

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-gray-400 text-sm font-medium">
        Question {current} of {total}
      </p>
    </div>
  );
}

// Usage in carousel
<ProgressIndicator current={currentIndex + 1} total={questions.length} />
```

### Disabled Button Styling (Tailwind)

```typescript
// Source: Existing AdminControlBar.tsx patterns, Tailwind disabled variants
// First question: Previous disabled. Last question: Next replaced with Submit.

<div className="flex gap-3 px-4 py-4">
  <button
    onClick={handlePrevious}
    disabled={isFirstQuestion}
    className="px-6 py-3 rounded-xl font-semibold bg-gray-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
    aria-label={isFirstQuestion ? "No previous question" : "Go to previous question"}
  >
    Previous
  </button>

  {isLastQuestion ? (
    <button
      onClick={handleSubmitBatch}
      className="flex-1 px-6 py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
    >
      Complete Batch
    </button>
  ) : (
    <button
      onClick={handleNext}
      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
    >
      Next
    </button>
  )}
</div>
```

### Vote Submission with Completion Callback

```typescript
// Source: Existing VoteAgreeDisagree.tsx lines 110-121 (pulse animation)
// Add onVoteSubmit callback prop for carousel to respond

interface VoteProps {
  question: Question;
  sessionId: string;
  participantId: string;
  displayName: string | null;
  reasonsEnabled?: boolean;
  onVoteSubmit?: () => void; // NEW: Callback for completion feedback
}

export default function VoteMultipleChoice({ onVoteSubmit, ...props }: VoteProps) {
  const [buttonRef, animateButton] = useAnimate();

  const submitVote = useCallback(async () => {
    // ... existing vote submission logic ...

    if (data && buttonRef.current) {
      // Completion animation
      animateButton(
        buttonRef.current,
        { scale: [1, 1.05, 1] },
        { duration: 0.3, ease: 'easeOut' }
      );

      // Notify parent
      onVoteSubmit?.();
    }
  }, [/* deps */, onVoteSubmit]);

  // ... rest of component
}
```

### Batch Completion with Waiting Screen Transition

```typescript
// Source: Existing ParticipantSession.tsx waiting view pattern (lines 407-420)
// Reuse waiting screen for post-batch-completion

async function handleSubmitBatch(batchId: string) {
  try {
    // Mark batch as closed (participant-side completion)
    // Note: Admin may still have batch active for other participants
    // This just marks THIS participant as done

    // Transition to waiting screen (matches live mode)
    setView('waiting');
    setWaitingMessage('Batch submitted! Waiting for results...');

    // Optionally: Insert completion record for admin progress tracking (Phase 9)
    // await supabase.from('batch_completions').insert({ batch_id, participant_id });

  } catch (error) {
    console.error('Batch submission error:', error);
    // Don't block user—they've already voted, completion is cosmetic
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Swipe gestures for navigation | Button-only navigation | CONTEXT.md (2026-01-28) | Simpler implementation, better accessibility, no gesture library needed |
| Review screen before submit | Submit button on last question | CONTEXT.md (2026-01-28) | One less screen, faster completion, matches user decision |
| Vote lock-in (can't change) | Immediate submit, can change anytime | Phase 4 (live mode) | Same pattern for batch—votes are editable until final submit |
| Framer Motion | Motion v12 | 2024 | No breaking changes, same API, better performance |

**Deprecated/outdated:**
- Motion (old name: Framer Motion): Package renamed to `motion`, import from `"motion/react"` not `"framer-motion"`
- Custom CSS transitions for vote buttons: Replaced with Motion's `animate` prop for smoother, hardware-accelerated animations
- `whilePress` gesture prop: Correct prop is `whileTap` (verified in existing codebase)

## Open Questions

Things that couldn't be fully resolved:

1. **Network error recovery during batch voting**
   - What we know: Existing live mode has reconnection logic (lines 323-333 of ParticipantSession.tsx) that calls `refetchState()` on reconnection
   - What's unclear: Should batch mode refetch current position and answered questions on reconnect? Or just resume from last local state?
   - Recommendation: Fetch answered questions on reconnect (same pattern as live mode vote fetch). Local `currentIndex` can stay—it's just a UI position. Mark as CONTEXT.md "Claude's discretion" decision.

2. **Auto-advance on vote submit vs. manual Next click**
   - What we know: CONTEXT.md doesn't specify auto-advance behavior
   - What's unclear: Should carousel auto-advance to next question after vote submit? Or require explicit Next click?
   - Recommendation: No auto-advance (keep manual Next). Matches user expectation of "self-paced"—they control when to move forward. If user wants to re-read question after voting, auto-advance would be disruptive.

3. **Completion animation timing vs. navigation timing**
   - What we know: Motion's scale animation takes 0.3s (VoteAgreeDisagree line 113)
   - What's unclear: If user clicks Next immediately after voting, should carousel wait for animation to complete? Or interrupt animation and navigate?
   - Recommendation: Don't block navigation on animation. Let animation complete naturally if user waits, but allow immediate navigation if they click Next. Animation is feedback, not a gate.

## Sources

### Primary (HIGH confidence)
- Existing codebase: ParticipantSession.tsx (live mode patterns), VoteAgreeDisagree.tsx (Motion useAnimate), VoteMultipleChoice.tsx (vote submission)
- package.json: Motion v12.29.2, React 19.0.0, Zustand 5.0.5 (verified installed)
- CONTEXT.md: User decisions (buttons-only, linear navigation, no review screen, partial submission)
- Phase 7 RESEARCH.md: Batch activation broadcast pattern

### Secondary (MEDIUM confidence)
- [Build with Matija: React Hook Form Multi-Step Tutorial](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps) - Multi-step form patterns with Zustand
- [freeCodeCamp: Keyboard Accessibility for Complex React](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/) - WAI-ARIA keyboard navigation standards
- [whereisthemouse.com: List component with keyboard navigation](https://whereisthemouse.com/create-a-list-component-with-keyboard-navigation-in-react) - Arrow key handling patterns
- [DhiWise: React useEffect AddEventListener cleanup](https://www.dhiwise.com/blog/design-converter/mastering-react-useeffect-addeventlistener-for-clean-code) - Event listener cleanup best practices
- [Paul Gaumer: Handle animation state with Framer Motion](https://paulgaumer.com/blog/handle-animation-state-with-framer-motion/) - onAnimationComplete callback usage
- [Material UI React Stepper](https://mui.com/material-ui/react-stepper/) - Progress indicator patterns for multi-step flows

### Tertiary (LOW confidence)
- [Motion.dev official site](https://motion.dev/) - Could not fetch actual documentation content (CSS/layout only returned)
- WebSearch results for Motion v12 gestures - Confirmed whileTap, animate, useAnimate exist but not from primary source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture (sequential navigation): HIGH - Standard multi-step form pattern, verified in existing codebase (ParticipantSession transitions)
- Architecture (keyboard handling): HIGH - WAI-ARIA standard pattern, cleanup verified in React docs
- Architecture (Motion animations): HIGH - Existing useAnimate usage in VoteAgreeDisagree.tsx confirms capabilities
- Pitfalls (stale closures, cleanup): HIGH - Well-documented React patterns
- Pitfalls (edge cases): MEDIUM - Empty batch and network errors are hypothetical but logical

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable patterns, unlikely to change)
