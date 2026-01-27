# Phase 4: Realtime and Live Session Orchestration - Research

**Researched:** 2026-01-27
**Domain:** Supabase Realtime (Broadcast, Postgres Changes, Presence), React real-time UI patterns
**Confidence:** HIGH

## Summary

This phase replaces the polling-based bridge (3-4s intervals in AdminSession and ParticipantSession) with Supabase Realtime subscriptions. The research confirms that channel multiplexing (Broadcast + Postgres Changes + Presence on a single channel) is a first-class Supabase feature, already validated in the Phase 1 integration spike. RLS interacts with Postgres Changes in a specific way: INSERT and UPDATE events are filtered per-client based on SELECT RLS policies, but DELETE events are broadcast to all subscribers. For QuickVote's scale (50-100 users), the free tier's 200 concurrent connections and 100 messages/second are sufficient. The bar chart should use pure CSS transitions on div heights (no charting library needed), and the countdown timer should use `setInterval` with `Date.now()` drift correction rather than a decrementing counter.

**Primary recommendation:** Use a single multiplexed Supabase channel per session (`session:{sessionId}`) with Broadcast for admin commands, Postgres Changes for vote streaming, and Presence for participant count. Build the bar chart with CSS `transition` on `height` properties. Build the countdown timer with `setInterval` + `Date.now()` delta calculation.

## Standard Stack

No new dependencies are required. Everything is built with the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.93.1 | Realtime channels (Broadcast, Postgres Changes, Presence) | Already installed; Realtime API is built into the client |
| Zustand | ^5.0.5 | State management for realtime vote data, presence count, timer state | Already installed; selective re-rendering critical for rapid vote updates |
| Tailwind CSS | ^4.1.18 | Bar chart styling, timer UI, crossfade transitions | Already installed; CSS transitions sufficient for all animations |
| React | ^19.0.0 | Hooks for channel lifecycle, timer, UI state | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS div bar chart | recharts / chart.js | Overkill for vertical bars with 2-6 options; adds 50-200KB bundle; CSS transitions handle smooth growth natively |
| CSS transitions for crossfade | framer-motion | Deferred to Phase 5; ~300ms fade-out/fade-in achievable with CSS `opacity` + `transition` |
| setInterval timer | react-timer-hook | Extra dependency for something achievable in ~30 lines; Date.now() drift correction is straightforward |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
src/
  hooks/
    use-realtime-channel.ts   # NEW: Central channel hook (subscribe/cleanup)
    use-presence.ts            # NEW: Presence tracking hook
    use-countdown.ts           # NEW: Countdown timer hook
  components/
    BarChart.tsx               # NEW: Vertical bar chart with CSS transitions
    CountdownTimer.tsx         # NEW: Timer display component
    ConnectionBanner.tsx       # NEW: "Reconnecting..." inline banner
    ParticipantCount.tsx       # NEW: Connected count with pulsing indicator
  pages/
    AdminSession.tsx           # MODIFY: Replace polling with Realtime, add timer controls
    ParticipantSession.tsx     # MODIFY: Replace polling with Realtime, add timer indicator
  stores/
    session-store.ts           # MODIFY: Add realtime state (presence count, timer, connection status)
  lib/
    vote-aggregation.ts        # EXISTING: No changes needed
```

### Pattern 1: Single Multiplexed Channel per Session
**What:** One Supabase channel handles all three Realtime features (Broadcast, Postgres Changes, Presence) for a session.
**When to use:** Always. This is the decided architecture from prior phases.
**Example:**
```typescript
// Source: Supabase Realtime docs (https://supabase.com/docs/guides/realtime/concepts)
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

