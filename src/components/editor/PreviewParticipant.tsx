import type { PreviewStep } from './SessionPreviewOverlay';

interface PreviewParticipantProps {
  step: PreviewStep;
}

export function PreviewParticipant({ step }: PreviewParticipantProps) {
  return (
    <div className="h-full flex items-center justify-center p-4">
      {/* Phone-like proportions container */}
      <div className="max-w-[320px] w-full h-full flex flex-col">
        <div className="bg-gray-50 rounded-lg flex-1 overflow-y-auto p-6">
          {step.type === 'slide' && step.item.item_type === 'slide' ? (
            // Waiting state for slides
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-gray-500 text-base">Waiting for presenter</p>
              <p className="text-gray-400 text-sm mt-2">
                The presenter is showing a slide
              </p>
            </div>
          ) : step.type === 'question' ? (
            // Voting mockup for a specific question
            <div className="space-y-4">
              {/* Question text */}
              <h2 className="text-lg font-semibold text-gray-900">
                {step.question.text || 'Untitled question'}
              </h2>

              {/* Progress indicator */}
              <div className="text-sm text-gray-500">
                Question {step.questionIndex + 1} of {step.totalQuestions}
              </div>

              {/* Vote buttons based on question type */}
              <div className="space-y-3 mt-6">
                {step.question.type === 'agree_disagree' ? (
                  <>
                    <button className="w-full bg-blue-500 text-white rounded-lg px-4 py-3.5 text-base font-medium shadow-sm">
                      Agree
                    </button>
                    <button className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-lg px-4 py-3 text-base font-medium">
                      Sometimes
                    </button>
                    <button className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-lg px-4 py-3 text-base font-medium">
                      Disagree
                    </button>
                  </>
                ) : step.question.type === 'multiple_choice' &&
                  step.question.options ? (
                  <>
                    {step.question.options.map((option, index) => (
                      <button
                        key={index}
                        className={`w-full rounded-lg px-4 py-3 text-base font-medium ${
                          index === 0
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white border-2 border-gray-300 text-gray-700'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </>
                ) : null}
              </div>

              {/* Vote confirmation */}
              <div className="mt-6 flex items-center justify-center gap-2 text-green-600 text-sm">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Your vote has been recorded</span>
              </div>
            </div>
          ) : (
            // Empty batch or unknown
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-base">No content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
