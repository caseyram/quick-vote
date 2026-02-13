import type { EditorItem } from '../../stores/template-editor-store';

interface PreviewParticipantProps {
  item: EditorItem;
}

export function PreviewParticipant({ item }: PreviewParticipantProps) {
  return (
    <div className="h-full flex items-center justify-center p-4">
      {/* Phone-like proportions container */}
      <div className="max-w-[320px] w-full h-full flex flex-col">
        <div className="bg-gray-50 rounded-lg flex-1 overflow-y-auto p-6">
          {item.item_type === 'slide' ? (
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
          ) : item.item_type === 'batch' && item.batch ? (
            item.batch.questions.length > 0 ? (
              // Static voting mockup
              <div className="space-y-4">
                {/* Question text */}
                <h2 className="text-lg font-semibold text-gray-900">
                  {item.batch.questions[0].text}
                </h2>

                {/* Progress indicator */}
                <div className="text-sm text-gray-500">
                  Question 1 of {item.batch.questions.length}
                </div>

                {/* Vote buttons based on question type */}
                <div className="space-y-3 mt-6">
                  {item.batch.questions[0].type === 'agree_disagree' ? (
                    <>
                      {/* Agree - selected state */}
                      <button className="w-full bg-blue-500 text-white rounded-lg px-4 py-3.5 text-base font-medium shadow-sm">
                        Agree
                      </button>
                      {/* Sometimes - outline */}
                      <button className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-lg px-4 py-3 text-base font-medium">
                        Sometimes
                      </button>
                      {/* Disagree - outline */}
                      <button className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-lg px-4 py-3 text-base font-medium">
                        Disagree
                      </button>
                    </>
                  ) : item.batch.questions[0].type === 'multiple_choice' &&
                    item.batch.questions[0].options ? (
                    <>
                      {item.batch.questions[0].options.map((option, index) => (
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
              // Empty batch
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-base">No questions available</p>
              </div>
            )
          ) : (
            // Fallback
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-base">No content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
