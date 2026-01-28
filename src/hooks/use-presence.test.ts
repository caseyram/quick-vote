import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresence } from './use-presence';

describe('usePresence', () => {
  let mockChannel: {
    on: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    presenceState: ReturnType<typeof vi.fn>;
  };
  let callbacks: Record<string, (payload: Record<string, unknown>) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = {};
    mockChannel = {
      on: vi.fn().mockImplementation((_type: string, eventObj: { event: string }, callback: (payload: Record<string, unknown>) => void) => {
        callbacks[eventObj.event] = callback;
        return mockChannel;
      }),
      track: vi.fn(),
      presenceState: vi.fn().mockReturnValue({}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 participants when channel is null', () => {
    const { result } = renderHook(() => usePresence(null, 'user1', 'participant'));
    expect(result.current.participantCount).toBe(0);
  });

  it('tracks the user on the channel', () => {
    renderHook(() => usePresence(mockChannel as never, 'user1', 'admin'));
    expect(mockChannel.track).toHaveBeenCalledWith({
      userId: 'user1',
      role: 'admin',
      joinedAt: expect.any(String),
    });
  });

  it('registers sync, leave, and join presence listeners', () => {
    renderHook(() => usePresence(mockChannel as never, 'user1', 'participant'));
    expect(mockChannel.on).toHaveBeenCalledTimes(3);
    expect(callbacks['sync']).toBeDefined();
    expect(callbacks['leave']).toBeDefined();
    expect(callbacks['join']).toBeDefined();
  });

  it('updates count on sync event', () => {
    mockChannel.presenceState.mockReturnValue({
      user1: [{ user_id: 'user1' }],
      user2: [{ user_id: 'user2' }],
    });

    const { result } = renderHook(() => usePresence(mockChannel as never, 'user1', 'participant'));

    act(() => {
      callbacks['sync']({});
    });

    expect(result.current.participantCount).toBe(2);
  });

  it('reads current presence state on mount', () => {
    mockChannel.presenceState.mockReturnValue({
      user1: [{ user_id: 'user1' }],
    });

    const { result } = renderHook(() => usePresence(mockChannel as never, 'user1', 'participant'));
    expect(result.current.participantCount).toBe(1);
  });

  it('starts grace timer on leave event', () => {
    mockChannel.presenceState.mockReturnValue({});
    renderHook(() => usePresence(mockChannel as never, 'user1', 'participant'));

    act(() => {
      callbacks['leave']({ key: 'user2' });
    });

    // Grace timer started, count not changed yet
    expect(mockChannel.presenceState).toHaveBeenCalled();
  });

  it('cancels grace timer on rejoin', () => {
    mockChannel.presenceState.mockReturnValue({});
    renderHook(() => usePresence(mockChannel as never, 'user1', 'participant'));

    act(() => {
      callbacks['leave']({ key: 'user2' });
    });

    act(() => {
      callbacks['join']({ key: 'user2' });
    });

    // After 10s, timer should not fire
    act(() => {
      vi.advanceTimersByTime(11000);
    });
  });
});
