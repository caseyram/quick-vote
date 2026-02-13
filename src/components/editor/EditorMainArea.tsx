import { nanoid } from 'nanoid';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { SlideEditor } from './SlideEditor';
import { BatchEditor } from './BatchEditor';

export function EditorMainArea() {
  const { items, selectedItemId, addItem } = useTemplateEditorStore();

  const selectedItem = items.find((item) => item.id === selectedItemId);

  const handleAddBatch = () => {
    const batchCount = items.filter((item) => item.item_type === 'batch').length;
    const newBatch: EditorItem = {
      id: nanoid(),
      item_type: 'batch',
      batch: {
        name: `Batch ${batchCount + 1}`,
        questions: [],
        timer_duration: null,
        template_id: null,
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

  // No item selected
  if (!selectedItem) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-6">
            Select an item from the sidebar, or add a new batch or slide
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAddBatch}
              className="px-6 py-3 text-base font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
            >
              + Add Batch
            </button>
            <button
              onClick={handleAddSlide}
              className="px-6 py-3 text-base font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-sm"
            >
              + Add Slide
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render selected item
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      {selectedItem.item_type === 'batch' ? (
        <BatchEditor item={selectedItem} />
      ) : (
        <SlideEditor item={selectedItem} />
      )}
    </div>
  );
}
