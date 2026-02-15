import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { getSlideImageUrl } from '../../lib/slide-api';
import { SlideLightbox } from '../shared/SlideLightbox';

interface SidebarSequenceItemProps {
  item: EditorItem;
  isSelected: boolean;
  isMultiSelected?: boolean;
  isDragging: boolean;
  onMultiSelect?: (event: React.MouseEvent) => void;
}

export function SidebarSequenceItem({ item, isSelected, isMultiSelected = false, isDragging, onMultiSelect }: SidebarSequenceItemProps) {
  const { selectItem, removeItem } = useTemplateEditorStore();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onMultiSelect) {
      // Always notify multi-select hook (sets lastSelectedId for shift-click anchoring)
      onMultiSelect(e);
      // Also select item in store for editing panel (only on regular click)
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        selectItem(item.id);
      }
      return;
    }
    selectItem(item.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this item?')) {
      removeItem(item.id);
    }
  };

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  const renderContent = () => {
    if (item.item_type === 'batch' && item.batch) {
      const questionCount = item.batch.questions.length;
      return (
        <>
          {/* Batch icon */}
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {item.batch.name}
            </div>
            <div className="text-xs text-gray-500">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </div>
          </div>
        </>
      );
    } else if (item.item_type === 'slide' && item.slide) {
      const hasImage = item.slide.image_path && item.slide.image_path.trim() !== '';
      return (
        <>
          {/* Slide thumbnail or icon */}
          <div className="flex-shrink-0">
            {hasImage ? (
              <img
                src={getSlideImageUrl(item.slide.image_path)}
                alt="Slide"
                onClick={handleThumbnailClick}
                className="w-10 h-8 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-10 h-8 rounded bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {item.slide.caption || 'Untitled Slide'}
            </div>
            <div className="text-xs text-gray-500">
              {hasImage ? 'Image slide' : 'No image'}
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  const hasImage = item.item_type === 'slide' && item.slide?.image_path && item.slide.image_path.trim() !== '';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={handleClick}
        className={`
          group
          flex items-center gap-2 p-2 rounded border cursor-pointer transition-all
          ${isSelected
            ? 'bg-indigo-50 border-indigo-300 shadow-sm'
            : isMultiSelected
            ? 'bg-indigo-50 border-indigo-300'
            : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {renderContent()}

        {/* Delete button (visible on hover) */}
        <button
          onClick={handleDelete}
          className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
        >
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Lightbox for slide thumbnails */}
      {hasImage && item.slide && (
        <SlideLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          imageSrc={getSlideImageUrl(item.slide.image_path)}
          alt={item.slide.caption || 'Slide'}
        />
      )}
    </>
  );
}
