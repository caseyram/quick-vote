import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem, EditorQuestion } from '../../stores/template-editor-store';
import { PreviewProjection } from './PreviewProjection';
import { PreviewControls } from './PreviewControls';
import { PreviewParticipant } from './PreviewParticipant';

export type PreviewStep =
  | { type: 'slide'; itemIndex: number; item: EditorItem }
  | { type: 'question'; itemIndex: number; questionIndex: number; item: EditorItem; question: EditorQuestion; totalQuestions: number };

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
  const backgroundColor = useTemplateEditorStore((s) => s.backgroundColor);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);

  // Flatten items into individual steps (each question is its own step)
  const steps = useMemo(() => {
    const result: PreviewStep[] = [];
    items.forEach((item, itemIndex) => {
      if (item.item_type === 'slide') {
        result.push({ type: 'slide', itemIndex, item });
      } else if (item.item_type === 'batch' && item.batch) {
        if (item.batch.questions.length === 0) {
          // Empty batch — still show as a step
          result.push({ type: 'slide', itemIndex, item });
        } else {
          item.batch.questions.forEach((question, questionIndex) => {
            result.push({
              type: 'question',
              itemIndex,
              questionIndex,
              item,
              question,
              totalQuestions: item.batch!.questions.length,
            });
          });
        }
      }
    });
    return result;
  }, [items]);

  // Find the step index for a given item index (used for startIndex)
  const stepIndexForItem = useMemo(() => {
    const map = new Map<number, number>();
    steps.forEach((step, i) => {
      if (!map.has(step.itemIndex)) {
        map.set(step.itemIndex, i);
      }
    });
    return map;
  }, [steps]);

  // Reset step when startIndex changes
  useEffect(() => {
    const target = stepIndexForItem.get(startIndex) ?? 0;
    setCurrentStepIndex(target);
  }, [startIndex, stepIndexForItem]);

  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setDirection('forward');
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setDirection('backward');
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

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
  }, [isOpen, currentStepIndex, steps.length, onClose]);

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
            {steps.length > 0 && (
              <div className="text-sm text-gray-600">
                {currentStepIndex + 1} of {steps.length}
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
          {steps.length === 0 ? (
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
                  <PreviewProjection
                    step={currentStep}
                    direction={direction}
                    backgroundColor={backgroundColor ?? '#1a1a2e'}
                  />
                </div>
              </div>

              {/* Admin Controls */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Admin Controls
                </div>
                <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
                  <PreviewControls
                    steps={steps}
                    currentStepIndex={currentStepIndex}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onGoTo={(index) => setCurrentStepIndex(index)}
                  />
                </div>
              </div>

              {/* Participant View */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Participant View
                </div>
                <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
                  <PreviewParticipant step={currentStep} />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
