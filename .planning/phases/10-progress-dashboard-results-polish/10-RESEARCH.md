# Phase 10: Progress Dashboard & Results Polish - Research

**Researched:** 2026-01-28
**Domain:** Real-time progress tracking, results visualization, keyboard navigation, session state management
**Confidence:** HIGH

## Summary

This phase focuses on building an admin progress dashboard for monitoring batch completion in real-time and improving the results viewing experience. Research covers five technical domains: Supabase realtime subscriptions for progress tracking, progress visualization patterns, localStorage-based read/unread state, keyboard navigation for results, and CSS animations for real-time feedback.

The existing codebase already has a strong realtime foundation with `use-realtime-channel.ts` providing multiplexed Supabase subscriptions. The project uses Tailwind CSS v4 (@tailwindcss/vite) with custom theme variables, and has established vote aggregation patterns in `vote-aggregation.ts`. SessionResults and SessionReview components demonstrate the current results display pattern, which can be enhanced with horizontal layout and keyboard navigation.

The standard approach is: (1) extend existing realtime channel to track vote counts per question, (2) build inline progress dashboard with Tailwind-based progress bars and pulse animations, (3) use simple useState + localStorage pattern for read/unread tracking (session-only), (4) implement roving tabindex pattern for keyboard navigation between results, and (5) optimize results layout with horizontal positioning and sticky navigation.

**Primary recommendation:** Leverage existing realtime infrastructure and Tailwind utilities rather than adding new dependencies. Use postgres_changes subscription for vote count tracking, custom Tailwind keyframe for pulse animation, and native CSS position:sticky for navigation arrows.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Realtime | 2.x (via @supabase/supabase-js) | Real-time vote count updates | Already integrated, postgres_changes pattern established |
| React 19 | 19.0.0 | Component framework | useState for localStorage sync sufficient for session-only state |
| Tailwind CSS | 4.1.18 | Styling and animations | Utility-first approach, custom keyframes in @theme |
| localStorage API | Native | Read/unread state persistence | Session-only, no server sync needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | No new dependencies | Existing stack covers all needs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres_changes subscription | Polling (existing 3s fallback) | Already have both; subscription is lower latency |
| Custom localStorage hook | useSyncExternalStore | Overkill for session-only, single-component state |
| Animation library | Tailwind keyframes | No benefit; CSS animations sufficient for pulse effect |
| React Router useNavigate | useState index tracking | Navigation is within single view, not route changes |

**Installation:**
No new packages required. All functionality achievable with existing dependencies.

## Architecture Patterns

### Progress Dashboard Component Structure
```
AdminSession.tsx (existing)
├── ProgressDashboard.tsx (new - inline at top of active view)
│   ├── Overall progress bar (completed / total participants)
│   ├── Participant counts (completed, in-progress)
│   └── Per-question mini bars (response counts)
└── Existing active view layout
```

### Results Navigation Component Structure
```
SessionReview.tsx or Results component
├── QuestionNavigator.tsx (new - wraps question display)
│   ├── Arrow navigation buttons (floating/sticky)
│   ├── Keyboard listener (useEffect with roving tabindex)
│   └── Current question index state
└── QuestionCard with horizontal layout optimization
```

### Pattern 1: Real-time Vote Count Tracking
**What:** Subscribe to votes table changes and aggregate counts client-side per question
**When to use:** Progress dashboard during active batch
**Example:**
```typescript
// Source: Existing use-realtime-channel.ts pattern + Supabase docs
// Extend setupChannel callback in AdminSession.tsx

const [questionVoteCounts, setQuestionVoteCounts] = useState<Record<string, number>>({});

channel.on(
  'postgres_changes' as any,
  {
    event: 'INSERT',
    schema: 'public',
    table: 'votes',
    filter: `session_id=eq.${sessionId}`,
  },
  (payload: any) => {
    const newVote = payload.new as Vote;
    setQuestionVoteCounts(prev => ({
      ...prev,
      [newVote.question_id]: (prev[newVote.question_id] || 0) + 1
    }));
  }
);
```

