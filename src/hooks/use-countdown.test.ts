import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from './use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with remaining=0, isRunning=false, and expired=false', () => {
    const { result } = renderHook(() => useCountdown(vi.fn()));
    expect(result.current.remaining).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.expired).toBe(false);
  });

  it('start sets remaining, isRunning, and resets expired', () => {
    const { result } = renderHook(() => useCountdown(vi.fn()));
    act(() => {
      result.current.start(5000);
    });
    expect(result.current.remaining).toBe(5000);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.expired).toBe(false);
  });

  it('stop resets state including expired', () => {
    const { result } = renderHook(() => useCountdown(vi.fn()));
    act(() => {
      result.current.start(5000);
    });
    act(() => {
      result.current.stop();
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.expired).toBe(false);
  });

  it('calls onComplete and sets expired=true when timer reaches zero', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCountdown(onComplete));

    act(() => {
      result.current.start(500);
    });

    // Advance past the duration
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledOnce();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.remaining).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it('decrements remaining over time', () => {
    const { result } = renderHook(() => useCountdown(vi.fn()));
    act(() => {
      result.current.start(1000);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // remaining should be less than 1000 (drift-corrected, so approximately 900)
    expect(result.current.remaining).toBeLessThan(1000);
    expect(result.current.isRunning).toBe(true);
  });

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { result, unmount } = renderHook(() => useCountdown(vi.fn()));
    act(() => {
      result.current.start(5000);
    });
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('restarting clears previous timer', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCountdown(onComplete));

    act(() => {
      result.current.start(500);
    });
    act(() => {
      result.current.start(1000);
    });

    // Advance past the first duration but not the second
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should NOT have completed (restarted with 1000ms)
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.isRunning).toBe(true);
  });

  it('restarting after expiration resets expired state', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCountdown(onComplete));

    // Start and let it expire
    act(() => {
      result.current.start(500);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.expired).toBe(true);

    // Restart should reset expired
    act(() => {
      result.current.start(1000);
    });
    expect(result.current.expired).toBe(false);
    expect(result.current.isRunning).toBe(true);
  });

  it('stop after expiration resets expired state', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCountdown(onComplete));

    // Start and let it expire
    act(() => {
      result.current.start(500);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.expired).toBe(true);

    // Stop should reset expired
    act(() => {
      result.current.stop();
    });
    expect(result.current.expired).toBe(false);
  });
});
