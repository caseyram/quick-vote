import { useState, useEffect } from 'react';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import { getSlideImageUrl } from '../../lib/slide-api';

export function PreviewMode() {
  const { items } = useTemplateEditorStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1));
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No items to preview</h3>
          <p className="text-gray-500">Add batches or slides in Edit mode.</p>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  return (
    <div className="flex-1 bg-white flex flex-col">
      {/* Main content area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          {currentItem.item_type === 'batch' && currentItem.batch ? (
            // Batch preview - formatted like it would appear live
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">{currentItem.batch.name}</h2>

              {currentItem.batch.questions.length === 0 ? (
                <p className="text-gray-500 italic">No questions in this batch</p>
              ) : (
                <div className="space-y-4">
                  {currentItem.batch.questions.map((question, idx) => (
                    <div key={question.id} className="border-l-4 border-indigo-400 pl-4 py-2">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium mb-2">{question.text}</p>
                          <div className="flex items-center gap-2">
                            <span className={`
                              inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                              ${question.type === 'yes_no' ? 'bg-green-100 text-green-800' : ''}
                              ${question.type === 'thumbs' ? 'bg-blue-100 text-blue-800' : ''}
                              ${question.type === 'scale_1_10' ? 'bg-purple-100 text-purple-800' : ''}
                              ${question.type === 'multiple_choice' ? 'bg-yellow-100 text-yellow-800' : ''}
                            `}>
                              {question.type === 'yes_no' && 'Yes/No'}
                              {question.type === 'thumbs' && 'Thumbs'}
                              {question.type === 'scale_1_10' && 'Scale 1-10'}
                              {question.type === 'multiple_choice' && 'Multiple Choice'}
                            </span>
                            {question.anonymous && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                Anonymous
                              </span>
                            )}
                          </div>
                          {question.type === 'multiple_choice' && question.options && question.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {question.options.map((option, optIdx) => (
                                <div key={optIdx} className="text-sm text-gray-600 flex items-center gap-2">
                                  <span className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  {option}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentItem.item_type === 'slide' && currentItem.slide ? (
            // Slide preview
            <div className="space-y-4 text-center">
              {currentItem.slide.image_path ? (
                <img
                  src={getSlideImageUrl(currentItem.slide.image_path)}
                  alt={currentItem.slide.caption || 'Slide'}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400">No image</p>
                  </div>
                </div>
              )}
              {currentItem.slide.caption && (
                <p className="text-lg text-gray-700 font-medium">{currentItem.slide.caption}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Navigation bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={isFirst}
          className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <div className="text-sm text-gray-600 font-medium">
          {currentIndex + 1} of {items.length}
        </div>

        <button
          onClick={handleNext}
          disabled={isLast}
          className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