### Pattern 2: Pulse Animation on Count Change
**What:** Trigger brief highlight animation when vote count updates
**When to use:** Real-time progress dashboard updates
**Example:**
```typescript
// Source: Tailwind CSS custom keyframes + React state
// In index.css @theme:
@theme {
  --animation-pulse-update: pulse-update 0.6s ease-out;
}

@keyframes pulse-update {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  50% { box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.4); }
}

// In component:
const [pulsing, setPulsing] = useState(false);

useEffect(() => {
  if (count > prevCount) {
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 600);
    return () => clearTimeout(timer);
  }
}, [count, prevCount]);

<div className={pulsing ? 'animate-[pulse-update_0.6s_ease-out]' : ''}>
  {count} votes
</div>
```

### Pattern 3: localStorage Read/Unread State
**What:** Track which reason cards admin has clicked, persist in localStorage with session key
**When to use:** Read/unread highlighting in results view
**Example:**
```typescript
// Source: React useState + localStorage pattern (no useSyncExternalStore needed)
// Simple session-only persistence

const [readReasons, setReadReasons] = useState<Set<string>>(() => {
  const stored = localStorage.getItem(`read-reasons-${sessionId}`);
  return stored ? new Set(JSON.parse(stored)) : new Set();
});

const markAsRead = (reasonId: string) => {
  setReadReasons(prev => {
    const next = new Set(prev);
    next.add(reasonId);
    localStorage.setItem(`read-reasons-${sessionId}`, JSON.stringify([...next]));
    return next;
  });
};

const isUnread = (reasonId: string) => !readReasons.has(reasonId);

// In render:
<div
  onClick={() => markAsRead(reason.id)}
  className={isUnread(reason.id) ? 'bg-blue-50' : 'bg-white'}
>
  {reason.text}
</div>
```

### Pattern 4: Roving Tabindex Keyboard Navigation
**What:** Arrow keys navigate between questions, focus management via tabindex state
**When to use:** Results view with multiple questions
**Example:**
```typescript
// Source: MDN ARIA keyboard patterns + React focus management

const [currentIndex, setCurrentIndex] = useState(0);
const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newIndex = e.key === 'ArrowRight'
        ? Math.min(currentIndex + 1, questions.length - 1)
        : Math.max(currentIndex - 1, 0);
      setCurrentIndex(newIndex);
      questionRefs.current[newIndex]?.focus();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentIndex, questions.length]);

// In render:
{questions.map((q, idx) => (
  <div
    key={q.id}
    ref={el => questionRefs.current[idx] = el}
    tabIndex={idx === currentIndex ? 0 : -1}
  >
    {/* Question content */}
  </div>
))}
```

### Pattern 5: Sticky Navigation Arrows
**What:** Floating left/right arrow buttons for question navigation
**When to use:** Results view on screens with horizontal scroll or pagination
**Example:**
```typescript
// Source: CSS position:sticky + Tailwind utilities

<div className="relative">
  {/* Left arrow - sticky to left edge */}
  <button
    onClick={() => navigateToPrevQuestion()}
    className="fixed left-4 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 disabled:opacity-50"
    disabled={currentIndex === 0}
  >
    <svg className="w-6 h-6" /* left arrow icon */ />
  </button>

  {/* Question content */}
  <div className="max-w-4xl mx-auto px-20">
    {/* Current question */}
  </div>

  {/* Right arrow - sticky to right edge */}
  <button
    onClick={() => navigateToNextQuestion()}
    className="fixed right-4 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 disabled:opacity-50"
    disabled={currentIndex === questions.length - 1}
  >
    <svg className="w-6 h-6" /* right arrow icon */ />
  </button>
</div>
```

