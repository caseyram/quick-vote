import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Tracks connected participants via Supabase Presence with a 10-second
 * grace period for disconnects (avoids flicker on brief network blips).
 *
 * IMPORTANT: Does NOT call `channel.subscribe()` -- that is handled by
 * `useRealtimeChannel`. This hook only calls `channel.track()` and
 * listens for presence events.
 *
 * @param channel - The Supabase RealtimeChannel (from useRealtimeChannel's channelRef)
 * @param userId  - Current user's auth uid
 * @param role    - 'admin' or 'participant'
 */
export function usePresence(
  channel: RealtimeChannel | null,
  userId: string,
  role: 'admin' | 'participant'
) {
  const [participantCount, setParticipantCount] = useState(0);
  const leaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!channel) return;

    // Listen for presence sync -- fires on every join/leave with full state
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      // Count all unique presence keys (each represents a connected client)
      // Subtract keys that are in the grace period (recently left)
      const allKeys = Object.keys(state);
      setParticipantCount(allKeys.length);
    });

    // Grace period for leaves: delay count reduction by 10 seconds
    channel.on('presence', { event: 'leave' }, ({ key }) => {
      // Start a 10-second grace timer for this key
      const timer = setTimeout(() => {
        leaveTimers.current.delete(key);
        // Presence sync will have already updated; grace period just
        // prevents premature count drops during brief reconnections.
        // Re-read current state to get accurate count after grace expires.
        const state = channel.presenceState();
        setParticipantCount(Object.keys(state).length);
      }, 10_000);
      leaveTimers.current.set(key, timer);
    });

    // Cancel grace timer if the key rejoins
    channel.on('presence', { event: 'join' }, ({ key }) => {
      const timer = leaveTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        leaveTimers.current.delete(key);
      }
    });

    // Track this client's presence
    // channel.track() buffers until SUBSCRIBED, so safe to call immediately
    channel.track({
      userId,
      role,
      joinedAt: new Date().toISOString(),
    });

    // Read current presence state immediately to catch participants who
    // connected before these listeners were attached (initial sync event
    // fires on subscribe, which may happen before this effect runs)
    const currentState = channel.presenceState();
    const currentKeys = Object.keys(currentState);
    if (currentKeys.length > 0) {
      setParticipantCount(currentKeys.length);
    }

    return () => {
      // Clear all grace period timers on cleanup
      leaveTimers.current.forEach((timer) => clearTimeout(timer));
      leaveTimers.current.clear();
    };
    // userId and role are stable for a session; channel identity changes are
    // handled by useRealtimeChannel recreating the channel object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, userId, role]);

  return { participantCount };
}
