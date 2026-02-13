import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import { PreviewProjection } from './PreviewProjection';
import { PreviewControls } from './PreviewControls';
import { PreviewParticipant } from './PreviewParticipant';

interface SessionPreviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  startIndex: number;
}

export function SessionPreviewOverlay({
  isOpen,
  onClose,
  startIndex,
}: SessionPreviewOverlayProps) {
  const items = useTemplateEditorStore((s) => s.items);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  // Reset currentIndex when startIndex changes
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  const currentItem = items[currentIndex];

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea/select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Skip repeated keydown events
      if (e.repeat) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          handlePrev();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items.length, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-gray-50 z-50 flex flex-col"
        >
          {/* Header bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <div className="text-lg font-semibold text-gray-800">Session Preview</div>
            {items.length > 0 && (
              <div className="text-sm text-gray-600">
                {currentIndex + 1} of {items.length}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Close preview (Esc)"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Three-panel layout */}
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
              No items to preview
            </div>
          ) : (
            <div className="flex flex-1 gap-4 p-4 overflow-hidden">
              {/* Projection View */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Projection View
                </div>
                <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
                  <PreviewProjection item={currentItem} />
                </div>
              </div>

              {/* Admin Controls */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Admin Controls
                </div>
                <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
                  <PreviewControls
                    items={items}
                    currentIndex={currentIndex}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onGoTo={(index) => setCurrentIndex(index)}
                  />
                </div>
              </div>

              {/* Participant View */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Participant View
                </div>
                <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
                  <PreviewParticipant item={currentItem} />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
