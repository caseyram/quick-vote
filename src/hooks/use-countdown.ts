import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drift-corrected countdown timer hook.
 *
 * Uses `setInterval` at 100ms with `Date.now()` delta calculation to avoid
 * timer drift from JS event loop delays and browser tab throttling.
 *
 * @param onComplete - Called when the countdown reaches zero. Stored in a ref
 *   to avoid stale closures; callers do NOT need to memoize this callback.
 * @returns `{ remaining, isRunning, expired, start, stop }`
 *   - `remaining`: milliseconds left (0 when stopped or completed)
 *   - `isRunning`: whether the timer is actively counting down
 *   - `expired`: true if the timer naturally reached 0 (not manually stopped)
 *   - `start(durationMs)`: begins countdown from the given duration
 *   - `stop()`: cancels the countdown and resets remaining to 0
 */
export function useCountdown(onComplete: () => void) {
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [expired, setExpired] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref current to avoid stale closures
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    (durationMs: number) => {
      clearTimer();

      const end = Date.now() + durationMs;
      endTimeRef.current = end;
      setRemaining(durationMs);
      setIsRunning(true);
      setExpired(false); // Reset expired state when starting a new countdown

      intervalRef.current = setInterval(() => {
        const left = Math.max(0, (endTimeRef.current ?? Date.now()) - Date.now());
        setRemaining(left);

        if (left <= 0) {
          clearTimer();
          endTimeRef.current = null;
          setIsRunning(false);
          setExpired(true); // Mark as naturally expired
          onCompleteRef.current();
        }
      }, 100); // 100ms ticks for smooth display
    },
    [clearTimer]
  );

  const stop = useCallback(() => {
    clearTimer();
    endTimeRef.current = null;
    setIsRunning(false);
    setRemaining(0);
    setExpired(false); // Reset expired state when manually stopped
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { remaining, isRunning, expired, start, stop };
}
