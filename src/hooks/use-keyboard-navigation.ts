import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for keyboard arrow navigation between items.
 * Listens for ArrowLeft/ArrowRight and updates currentIndex.
 */
export function useKeyboardNavigation(itemCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      // Don't intercept if user is in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      e.preventDefault();

      setCurrentIndex(prev => {
        if (e.key === 'ArrowRight') {
          return Math.min(prev + 1, itemCount - 1);
        } else {
          return Math.max(prev - 1, 0);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemCount]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, itemCount - 1));
  }, [itemCount]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, itemCount - 1)));
  }, [itemCount]);

  return {
    currentIndex,
    goToNext,
    goToPrev,
    goTo,
    canGoNext: currentIndex < itemCount - 1,
    canGoPrev: currentIndex > 0,
  };
}
