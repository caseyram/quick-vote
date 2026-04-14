/**
 * Lightweight realtime event logger, disabled by default.
 * Enable in the browser console: localStorage.setItem('qv:realtime-debug', '1')
 * Takes effect immediately — no refresh needed.
 */
export function rtLog(...args: unknown[]): void {
  if (typeof window !== 'undefined' && localStorage.getItem('qv:realtime-debug') === '1') {
    console.debug('[rt]', Date.now(), ...args);
  }
}
