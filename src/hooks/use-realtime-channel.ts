import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

type ChannelSetup = (channel: RealtimeChannel) => void;

export interface PresenceConfig {
  userId: string;
  role: 'admin' | 'participant';
}

/**
 * Central hook for Supabase Realtime channel lifecycle management.
 *
 * Creates a channel, lets the caller configure listeners via `setup`,
 * subscribes, and cleans up on unmount or dependency change.
 *
 * Optionally handles Presence tracking when `presenceConfig` is provided.
 * Presence listeners are registered BEFORE subscribe to ensure the initial
 * sync event is captured.
 *
 * @param channelName - Unique channel topic (e.g. `session:${sessionId}`)
 * @param setup - Callback to configure Broadcast / Postgres Changes listeners
 *   on the channel. Must be wrapped in `useCallback` by the caller
 *   (intentionally excluded from deps to avoid reconnect cycles).
 * @param enabled - Whether to subscribe. Pass `false` to defer connection.
 * @param presenceConfig - Optional presence tracking config (userId + role).
 */
export function useRealtimeChannel(
  channelName: string,
  setup: ChannelSetup,
  enabled: boolean = true,
  presenceConfig?: PresenceConfig
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
  const [participantCount, setParticipantCount] = useState(0);
  const leaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!enabled || !channelName) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Set up presence listeners BEFORE subscribe so the initial
    // sync event is captured when the server sends presence_state
    if (presenceConfig) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Count only participants, exclude admins
        let count = 0;
        for (const presences of Object.values(state)) {
          for (const p of presences as { role?: string }[]) {
            if (p.role !== 'admin') count++;
          }
        }
        setParticipantCount(count);
      });

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        const timer = setTimeout(() => {
          leaveTimers.current.delete(key);
          const state = channel.presenceState();
          // Count only participants, exclude admins
          let count = 0;
          for (const presences of Object.values(state)) {
            for (const p of presences as { role?: string }[]) {
              if (p.role !== 'admin') count++;
            }
          }
          setParticipantCount(count);
        }, 10_000);
        leaveTimers.current.set(key, timer);
      });

      channel.on('presence', { event: 'join' }, ({ key }) => {
        const timer = leaveTimers.current.get(key);
        if (timer) {
          clearTimeout(timer);
          leaveTimers.current.delete(key);
        }
      });
    }

    // Let caller configure Broadcast / Postgres Changes listeners
    setup(channel);

    // Subscribe and track connection status
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
        // Track presence after subscribe completes (not buffered)
        if (presenceConfig) {
          channel.track({
            userId: presenceConfig.userId,
            role: presenceConfig.role,
            joinedAt: new Date().toISOString(),
          });
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime channel error:', err);
        setConnectionStatus('reconnecting');
      } else if (status === 'TIMED_OUT') {
        console.error('Realtime channel timed out:', err);
        setConnectionStatus('disconnected');
      }
    });

    return () => {
      leaveTimers.current.forEach((timer) => clearTimeout(timer));
      leaveTimers.current.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // setup intentionally excluded -- caller must use useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, presenceConfig?.userId, presenceConfig?.role]);

  return { channelRef, connectionStatus, participantCount };
}
