import { useCallback, useRef } from 'react';

const DOUBLE_TAP_THRESHOLD = 400;

interface LastTap {
  value: string;
  time: number;
}

export function useDoubleTap(
  onSingleTap: (value: string) => void,
  onDoubleTap: (value: string) => void,
) {
  const lastTapRef = useRef<LastTap | null>(null);

  const handleTap = useCallback(
    (value: string) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (
        lastTap &&
        lastTap.value === value &&
        now - lastTap.time < DOUBLE_TAP_THRESHOLD
      ) {
        // Double-tap on the same value: lock-in
        lastTapRef.current = null;
        onDoubleTap(value);
      } else {
        // First tap or different value: selection change
        lastTapRef.current = { value, time: now };
        onSingleTap(value);
      }
    },
    [onSingleTap, onDoubleTap],
  );

  return handleTap;
}
