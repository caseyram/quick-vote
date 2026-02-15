import { useState, useId, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { nanoid } from 'nanoid';
import imageCompression from 'browser-image-compression';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { uploadSlideImage } from '../../lib/slide-api';
import { SidebarSequenceItem } from './SidebarSequenceItem';
import { useMultiSelect } from '../../hooks/use-multi-select';

export function EditorSidebar() {
  const { items, selectedItemId, reorderItems, reorderItemsGroup, addItem } = useTemplateEditorStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  const dndId = useId();

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Multi-select hook
  const {
    selectedIds: multiSelectedIds,
    handleItemClick: handleMultiSelectClick,
    handleContainerClick,
    clearSelection: clearMultiSelect,
    isSelected: isMultiSelected,
  } = useMultiSelect({ itemIds });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    setActiveId(draggedId);

    // If dragged item is not in multi-selection, clear selection
    if (!multiSelectedIds.has(draggedId)) {
      clearMultiSelect();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      clearMultiSelect();
      return;
    }

    const draggedId = active.id as string;
    const isGroupDrag = multiSelectedIds.has(draggedId) && multiSelectedIds.size > 1;

    if (isGroupDrag) {
      let targetId = over.id as string;
      // If dropping on another selected item, find nearest non-selected neighbor
      if (multiSelectedIds.has(targetId)) {
        const overIndex = items.findIndex((i) => i.id === targetId);
        const after = items.slice(overIndex + 1).find((i) => !multiSelectedIds.has(i.id));
        const before = items.slice(0, overIndex).reverse().find((i) => !multiSelectedIds.has(i.id));
        if (after) {
          targetId = after.id;
        } else if (before) {
          targetId = before.id;
        } else {
          clearMultiSelect();
          return;
        }
      }
      reorderItemsGroup(multiSelectedIds, targetId);
    } else {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      reorderItems(oldIndex, newIndex);
    }

    clearMultiSelect();
  };

  const handleAddBatch = () => {
    const batchCount = items.filter((item) => item.item_type === 'batch').length;
    const newBatch: EditorItem = {
      id: nanoid(),
      item_type: 'batch',
      batch: {
        name: `Question Set ${batchCount + 1}`,
        questions: [],
        timer_duration: null,
        template_id: null,
        cover_image_path: null,
      },
    };
    addItem(newBatch, null);
  };

  const handleAddSlide = () => {
    slideFileInputRef.current?.click();
  };

  const handleSlideFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlide(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.85,
        preserveExif: false,
      });

      const imagePath = await uploadSlideImage('templates', compressed);

      const newSlide: EditorItem = {
        id: nanoid(),
        item_type: 'slide',
        slide: { image_path: imagePath, caption: null },
      };
      addItem(newSlide, null);
    } catch (err) {
      console.error('Failed to upload slide image:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingSlide(false);
      if (slideFileInputRef.current) slideFileInputRef.current.value = '';
    }
  };

  const slideInput = (
    <input
      ref={slideFileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onChange={handleSlideFileSelect}
      className="hidden"
    />
  );

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-3 flex flex-col items-center justify-center space-y-3">
        {slideInput}
        <p className="text-gray-500 text-sm text-center">
          Add a question set or slide to get started
        </p>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={handleAddBatch}
            className="w-full px-4 py-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
          >
            + Question Set
          </button>
          <button
            onClick={handleAddSlide}
            disabled={uploadingSlide}
            className="w-full px-4 py-2 text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingSlide ? 'Uploading...' : '+ Add Slide'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-3">
      {slideInput}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div
            className="space-y-1"
            onClick={handleContainerClick}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault(); // Prevent text selection during shift-click
            }}
          >
            {items.map((item) => (
              <SidebarSequenceItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                isMultiSelected={isMultiSelected(item.id)}
                isDragging={item.id === activeId}
                onMultiSelect={(e) => handleMultiSelectClick(item.id, e)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId && multiSelectedIds.size > 1 && (
            <div className="bg-white border-2 border-indigo-400 rounded-lg p-2 shadow-lg opacity-90">
              <span className="text-indigo-600 text-sm font-medium">
                {multiSelectedIds.size} items
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleAddBatch}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
        >
          + Q. Set
        </button>
        <button
          onClick={handleAddSlide}
          disabled={uploadingSlide}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingSlide ? '...' : '+ Slide'}
        </button>
      </div>
    </div>
  );
}
