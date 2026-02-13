import type { PreviewStep } from './SessionPreviewOverlay';
import { MOCK_PARTICIPANT_COUNT } from './preview-mock-data';

interface PreviewControlsProps {
  steps: PreviewStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
}

export function PreviewControls({
  steps,
  currentStepIndex,
  onNext,
  onPrev,
  onGoTo,
}: PreviewControlsProps) {
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  return (
    <div className="h-full flex flex-col">
      {/* Navigation controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous (Arrow Left/Up)"
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
          {currentStepIndex + 1} of {steps.length}
        </div>

        <button
          onClick={onNext}
          disabled={isLast}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next (Arrow Right/Down)"
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
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;

          // Determine display info based on step type
          let label: string;
          let sublabel: string;
          let icon: 'slide' | 'question';
          let isNested = false;

          if (step.type === 'slide') {
            if (step.item.item_type === 'slide' && step.item.slide) {
              label = step.item.slide.caption
                ? `Slide: ${step.item.slide.caption.slice(0, 25)}${step.item.slide.caption.length > 25 ? '...' : ''}`
                : 'Slide';
              sublabel = 'Content Slide';
            } else {
              // Empty question set rendered as slide step
              label = step.item.batch?.name || 'Empty question set';
              sublabel = 'No questions';
            }
            icon = 'slide';
          } else {
            label = step.question.text
              ? step.question.text.slice(0, 40) + (step.question.text.length > 40 ? '...' : '')
              : 'Untitled question';
            sublabel = `Q${step.questionIndex + 1}/${step.totalQuestions} · ${step.question.type === 'agree_disagree' ? 'A/D' : 'MC'}`;
            icon = 'question';
            isNested = true;
          }

          // Show batch header before the first question in a batch
          const showBatchHeader = step.type === 'question' && step.questionIndex === 0;
          const batchName = step.type === 'question' ? step.item.batch?.name : null;

          return (
            <div key={index}>
              {showBatchHeader && (
                <div className="px-4 pt-3 pb-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {batchName}
                  </div>
                </div>
              )}
              <button
                onClick={() => onGoTo(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-l-4 transition-colors ${
                  isNested ? 'pl-8' : ''
                } ${
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
                  {icon === 'slide' ? (
                    <svg
                      className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
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
                      className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>

                {/* Label and sublabel */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}
                  >
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {sublabel}
                  </div>
                </div>
              </button>
            </div>
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
