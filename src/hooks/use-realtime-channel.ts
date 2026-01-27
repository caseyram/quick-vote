import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

type ChannelSetup = (channel: RealtimeChannel) => void;

/**
 * Central hook for Supabase Realtime channel lifecycle management.
 *
 * Creates a channel, lets the caller configure listeners via `setup`,
 * subscribes, and cleans up on unmount or dependency change.
 *
 * @param channelName - Unique channel topic (e.g. `session:${sessionId}`)
 * @param setup - Callback to configure Broadcast / Postgres Changes / Presence
 *   listeners on the channel. Must be wrapped in `useCallback` by the caller
 *   (intentionally excluded from deps to avoid reconnect cycles).
 * @param enabled - Whether to subscribe. Pass `false` to defer connection.
 */
export function useRealtimeChannel(
  channelName: string,
  setup: ChannelSetup,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');

  useEffect(() => {
    if (!enabled || !channelName) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Let caller configure listeners before subscribe
    setup(channel);

    // Subscribe and track connection status
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime channel error:', err);
        setConnectionStatus('reconnecting');
      } else if (status === 'TIMED_OUT') {
        console.error('Realtime channel timed out:', err);
        setConnectionStatus('disconnected');
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // setup intentionally excluded -- caller must use useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled]);

  return { channelRef, connectionStatus };
}
