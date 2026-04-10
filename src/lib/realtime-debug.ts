/**
 * Lightweight realtime event logger, disabled by default.
 * Enable in the browser console: localStorage.setItem('qv:realtime-debug', '1')
 */
const enabled =
  typeof window !== 'undefined' &&
  localStorage.getItem('qv:realtime-debug') === '1';

export function rtLog(...args: unknown[]): void {
  if (enabled) {
    console.debug('[rt]', Date.now(), ...args);
  }
}
