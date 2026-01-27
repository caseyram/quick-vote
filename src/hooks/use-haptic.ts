import { useMemo } from 'react';

export function useHaptic() {
  const supported =
    typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return useMemo(
    () => ({
      tap: () => {
        if (supported) navigator.vibrate(30);
      },
      confirm: () => {
        if (supported) navigator.vibrate([40, 30, 40]);
      },
    }),
    [supported],
  );
}