### Anti-Patterns to Avoid
- **Polling-only progress updates:** Use postgres_changes subscription for low latency; polling is fallback only
- **Database persistence for read state:** Session-only feature doesn't need server sync; localStorage sufficient
- **Separate realtime channel:** Multiplexed channel pattern already established, extend existing setupChannel
- **Animation libraries for pulse:** CSS keyframes simpler and more performant than motion library for this case
- **Route-based navigation:** Questions are within single view; useState index tracking cleaner than router

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab localStorage sync | Custom storage events | Simple useState pattern | Single-tab admin session, no cross-tab sync needed |
| Vote count aggregation | New aggregation logic | Extend existing aggregateVotes in vote-aggregation.ts | Pattern already proven, just need counts not percentages |
| Realtime subscription | New channel setup | Extend setupChannel in AdminSession.tsx | Multiplexed channel already handles votes table |
| Progress bar animation | Custom CSS transitions | Tailwind transition utilities + custom keyframes | Built-in utilities cover height transitions, only pulse needs custom |
| Keyboard event handling | addEventListener on each element | Single listener on container with delegation | More performant, easier cleanup |

**Key insight:** This phase is primarily about composition and extension of existing patterns rather than introducing new architectural concepts. The realtime foundation, vote tracking, and results display components are already in place.

## Common Pitfalls

### Pitfall 1: Race Conditions in Vote Count Updates
**What goes wrong:** Concurrent vote insertions can lead to stale count displays if using non-functional state updates
**Why it happens:** Multiple postgres_changes events firing rapidly, each reading previous state
**How to avoid:** Use functional setState pattern: `setCount(prev => prev + 1)` instead of `setCount(count + 1)`
**Warning signs:** Progress counts occasionally decrease or don't match total vote count

### Pitfall 2: localStorage Quota Exceeded
**What goes wrong:** Storing large read/unread sets can hit 5-10MB localStorage limit
**Why it happens:** Long-running sessions with hundreds of questions and reasons
**How to avoid:** Store only vote IDs (strings), not full vote objects. Clear on session end. Monitor with try/catch on setItem
**Warning signs:** Errors in console about quota, localStorage.setItem failing silently

### Pitfall 3: Memory Leaks from Animation Timers
**What goes wrong:** Pulse animation timers not cleaned up when component unmounts
**Why it happens:** setTimeout in useEffect without cleanup function
**How to avoid:** Always return cleanup function that clears timeout: `return () => clearTimeout(timer)`
**Warning signs:** Browser DevTools shows growing timeout count, performance degradation over time

### Pitfall 4: Stale Snapshots in localStorage Hook
**What goes wrong:** Infinite re-render loops when getSnapshot returns new object reference each call
**Why it happens:** Returning object literal or array from getSnapshot without memoization
**How to avoid:** For session-only state, simple useState + localStorage is sufficient. If using useSyncExternalStore, cache snapshot
**Warning signs:** Component re-rendering continuously, browser freezing

### Pitfall 5: Keyboard Focus Trapped in Results
**What goes wrong:** Users can't tab out of results section after using arrow keys
**Why it happens:** Focus programmatically set without allowing natural tab navigation
**How to avoid:** Only intercept arrow keys, not Tab. Keep roving tabindex logic separate from normal tab order
**Warning signs:** Accessibility testing shows focus trap, keyboard-only users report navigation issues

### Pitfall 6: Column Order Inconsistency
**What goes wrong:** Agree/Disagree columns flip positions between questions due to alphabetical sorting
**Why it happens:** aggregateVotes returns Object.entries which has unpredictable order
**How to avoid:** Sort aggregated results by predefined option order (e.g., ['agree', 'sometimes', 'disagree'])
**Warning signs:** Users report confusion, columns visually jump between questions

### Pitfall 7: Postgres Changes Authorization Bottleneck
**What goes wrong:** Progress updates lag as participant count increases
**Why it happens:** Every INSERT triggers RLS check for all subscribed clients (single-threaded)
**How to avoid:** Monitor latency with 10+ concurrent participants. If >500ms lag, fall back to polling or broadcast
**Warning signs:** Votes appear on participant screen before admin sees count update

