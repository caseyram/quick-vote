import { useState, useCallback } from 'react';

/**
 * Hook for tracking read/unread state of reason cards.
 * Persists to localStorage per session (session-only, not database).
 */
export function useReadReasons(sessionId: string) {
  const storageKey = `read-reasons-${sessionId}`;

  const [readReasons, setReadReasons] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsRead = useCallback((reasonId: string) => {
    setReadReasons(prev => {
      if (prev.has(reasonId)) return prev;
      const next = new Set(prev);
      next.add(reasonId);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {
        console.warn('localStorage quota exceeded:', e);
      }
      return next;
    });
  }, [storageKey]);

  const isUnread = useCallback((reasonId: string) => {
    return !readReasons.has(reasonId);
  }, [readReasons]);

  return { markAsRead, isUnread };
}