function createSessionChannel(sessionId: string): RealtimeChannel {
  const channel = supabase.channel(`session:${sessionId}`);

  // Admin commands (question activation, close voting, reveal results)
  channel.on('broadcast', { event: 'question_activated' }, (payload) => {
    // payload.payload contains { questionId, status }
  });

  channel.on('broadcast', { event: 'voting_closed' }, (payload) => {
    // payload.payload contains { questionId }
  });

  channel.on('broadcast', { event: 'results_revealed' }, (payload) => {
    // payload.payload contains { questionId }
  });

  channel.on('broadcast', { event: 'session_ended' }, (payload) => {
    // Session complete
  });

  // Live vote stream (new votes arriving)
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'votes',
      filter: `session_id=eq.${sessionId}`,
    },
    (payload) => {
      // payload.new contains the new Vote row
    }
  );

  // Vote updates (vote changed before lock-in)
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'votes',
      filter: `session_id=eq.${sessionId}`,
    },
    (payload) => {
      // payload.new contains the updated Vote row
    }
  );

  // Presence tracking (participant count)
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const count = Object.keys(state).length;
    // Update participant count in store
  });

  return channel;
}
```

### Pattern 2: useRealtimeChannel Hook (Central Lifecycle Management)
**What:** A custom hook that creates the channel, subscribes, and cleans up on unmount. Prevents subscription leaks.
**When to use:** In both AdminSession and ParticipantSession pages.
**Example:**
```typescript
// Source: Supabase best practices + prior research insights
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type ChannelSetup = (channel: RealtimeChannel) => void;

export function useRealtimeChannel(
  channelName: string,
  setup: ChannelSetup,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !channelName) return;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Let caller configure listeners
    setup(channel);

    // Subscribe and track status
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // Connection established
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Realtime channel error:', status, err);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, enabled]); // setup intentionally excluded (use useCallback)

  return channelRef;
}
```

### Pattern 3: Broadcast for Admin Commands (Not Postgres Changes on questions)
**What:** Admin actions (activate question, close voting, reveal results, end session) are sent as Broadcast messages, NOT relying on Postgres Changes on the questions table.
**When to use:** All admin state transitions during a live session.
**Why:** Broadcast is lower latency than Postgres Changes (no DB round-trip for authorization), and admin commands are ephemeral signals, not data records. The DB write still happens (for persistence), but participants react to the Broadcast event immediately.
**Example:**
```typescript
// Admin side: send command after DB write succeeds
async function handleActivateQuestion(questionId: string) {
  // 1. Write to DB first (source of truth)
  await supabase
    .from('questions')
    .update({ status: 'active' })
    .eq('id', questionId);

  // 2. Broadcast to all participants
  await channelRef.current?.send({
    type: 'broadcast',
    event: 'question_activated',
    payload: { questionId },
  });
}

// Participant side: react to broadcast
channel.on('broadcast', { event: 'question_activated' }, async ({ payload }) => {
  const { questionId } = payload;
  // Fetch the full question from DB (broadcast payloads should be minimal)
  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();
  if (data) {
    setActiveQuestion(data);
  }
});
```

### Pattern 4: Postgres Changes for Vote Stream (Client-Side Aggregation)
**What:** Subscribe to INSERT/UPDATE on the votes table filtered by session_id. Accumulate votes client-side and re-aggregate on each event.
**When to use:** Admin's live results view during an active question.
**Example:**
```typescript
// Source: Supabase Postgres Changes docs
channel.on(
  'postgres_changes',
  {
    event: '*', // INSERT and UPDATE
    schema: 'public',
    table: 'votes',
    filter: `session_id=eq.${sessionId}`,
  },
  (payload) => {
    const newVote = payload.new as Vote;
    const eventType = payload.eventType; // 'INSERT' or 'UPDATE'

    if (eventType === 'INSERT') {
      // Add to accumulated votes
      addVote(newVote);
    } else if (eventType === 'UPDATE') {
      // Replace existing vote for this participant
      updateVote(newVote);
    }
    // Re-aggregate after each change
    recomputeAggregation();
  }
);
```

### Pattern 5: Presence for Participant Count with Grace Period
**What:** Track connected participants via Presence, with a 10-second grace period before removing disconnected users.
**When to use:** Both admin and participant views show connected count.
**Example:**
```typescript
// Source: Supabase Presence docs (https://supabase.com/docs/guides/realtime/presence)
function usePresence(channel: RealtimeChannel | null, participantId: string) {
  const [count, setCount] = useState(0);
  const leaveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!channel) return;

    // Track this client's presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          participantId,
          joinedAt: new Date().toISOString(),
        });
      }
    });

    // Listen for presence changes
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      // Start grace period timer (10 seconds)
      const timer = setTimeout(() => {
        leaveTimers.current.delete(key);
        // Presence sync will update count naturally
      }, 10_000);
      leaveTimers.current.set(key, timer);
    });

    channel.on('presence', { event: 'join' }, ({ key }) => {
      // Cancel grace period if they reconnected
      const timer = leaveTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        leaveTimers.current.delete(key);
      }
    });

    return () => {
      // Clear all grace period timers
      leaveTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, [channel, participantId]);

  return count;
}
```

### Pattern 6: CSS-Only Vertical Bar Chart
**What:** Vertical bars using div elements with `height` set via inline style and CSS `transition` for smooth animation.
**When to use:** Admin results view during and after voting.
**Example:**
```typescript
// Bar chart with CSS transitions (no charting library)
interface BarChartProps {
  data: { label: string; count: number; percentage: number; color: string }[];
}