## Code Examples

Verified patterns from official sources and codebase analysis:

### Vote Count Aggregation for Progress
```typescript
// Source: Existing vote-aggregation.ts pattern
// Extend for progress tracking (count-only, no percentages needed)

interface QuestionProgress {
  questionId: string;
  voteCount: number;
  responseBreakdown: Record<string, number>; // e.g., { agree: 5, disagree: 3 }
}

function aggregateQuestionProgress(votes: Vote[]): QuestionProgress[] {
  const byQuestion = votes.reduce<Record<string, Vote[]>>((acc, vote) => {
    if (!acc[vote.question_id]) acc[vote.question_id] = [];
    acc[vote.question_id].push(vote);
    return acc;
  }, {});

  return Object.entries(byQuestion).map(([questionId, qVotes]) => {
    const breakdown = qVotes.reduce<Record<string, number>>((acc, v) => {
      acc[v.value] = (acc[v.value] || 0) + 1;
      return acc;
    }, {});

    return {
      questionId,
      voteCount: qVotes.length,
      responseBreakdown: breakdown,
    };
  });
}
```

### Progress Dashboard Component
```typescript
// Source: Tailwind utilities + React state patterns
// Inline component for AdminSession active view

interface ProgressDashboardProps {
  batchId: string;
  questionIds: string[];
  participantCount: number;
  voteCounts: Record<string, number>; // questionId -> count
}

function ProgressDashboard({
  batchId,
  questionIds,
  participantCount,
  voteCounts,
}: ProgressDashboardProps) {
  const totalExpected = questionIds.length * participantCount;
  const totalVotes = Object.values(voteCounts).reduce((sum, c) => sum + c, 0);
  const completedParticipants = Math.floor(totalVotes / questionIds.length);
  const inProgress = participantCount - completedParticipants;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto space-y-3">
        {/* Overall progress bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(completedParticipants / participantCount) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700">
            {completedParticipants}/{participantCount} complete
          </div>
        </div>

        {/* Participant counts */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Completed: {completedParticipants}</span>
          <span>In progress: {inProgress}</span>
        </div>

        {/* Per-question mini bars */}
        <div className="flex gap-2">
          {questionIds.map((qId, idx) => {
            const count = voteCounts[qId] || 0;
            const percent = (count / participantCount) * 100;
            return (
              <div key={qId} className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1">Q{idx + 1}</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### Read/Unread Reasons State Hook
```typescript
// Source: localStorage best practices + React hooks
// Simple pattern for session-only state

function useReadReasons(sessionId: string) {
  const storageKey = `read-reasons-${sessionId}`;

  const [readReasons, setReadReasons] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsRead = useCallback((reasonId: string) => {
    setReadReasons(prev => {
      if (prev.has(reasonId)) return prev;
      const next = new Set(prev);
      next.add(reasonId);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {
        console.warn('localStorage quota exceeded:', e);
      }
      return next;
    });
  }, [storageKey]);

  const isUnread = useCallback((reasonId: string) => {
    return !readReasons.has(reasonId);
  }, [readReasons]);

  return { markAsRead, isUnread };
}
```

### Keyboard Navigation Hook
```typescript
// Source: MDN ARIA keyboard patterns
// Roving tabindex for arrow key navigation

function useKeyboardNavigation(itemCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      e.preventDefault();

      setCurrentIndex(prev => {
        if (e.key === 'ArrowRight') {
          return Math.min(prev + 1, itemCount - 1);
        } else {
          return Math.max(prev - 1, 0);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemCount]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, itemCount - 1));
  }, [itemCount]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  return {
    currentIndex,
    goToNext,
    goToPrev,
    canGoNext: currentIndex < itemCount - 1,
    canGoPrev: currentIndex > 0,
  };
}
```

### Consistent Column Order for Results
```typescript
// Source: Existing BarChart.tsx + vote-aggregation.ts
// Ensure agree/disagree always in same positions

