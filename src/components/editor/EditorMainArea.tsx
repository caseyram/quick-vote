import { useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import imageCompression from 'browser-image-compression';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { uploadSlideImage } from '../../lib/slide-api';
import { SlideEditor } from './SlideEditor';
import { BatchEditor } from './BatchEditor';

export function EditorMainArea() {
  const { items, selectedItemId, addItem } = useTemplateEditorStore();
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const slideFileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((item) => item.id === selectedItemId);

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
        slide: { image_path: imagePath, caption: null, notes: null },
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

  // No item selected
  if (!selectedItem) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <input
          ref={slideFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleSlideFileSelect}
          className="hidden"
        />
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-6">
            Select an item from the sidebar, or add a new question set or slide
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAddBatch}
              className="px-6 py-3 text-base font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
            >
              + Question Set
            </button>
            <button
              onClick={handleAddSlide}
              disabled={uploadingSlide}
              className="px-6 py-3 text-base font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingSlide ? 'Uploading...' : '+ Add Slide'}
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