function BarChart({ data }: BarChartProps) {
  return (
    <div className="flex items-end justify-center gap-6" style={{ height: '300px' }}>
      {data.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center gap-2 flex-1">
          {/* Count + percentage label */}
          <span className="text-sm font-medium text-white">
            {bar.count} ({bar.percentage}%)
          </span>
          {/* Bar container */}
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full rounded-t-lg"
              style={{
                height: `${bar.percentage}%`,
                backgroundColor: bar.color,
                transition: 'height 0.5s ease-out',
                minHeight: bar.count > 0 ? '4px' : '0px',
              }}
            />
          </div>
          {/* Label */}
          <span className="text-sm text-gray-300 text-center">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 7: Countdown Timer with Drift Correction
**What:** Timer hook using `setInterval` with `Date.now()` delta calculation to avoid drift.
**When to use:** When admin activates a question with a timer (15s, 30s, 60s).
**Example:**
```typescript
// Source: React timer best practices (Date.now drift correction)
function useCountdown(durationMs: number, onComplete: () => void) {
  const [remaining, setRemaining] = useState(durationMs);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    endTimeRef.current = Date.now() + durationMs;
    setRemaining(durationMs);

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, (endTimeRef.current ?? now) - now);
      setRemaining(left);

      if (left <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onComplete();
      }
    }, 100); // 100ms updates for smooth display
  }, [durationMs, onComplete]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endTimeRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { remaining, start, stop, isRunning: endTimeRef.current !== null };
}
```

### Anti-Patterns to Avoid
- **Subscribing to the same channel twice:** Supabase treats a second subscription to the same topic as replacing the first. Use a single `useRealtimeChannel` hook per session, not per component.
- **Polling alongside Realtime:** Phase 4 replaces all polling. Remove the `setInterval` polling in AdminSession (3s), ParticipantSession (4s), and AdminQuestionControl (3s vote polling). Do not leave polling as a "fallback" -- it creates duplicate state updates.
- **Relying on Postgres Changes for admin commands:** Broadcast is lower latency and doesn't require RLS authorization checks per subscriber. Use Broadcast for commands, Postgres Changes only for vote data.
- **Decrementing counter for timer:** Using `setTimer(prev => prev - 1)` with `setInterval(fn, 1000)` drifts over time due to JS event loop delays. Always recalculate from `Date.now()`.
- **Sending full vote data in Broadcast payloads:** Send minimal identifiers (questionId) via Broadcast; let clients fetch full data from DB. This avoids payload size issues and ensures DB remains source of truth.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime subscriptions | Custom WebSocket client | supabase.channel() API | Handles reconnection, auth token refresh, heartbeats, multiplexing |
| Presence tracking | Custom "who's online" polling | Supabase Presence API | CRDT-based, handles network partitions, automatic join/leave events |
| Channel cleanup | Manual WebSocket close | supabase.removeChannel() | Properly unsubscribes from server, prevents connection leaks |
| Publication setup | Raw WAL parsing | ALTER PUBLICATION supabase_realtime | Supabase manages replication slots and WAL decoding |

**Key insight:** Supabase Realtime handles all the hard WebSocket problems (reconnection, heartbeats, auth refresh, message ordering). The only custom code needed is the application logic on top of channel events.

## Common Pitfalls

### Pitfall 1: Forgetting to Add Tables to supabase_realtime Publication
**What goes wrong:** Postgres Changes subscriptions silently receive no events.
**Why it happens:** Tables must be explicitly added to the `supabase_realtime` publication before Postgres Changes will stream events for them.
**How to avoid:** Run this SQL before testing Phase 4:
```sql
-- Add votes and questions tables to the Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
```
Alternatively, toggle these tables on in the Supabase Dashboard under Database > Publications > supabase_realtime.
**Warning signs:** Channel subscribes successfully (status = SUBSCRIBED) but no events fire when rows are inserted/updated.

### Pitfall 2: RLS Filters Postgres Changes Events Per-Client
**What goes wrong:** A client subscribes to Postgres Changes but receives no events because RLS policies prevent that user from SELECTing the changed rows.
**Why it happens:** Supabase Realtime checks each subscriber's RLS SELECT permission before delivering a Postgres Changes event. If the subscriber can't SELECT the row, they don't get the event.
**How to avoid:** QuickVote's existing RLS has `"Anyone can read votes" ON votes FOR SELECT TO authenticated USING (true)` -- this means all authenticated users will receive all vote events. This is correct for QuickVote. Verify this policy exists before Phase 4.
**Warning signs:** Some clients receive events, others don't. Check RLS policies on the table.

### Pitfall 3: Old Record is Primary Key Only When RLS is Enabled
**What goes wrong:** Subscribing to UPDATE events with RLS enabled -- the `payload.old` object contains only the primary key columns, not the full previous row.
**Why it happens:** Deliberate security measure to prevent data leakage through DELETE events (which bypass RLS).
**How to avoid:** Don't rely on `payload.old` for vote updates. Use `payload.new` exclusively. For QuickVote, we only need the new vote value anyway.
**Warning signs:** `payload.old` is `{ id: "..." }` instead of the full record.

### Pitfall 4: DELETE Events Bypass RLS (Sent to All Subscribers)
**What goes wrong:** If a vote is deleted, ALL subscribers receive the DELETE event regardless of RLS policies.
**Why it happens:** Postgres cannot verify access to a deleted record.
**How to avoid:** QuickVote doesn't delete votes (votes are upserted, never deleted), so this is not a concern. But be aware of this if vote deletion is ever added.
**Warning signs:** Unexpected DELETE events appearing for users who shouldn't see them.

### Pitfall 5: Channel Subscription Leaks on Re-render
**What goes wrong:** Component re-renders create multiple subscriptions to the same channel, hitting the 100-channels-per-connection limit.
**Why it happens:** Creating a new channel inside `useEffect` without proper dependency management and cleanup.
**How to avoid:** Use a single `useRealtimeChannel` hook with stable dependencies. Always call `supabase.removeChannel()` in the cleanup function. Use `useRef` to hold the channel reference.
**Warning signs:** Console warnings about too many channels; `too_many_channels` WebSocket error.

### Pitfall 6: Missed Events During Reconnection
**What goes wrong:** If the WebSocket disconnects and reconnects, events that occurred during the gap are lost.
**Why it happens:** Supabase Realtime has no built-in message queue for disconnected clients.
**How to avoid:** After reconnection (status changes back to SUBSCRIBED), re-fetch the current state from the database. For QuickVote: re-fetch the active question status, current votes, and session status.
**Warning signs:** Vote count seems lower than expected after a brief network interruption; participant sees stale question state.

### Pitfall 7: Timer Drift with setInterval + Counter Decrement
**What goes wrong:** Countdown timer shows wrong remaining time (accumulates 50-200ms error over 60 seconds).
**Why it happens:** `setInterval(fn, 1000)` doesn't guarantee exactly 1000ms between calls due to JS event loop delays and browser tab throttling.
**How to avoid:** Store the end time as `Date.now() + duration`, then calculate remaining as `endTime - Date.now()` on each tick.
**Warning signs:** Timer shows "0" but voting is still open; timer takes 62 seconds to count down from 60.

### Pitfall 8: Rapid Vote Updates Causing Excessive Re-renders
**What goes wrong:** Bar chart re-renders on every single vote event (potentially 50-100 updates in quick succession).
**Why it happens:** Each Postgres Changes event updates the Zustand store, triggering component re-renders.
**How to avoid:** Use Zustand selectors to only re-render the bar chart when aggregated data changes. Batch vote updates: accumulate incoming votes in a buffer and flush to store every 200-300ms. CSS transitions handle visual smoothness regardless of update frequency.
**Warning signs:** UI feels janky during rapid voting; React DevTools shows excessive renders on BarChart component.

## Code Examples

### Database Setup: Enable Realtime Publication
```sql
-- Run in Supabase SQL Editor before Phase 4 testing
-- Source: Supabase Postgres Changes docs (https://supabase.com/docs/guides/realtime/postgres-changes)

-- Add votes table to Realtime publication (for live vote streaming)
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- Add questions table to Realtime publication (optional -- only if using
-- Postgres Changes for question status; we use Broadcast instead, but
-- adding it provides a safety net)
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
```

### Admin: Send Broadcast Command After DB Write
```typescript
// Source: Supabase Broadcast docs (https://supabase.com/docs/guides/realtime/broadcast)
// Pattern: Write to DB first, then broadcast the event

async function activateQuestion(
  channel: RealtimeChannel,
  questionId: string,
  sessionId: string,
  timerSeconds: number | null
) {
  // 1. Close any currently active question
  await supabase
    .from('questions')
    .update({ status: 'closed' })
    .eq('session_id', sessionId)
    .eq('status', 'active');

  // 2. Activate the new question
  await supabase
    .from('questions')
    .update({ status: 'active' })
    .eq('id', questionId);

  // 3. Broadcast to all participants
  await channel.send({
    type: 'broadcast',
    event: 'question_activated',
    payload: {
      questionId,
      timerSeconds, // null means no timer
    },
  });
}
```

### Participant: Handle Broadcast Events
```typescript
// Source: Supabase Broadcast docs
channel.on('broadcast', { event: 'question_activated' }, async ({ payload }) => {
  const { questionId, timerSeconds } = payload;

  // Fetch the full question (broadcast payload is minimal)
  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (data) {
    setActiveQuestion(data);
    setView('voting');
    if (timerSeconds) {
      startTimer(timerSeconds * 1000);
    }
  }
});

channel.on('broadcast', { event: 'voting_closed' }, ({ payload }) => {
  const { questionId } = payload;
  // Transition to waiting/results view
  setView('waiting');
});

channel.on('broadcast', { event: 'session_ended' }, () => {
  setView('results');
});
```

### Presence: Track and Untrack
```typescript
// Source: Supabase Presence docs (https://supabase.com/docs/guides/realtime/presence)

// Track on subscribe
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      participantId: userId,
      role: isAdmin ? 'admin' : 'participant',
    });
  }
});

// Read presence state
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  const participantCount = Object.keys(state).length;
  useSessionStore.getState().setParticipantCount(participantCount);
});

// Untrack on cleanup (automatic when channel is removed, but explicit is safer)
// supabase.removeChannel(channel) handles this
```

### Connection Status Banner
```typescript
// Track channel status for "Reconnecting..." banner
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    setConnectionStatus('connected');
  } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
    setConnectionStatus('reconnecting');
  } else if (status === 'TIMED_OUT') {
    setConnectionStatus('disconnected');
  }
});
```

### Crossfade Between Questions (CSS Only)
```typescript
// ~300ms crossfade using CSS transitions on opacity
// No animation library needed

function QuestionTransition({ children, questionId }: { children: React.ReactNode; questionId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade out, then fade in with new content
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 50); // small delay for opacity transition to register
    return () => clearTimeout(timer);
  }, [questionId]);

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling (3-4s intervals) | Realtime subscriptions | Phase 4 | Latency drops from 3-4s to ~100-200ms |
| REST queries for vote counts | Postgres Changes stream | Phase 4 | Admin sees votes arrive in real-time |
| No presence tracking | Supabase Presence API | Phase 4 | Admin and participants see live connected count |
| No timer | Client-side countdown with Broadcast sync | Phase 4 | Synchronized voting windows across all clients |
| Horizontal progress bars (CSS width) | Vertical bar chart (CSS height) | Phase 4 | Better visualization for results presentation |

**Deprecated/outdated:**
- Phase 3 polling bridge: All `setInterval` polling in ParticipantSession (4s), AdminSession (3s), and AdminQuestionControl (3s) must be removed
- Phase 3 view derivation via polling: ParticipantSession's `deriveView` from polled status must be replaced with event-driven state transitions

## Supabase Realtime Limits (Relevant to QuickVote)

| Limit | Free Tier | Pro ($25/mo) | QuickVote Needs |
|-------|-----------|--------------|-----------------|
| Concurrent connections | 200 | 500 | 50-100 (well within free) |
| Messages/second | 100 | 500 | ~50-100 during rapid voting (within free) |
| Channels/connection | 100 | 100 | 1 per session (minimal) |
| Presence messages/sec | 20 | 50 | ~5-10 join/leave per sec max |
| Broadcast payload size | 256 KB | 3 MB | ~100 bytes per command (minimal) |
| Postgres Changes payload | 1 MB | 1 MB | ~500 bytes per vote (minimal) |
| Channel joins/second | 100 | 500 | Burst at session start only |

**Conclusion:** Free tier is sufficient for QuickVote's v1 scale (50-100 users). The 100 messages/second limit is the tightest constraint during rapid voting but is adequate. Client-side throttling (default 10 events/sec) is handled by supabase-js automatically.

## RLS + Realtime Interaction Summary

| Table | RLS Policy | Realtime Behavior | Impact |
|-------|-----------|-------------------|--------|
| votes (SELECT) | `USING (true)` -- anyone authenticated | All subscribers receive all vote INSERT/UPDATE events | Correct for QuickVote (all users see vote stream) |
| votes (DELETE) | N/A (no delete policy) | DELETE events bypass RLS, sent to ALL subscribers | Not a concern (votes are never deleted) |
| questions (SELECT) | `USING (true)` -- anyone authenticated | All subscribers receive question status changes | Correct, but we use Broadcast for commands instead |
| sessions (SELECT) | `USING (true)` -- anyone authenticated | All subscribers receive session status changes | Correct, but we use Broadcast for commands instead |

**Key finding:** QuickVote's existing RLS policies are Realtime-friendly. The `USING (true)` SELECT policies on votes and questions mean Postgres Changes events will be delivered to all authenticated subscribers without filtering. No RLS changes needed.

## Open Questions

Things that couldn't be fully resolved:

1. **Presence grace period implementation**
   - What we know: Supabase Presence fires `leave` events when a client disconnects. We want a 10-second grace period.
   - What's unclear: Whether the Presence `sync` event fires immediately on leave (before our grace timer) or if it can be delayed. The safe approach is to manage the grace period locally by tracking leave timestamps and excluding recently-left users from the count.
   - Recommendation: Implement grace period as a local timer per departed key (as shown in the Pattern 5 example above). Test with real disconnection scenarios.

2. **Timer synchronization across clients**
   - What we know: Admin starts a timer and broadcasts `timerSeconds` to participants. Each client starts its own local countdown.
   - What's unclear: Network latency means participants may start their timers 100-500ms after the admin. For 15-60 second timers, this is negligible.
   - Recommendation: Accept the small desynchronization for v1. The admin's timer is authoritative -- when admin's timer expires, admin broadcasts `voting_closed` which is the real cutoff.

3. **Re-fetch strategy after reconnection**
   - What we know: After a WebSocket reconnect, events during the gap are lost.
   - What's unclear: Exact latency of reconnection detection. The `subscribe` callback fires with `SUBSCRIBED` again, but there's no guarantee of how quickly.
   - Recommendation: On `SUBSCRIBED` status (after initial connection), re-fetch active question, session status, and current votes from DB. Use a `isInitialConnect` ref to distinguish first connect from reconnects.

4. **Supabase Realtime publication for votes table**
   - What we know: The votes table must be added to the `supabase_realtime` publication.
   - What's unclear: Whether this was done during Phase 1 spike (the spike tested `test_messages`, not `votes`).
   - Recommendation: This is a **prerequisite SQL step** that must be executed in the Supabase SQL Editor before any Postgres Changes testing. Include it as the first task in the first plan.

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts) - Channel multiplexing, topic naming, public vs private channels
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) - send/receive API, self-send config, acknowledgment
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence) - track/untrack, sync/join/leave events, presenceState()
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) - subscribe, filter, payload structure, RLS interaction
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) - RLS on realtime.messages, Postgres Changes separate from channel auth
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) - All rate limits and quotas per tier
- [Supabase Realtime Throttling](https://supabase.com/docs/guides/realtime/guides/client-side-throttling) - eventsPerSecond client config

### Secondary (MEDIUM confidence)
- [Supabase Realtime RLS Blog Post](https://supabase.com/blog/realtime-row-level-security-in-postgresql) - RLS + Postgres Changes interaction details
- [Realtime delete/old record discussion](https://github.com/orgs/supabase/discussions/12471) - Confirmed old record behavior with RLS enabled
- [Supabase Realtime reconnection issues](https://github.com/supabase/realtime/issues/1088) - Reconnection patterns and gotchas
- [Auto reconnect subscription discussion](https://github.com/orgs/supabase/discussions/27513) - Community reconnection strategies
- [Community connection handler gist](https://gist.github.com/Cikmo/bcba91318ba19dae1f914b32bf2b94b2) - Robust reconnection implementation
- [Zustand subscribeWithSelector](https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector) - Selective re-rendering middleware

### Tertiary (LOW confidence)
- [React animated bar chart (DEV)](https://dev.to/diraskreact/create-simple-animated-bar-chart-in-react-1kp2) - CSS transition approach for bar charts
- [CSS chart animation (Medium)](https://medium.com/@info.javahouselab/animation-bar-chart-with-css-transition-5cce965138cf) - CSS custom properties + transition pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all patterns use existing @supabase/supabase-js APIs verified against official docs
- Architecture: HIGH - Channel multiplexing validated in Phase 1 spike; patterns match official Supabase documentation
- RLS + Realtime interaction: HIGH - Verified via official docs and community discussions; existing RLS policies are compatible
- Rate limits: HIGH - Official docs page with exact numbers per tier
- Bar chart approach: MEDIUM - CSS transitions are well-understood, but specific vertical bar chart pattern assembled from multiple sources
- Timer approach: MEDIUM - setInterval + Date.now() is a well-known pattern, but not from an authoritative single source
- Reconnection handling: MEDIUM - Community patterns; official docs acknowledge the gap but don't prescribe a full solution
- Pitfalls: HIGH - Documented from official docs, GitHub issues, and community discussions

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days -- Supabase Realtime API is stable)
