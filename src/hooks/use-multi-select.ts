import { useState, useEffect, useCallback, useRef } from 'react';

interface UseMultiSelectOptions {
  itemIds: string[];      // Current ordered list of item IDs
  enabled?: boolean;      // Disable selection (e.g., during drag)
}

interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  handleItemClick: (itemId: string, event: React.MouseEvent) => void;
  handleContainerClick: (event: React.MouseEvent) => void;
  clearSelection: () => void;
  isSelected: (itemId: string) => boolean;
}

export function useMultiSelect(options: UseMultiSelectOptions): UseMultiSelectReturn {
  const { itemIds, enabled = true } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Use ref for lastSelectedId to avoid stale closure issues in callbacks
  const lastSelectedIdRef = useRef<string | null>(null);

  // Clear selection when disabled
  useEffect(() => {
    if (!enabled) {
      setSelectedIds(new Set());
      lastSelectedIdRef.current = null;
    }
  }, [enabled]);

  // Escape key listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedIds(new Set());
        lastSelectedIdRef.current = null;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleItemClick = useCallback(
    (itemId: string, event: React.MouseEvent) => {
      if (!enabled) return;

      if (event.shiftKey && lastSelectedIdRef.current) {
        // Shift-click: range select from anchor to clicked item
        const lastIndex = itemIds.indexOf(lastSelectedIdRef.current);
        const currentIndex = itemIds.indexOf(itemId);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = itemIds.slice(start, end + 1);

          // Add range to existing selection (union)
          setSelectedIds((prev) => new Set([...prev, ...rangeIds]));
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Meta-click: toggle individual item
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(itemId)) {
            next.delete(itemId);
          } else {
            next.add(itemId);
          }
          return next;
        });
        lastSelectedIdRef.current = itemId;
      } else {
        // Regular click: select only this item
        setSelectedIds(new Set([itemId]));
        lastSelectedIdRef.current = itemId;
      }
    },
    [enabled, itemIds]
  );

  const handleContainerClick = useCallback(
    (event: React.MouseEvent) => {
      // Only clear if clicking on the container itself (not a child element)
      if (event.target === event.currentTarget) {
        setSelectedIds(new Set());
        lastSelectedIdRef.current = null;
      }
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  const isSelected = useCallback(
    (itemId: string) => selectedIds.has(itemId),
    [selectedIds]
  );

  return {
    selectedIds,
    handleItemClick,
    handleContainerClick,
    clearSelection,
    isSelected,
  };
}