function buildConsistentBarData(question: Question, aggregated: VoteCount[]) {
  // Define expected order based on question type
  const orderMap: Record<string, string[]> = {
    agree_disagree: ['agree', 'sometimes', 'disagree'],
    multiple_choice: question.options || [], // Use authored order
  };

  const expectedOrder = orderMap[question.type] || [];

  // Sort aggregated results to match expected order
  const sorted = expectedOrder.map(value => {
    const found = aggregated.find(vc => vc.value === value);
    return found || { value, count: 0, percentage: 0 };
  });

  // Map to bar data with colors
  return sorted.map((vc, index) => {
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for real-time updates | Postgres Changes subscription + polling fallback | Phase 1-9 (already implemented) | Lower latency, established pattern |
| Global state for all UI state | localStorage for session-only ephemeral state | React 18+ era | Simpler, no server sync needed |
| CSS-in-JS for animations | Tailwind @keyframes in @theme | Tailwind v4 (2024) | Better DX, CSS optimization |
| aria-activedescendant | Roving tabindex | Current ARIA spec | Better screen reader support |

**Deprecated/outdated:**
- useSyncExternalStore for simple localStorage: While powerful, overkill for single-component session-only state. Simple useState + localStorage sufficient when no cross-tab sync needed.
- Separate channels per feature: Multiplexed channel pattern established in Phase 1-9 via use-realtime-channel.ts

## Open Questions

Things that couldn't be fully resolved:

1. **Progress update latency at scale**
   - What we know: Supabase postgres_changes processes on single thread, authorization checks scale linearly with subscriber count
   - What's unclear: Exact participant count threshold where latency becomes noticeable (>500ms)
   - Recommendation: Implement both subscription and polling, monitor latency in production, switch dynamically if needed

2. **localStorage quota management**
   - What we know: Browsers provide 5-10MB per domain, storing vote IDs as strings
   - What's unclear: Typical session size and whether cleanup is needed mid-session
   - Recommendation: Add try/catch on setItem, log warnings. Consider clearing read state after batch closes.

3. **Horizontal layout responsiveness**
   - What we know: Context specifies horizontal layout for desktop to reduce vertical scrolling
   - What's unclear: Mobile breakpoint behavior and whether horizontal scroll is acceptable
   - Recommendation: Test on tablet sizes, consider responsive switch to vertical layout <768px

## Sources

### Primary (HIGH confidence)
- [Supabase Postgres Changes Documentation](https://supabase.com/docs/guides/realtime/postgres-changes) - Subscription patterns, performance considerations
- [MDN ARIA Keyboard Navigation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets) - Roving tabindex, focus management
- Existing codebase: use-realtime-channel.ts, vote-aggregation.ts, AdminSession.tsx - Established patterns

### Secondary (MEDIUM confidence)
- [React useSyncExternalStore Guide](https://react.dev/reference/react/useSyncExternalStore) - External store patterns (verified not needed for this case)
- [Tailwind CSS Animation Documentation](https://tailwindcss.com/docs/animation) - Custom keyframes, pulse utilities
- [Handling React Race Conditions](https://medium.com/cyberark-engineering/handling-state-update-race-conditions-in-react-8e6c95b74c17) - Functional setState patterns

### Tertiary (LOW confidence - general patterns only)
- Community articles on CSS pulse effects - Verified approach with official Tailwind docs
- React localStorage hooks examples - Used to confirm simple useState pattern is standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in project, no new dependencies needed
- Architecture: HIGH - Patterns established in existing codebase, extending not creating
- Pitfalls: MEDIUM - Some from training knowledge (localStorage quota), some from Supabase docs (auth bottleneck)

**Research date:** 2026-01-28
**Valid until:** 30 days (stable patterns, no fast-moving dependencies)
