import { useState, useMemo, useId } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { SessionItem, Vote } from '../types/database';
import { SequenceItemCard } from './SequenceItemCard';
import { useSessionStore } from '../stores/session-store';
import { reorderSessionItems } from '../lib/sequence-api';
import { useSequenceNavigation } from '../hooks/use-sequence-navigation';
import { useMultiSelect } from '../hooks/use-multi-select';

interface SequenceManagerProps {
  sessionId: string;
  onExpandBatch: (batchId: string) => void;
  onCreateBatch: () => Promise<string | undefined>;
  onDeleteBatch: (batchId: string) => void;
  onDeleteSlide: (item: SessionItem) => void;
  isLive?: boolean;
  activeSessionItemId?: string | null;
  onActivateItem?: (item: SessionItem, direction: 'forward' | 'backward') => void;
  sessionVotes?: Record<string, Vote[]>;
  participantCount?: number;
}

export function SequenceManager({
  onExpandBatch,
  onCreateBatch,
  onDeleteBatch,
  onDeleteSlide,
  isLive = false,
  activeSessionItemId = null,
  onActivateItem,
  sessionVotes,
  participantCount,
}: SequenceManagerProps) {
  const { sessionItems, batches, questions } = useSessionStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Use navigation hook for keyboard shortcuts and navigation controls
  const { currentIndex, canGoNext, canGoPrev, goNext, goPrev, jumpTo } = useSequenceNavigation({
    enabled: isLive && !!onActivateItem,
    onActivateItem: onActivateItem ?? (() => {}),
  });

  const dndId = useId();

  // Sortable IDs
  const sortableIds = useMemo(() => sessionItems.map((item) => item.id), [sessionItems]);

  // Multi-select hook (draft mode only)
  const {
    selectedIds,
    handleItemClick,
    handleContainerClick,
    clearSelection,
    isSelected,
  } = useMultiSelect({
    itemIds: sortableIds,
    enabled: !isLive,
  });

  // Batch question counts lookup
  const batchQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const question of questions) {
      if (question.batch_id) {
        counts[question.batch_id] = (counts[question.batch_id] || 0) + 1;
      }
    }
    return counts;
  }, [questions]);

  // Batch objects lookup
  const batchMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const batch of batches) {
      map[batch.id] = batch;
    }
    return map;
  }, [batches]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const draggedId = event.active.id as string;
    setActiveId(draggedId);

    // If dragged item is not selected, clear selection
    if (!selectedIds.has(draggedId)) {
      clearSelection();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) {
      clearSelection();
      return;
    }

    const draggedId = active.id as string;
    const isGroupDrag = selectedIds.has(draggedId) && selectedIds.size > 1;

    let newOrder: string[];

    if (isGroupDrag) {
      // Group drag: move all selected items
      const selectedArray = Array.from(selectedIds);

      // Remove selected items from current order
      const remainingIds = sortableIds.filter((id) => !selectedIds.has(id));

      // Find target insertion index in remaining items
      const targetIndex = remainingIds.indexOf(over.id as string);

      if (targetIndex === -1) {
        clearSelection();
        return;
      }

      // Extract selected items in their original order
      const selectedInOrder = sortableIds.filter((id) => selectedIds.has(id));

      // Insert all selected items at target index
      newOrder = [
        ...remainingIds.slice(0, targetIndex + 1),
        ...selectedInOrder,
        ...remainingIds.slice(targetIndex + 1),
      ];
    } else {
      // Single drag: existing logic
      const oldIndex = sortableIds.indexOf(draggedId);
      const newIndex = sortableIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) {
        clearSelection();
        return;
      }

      newOrder = [...sortableIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, draggedId);
    }

    // Optimistic update
    const updates = newOrder.map((id, idx) => ({ id, position: idx }));
    useSessionStore.getState().updateSessionItemPositions(updates);

    // Persist to database
    try {
      await reorderSessionItems(updates);
      clearSelection(); // Clear selection after successful drag
    } catch (err) {
      console.error('Failed to reorder session items:', err);
      // Revert on error
      const revert = sortableIds.map((id, idx) => ({ id, position: idx }));
      useSessionStore.getState().updateSessionItemPositions(revert);
    }
  }

  function handleDeleteItem(item: SessionItem) {
    if (item.item_type === 'batch' && item.batch_id) {
      onDeleteBatch(item.batch_id);
    } else {
      onDeleteSlide(item);
    }
  }

  // Find active item for drag overlay
  const activeItem = activeId
    ? sessionItems.find((item) => item.id === activeId)
    : null;

  // Empty state
  if (sessionItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            No items yet. Add a batch or slide to get started.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCreateBatch}
            className="px-4 py-2 border border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
          >
            + New Batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live mode: read-only list with navigation */}
      {isLive ? (
        <>
          <div className="space-y-2">
            {sessionItems.map((item, index) => (
              <SequenceItemCard
                key={item.id}
                item={item}
                index={index}
                batch={
                  item.item_type === 'batch' && item.batch_id
                    ? batchMap[item.batch_id]
                    : undefined
                }
                questionCount={
                  item.item_type === 'batch' && item.batch_id
                    ? batchQuestionCounts[item.batch_id] ?? 0
                    : undefined
                }
                onDelete={() => {}}
                onExpandBatch={undefined}
                isActive={item.id === activeSessionItemId}
                onClick={() => jumpTo(item.id)}
                hideActions
                batchQuestionIds={
                  item.item_type === 'batch' && item.batch_id
                    ? questions.filter(q => q.batch_id === item.batch_id).map(q => q.id)
                    : undefined
                }
                sessionVotes={sessionVotes}
                participantCount={participantCount}
              />
            ))}
          </div>

          {/* Navigation controls */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <button
              onClick={goPrev}
              disabled={!canGoPrev}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${sessionItems.length}` : '--'}
            </span>
            <button
              onClick={goNext}
              disabled={!canGoNext}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        /* Draft mode: DnD reordering enabled */
        <>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div
                className="space-y-2"
                onClick={handleContainerClick}
                onMouseDown={(e) => {
                  if (e.shiftKey) {
                    e.preventDefault(); // Prevent text selection during shift-click
                  }
                }}
              >
                {sessionItems.map((item, index) => (
                  <SequenceItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    batch={
                      item.item_type === 'batch' && item.batch_id
                        ? batchMap[item.batch_id]
                        : undefined
                    }
                    questionCount={
                      item.item_type === 'batch' && item.batch_id
                        ? batchQuestionCounts[item.batch_id] ?? 0
                        : undefined
                    }
                    onDelete={handleDeleteItem}
                    onExpandBatch={onExpandBatch}
                    isSelected={isSelected(item.id)}
                    onSelect={(e) => handleItemClick(item.id, e)}
                    batchQuestionIds={
                      item.item_type === 'batch' && item.batch_id
                        ? questions.filter(q => q.batch_id === item.batch_id).map(q => q.id)
                        : undefined
                    }
                    sessionVotes={sessionVotes}
                    participantCount={participantCount}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeItem && (
                <div className="bg-white border-2 border-indigo-400 rounded-lg p-3 shadow-lg opacity-90">
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 1 ? (
                      <span className="text-indigo-600 font-medium">
                        {selectedIds.size} items
                      </span>
                    ) : activeItem.item_type === 'batch' && activeItem.batch_id ? (
                      <>
                        <span className="text-blue-600 font-medium">
                          {batchMap[activeItem.batch_id]?.name ?? 'Batch'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {batchQuestionCounts[activeItem.batch_id] ?? 0} questions
                        </span>
                      </>
                    ) : (
                      <span className="text-purple-600 font-medium">
                        {activeItem.slide_caption || 'Slide'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {/* Bottom action button */}
          <div className="flex gap-3 mt-3">
            <button
              onClick={onCreateBatch}
              className="px-4 py-2 border border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
            >
              + New Batch
            </button>
          </div>
        </>
      )}
    </div>
  );
}
