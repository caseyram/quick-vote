import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let subscribeCallback: ((status: string, err?: Error) => void) | null = null;

const mockChannelObj = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockImplementation((cb: (status: string, err?: Error) => void) => {
    subscribeCallback = cb;
    return mockChannelObj;
  }),
  unsubscribe: vi.fn(),
  track: vi.fn(),
  send: vi.fn(),
  presenceState: vi.fn().mockReturnValue({}),
};

const mockRemoveChannel = vi.fn();
const mockCreateChannel = vi.fn(() => mockChannelObj);

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockCreateChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { useRealtimeChannel } from './use-realtime-channel';

describe('useRealtimeChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCallback = null;
    // Re-establish implementations after clearAllMocks
    mockChannelObj.on.mockReturnThis();
    mockChannelObj.subscribe.mockImplementation((cb: (status: string, err?: Error) => void) => {
      subscribeCallback = cb;
      return mockChannelObj;
    });
    mockChannelObj.presenceState.mockReturnValue({});
    mockCreateChannel.mockReturnValue(mockChannelObj);
  });

  it('returns connecting status initially', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup));
    expect(result.current.connectionStatus).toBe('connecting');
  });

  it('calls setup function with channel', () => {
    const setup = vi.fn();
    renderHook(() => useRealtimeChannel('test-channel', setup));
    expect(setup).toHaveBeenCalledWith(mockChannelObj);
  });

  it('subscribes to the channel', () => {
    const setup = vi.fn();
    renderHook(() => useRealtimeChannel('test-channel', setup));
    expect(mockChannelObj.subscribe).toHaveBeenCalled();
  });

  it('updates status to connected on SUBSCRIBED', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup));

    act(() => {
      subscribeCallback?.('SUBSCRIBED');
    });

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('sets disconnected when disabled', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup, false));
    expect(setup).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('returns participantCount of 0 by default', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup));
    expect(result.current.participantCount).toBe(0);
  });

  it('creates channel with correct name', () => {
    const setup = vi.fn();
    renderHook(() => useRealtimeChannel('my-channel', setup));
    expect(mockCreateChannel).toHaveBeenCalledWith('my-channel');
  });

  it('removes channel on unmount', () => {
    const setup = vi.fn();
    const { unmount } = renderHook(() => useRealtimeChannel('test-channel', setup));
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelObj);
  });

  it('sets reconnecting status on CHANNEL_ERROR', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup));

    act(() => {
      subscribeCallback?.('CHANNEL_ERROR', new Error('test'));
    });

    expect(result.current.connectionStatus).toBe('reconnecting');
  });

  it('sets disconnected status on TIMED_OUT', () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useRealtimeChannel('test-channel', setup));

    act(() => {
      subscribeCallback?.('TIMED_OUT', new Error('timeout'));
    });

    expect(result.current.connectionStatus).toBe('disconnected');
  });
});
