import { useEffect, useCallback, useMemo } from 'react';
import { useSessionStore } from '../stores/session-store';
import type { SessionItem } from '../types/database';

interface UseSequenceNavigationOptions {
  enabled: boolean;
  onActivateItem: (item: SessionItem, direction: 'forward' | 'backward') => void;
}

interface SequenceNavigationResult {
  currentIndex: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  goNext: () => void;
  goPrev: () => void;
  jumpTo: (itemId: string) => void;
}

export function useSequenceNavigation(
  options: UseSequenceNavigationOptions
): SequenceNavigationResult {
  const { enabled, onActivateItem } = options;
  const sessionItems = useSessionStore((state) => state.sessionItems);
  const activeSessionItemId = useSessionStore((state) => state.activeSessionItemId);

  // Compute current index
  const currentIndex = useMemo(() => {
    if (!activeSessionItemId) return -1;
    return sessionItems.findIndex((item) => item.id === activeSessionItemId);
  }, [activeSessionItemId, sessionItems]);

  // Navigation capability checks
  const canGoNext = currentIndex < sessionItems.length - 1;
  const canGoPrev = currentIndex > 0;

  // Navigation functions
  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const nextItem = sessionItems[currentIndex + 1];
    if (nextItem) {
      onActivateItem(nextItem, 'forward');
    }
  }, [canGoNext, currentIndex, sessionItems, onActivateItem]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    const prevItem = sessionItems[currentIndex - 1];
    if (prevItem) {
      onActivateItem(prevItem, 'backward');
    }
  }, [canGoPrev, currentIndex, sessionItems, onActivateItem]);

  const jumpTo = useCallback(
    (itemId: string) => {
      const targetIndex = sessionItems.findIndex((item) => item.id === itemId);
      if (targetIndex === -1) return;

      const targetItem = sessionItems[targetIndex];
      const direction = targetIndex > currentIndex ? 'forward' : 'backward';
      onActivateItem(targetItem, direction);
    },
    [sessionItems, currentIndex, onActivateItem]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // Prevent auto-repeat for navigation commands
      if (event.repeat) return;

      // Don't navigate if user is typing in input/textarea/select
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault(); // Prevent Space from scrolling page
        goNext();
      } else if (event.key === 'ArrowLeft') {
        goPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, goNext, goPrev]);

  return {
    currentIndex,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    jumpTo,
  };
}
