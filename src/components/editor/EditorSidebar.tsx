import { useState, useId } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { nanoid } from 'nanoid';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { SidebarSequenceItem } from './SidebarSequenceItem';

export function EditorSidebar() {
  const { items, selectedItemId, reorderItems, addItem } = useTemplateEditorStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    reorderItems(oldIndex, newIndex);
  };

  const handleAddBatch = () => {
    const batchCount = items.filter((item) => item.item_type === 'batch').length;
    const newBatch: EditorItem = {
      id: nanoid(),
      item_type: 'batch',
      batch: {
        name: `Batch ${batchCount + 1}`,
        questions: [],
        timer_duration: null,
      },
    };
    addItem(newBatch, null);
  };

  const handleAddSlide = () => {
    const newSlide: EditorItem = {
      id: nanoid(),
      item_type: 'slide',
      slide: {
        image_path: '',
        caption: null,
      },
    };
    addItem(newSlide, null);
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-3 flex flex-col items-center justify-center space-y-3">
        <p className="text-gray-500 text-sm text-center">
          Add a batch or slide to get started
        </p>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={handleAddBatch}
            className="w-full px-4 py-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
          >
            + Add Batch
          </button>
          <button
            onClick={handleAddSlide}
            className="w-full px-4 py-2 text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors"
          >
            + Add Slide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-3">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item) => (
              <SidebarSequenceItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                isDragging={item.id === activeId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
