import type { EditorItem } from '../../stores/template-editor-store';
import { MOCK_PARTICIPANT_COUNT } from './preview-mock-data';

interface PreviewControlsProps {
  items: EditorItem[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
}

export function PreviewControls({
  items,
  currentIndex,
  onNext,
  onPrev,
  onGoTo,
}: PreviewControlsProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  return (
    <div className="h-full flex flex-col">
      {/* Navigation controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous item (Arrow Left/Up)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="text-sm text-gray-600 font-medium">
          Item {currentIndex + 1} of {items.length}
        </div>

        <button
          onClick={onNext}
          disabled={isLast}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next item (Arrow Right/Down)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Sequence list */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item, index) => {
          const isActive = index === currentIndex;
          const itemName =
            item.item_type === 'batch' && item.batch
              ? item.batch.name
              : item.item_type === 'slide' && item.slide
                ? item.slide.caption
                  ? `Slide: ${item.slide.caption.slice(0, 30)}${item.slide.caption.length > 30 ? '...' : ''}`
                  : 'Slide'
                : 'Unknown';

          return (
            <button
              key={item.id}
              onClick={() => onGoTo(index)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-l-4 transition-colors ${
                isActive
                  ? 'bg-indigo-50 border-indigo-500'
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              {/* Position number */}
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>

              {/* Icon */}
              <div className="flex-shrink-0">
                {item.item_type === 'slide' ? (
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                ) : (
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                )}
              </div>

              {/* Item name and type */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}
                >
                  {itemName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.item_type === 'batch' && item.batch
                    ? `${item.batch.questions.length} question${item.batch.questions.length !== 1 ? 's' : ''}`
                    : 'Content Slide'}
                </div>
              </div>

              {/* Type badge */}
              <div
                className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                  item.item_type === 'batch'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}
              >
                {item.item_type === 'batch' ? 'Batch' : 'Slide'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Mock session info */}
      <div className="bg-gray-50 rounded-lg p-3 m-4 mt-0 text-sm text-gray-600 space-y-1">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span>{MOCK_PARTICIPANT_COUNT} participants connected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>Session: Active</span>
        </div>
      </div>
    </div>
  );
}
