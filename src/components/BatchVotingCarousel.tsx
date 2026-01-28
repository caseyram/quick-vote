import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import VoteAgreeDisagree from './VoteAgreeDisagree';
import VoteMultipleChoice from './VoteMultipleChoice';
import type { Question } from '../types/database';

interface BatchVotingCarouselProps {
  questions: Question[];
  sessionId: string;
  participantId: string;
  displayName: string | null;
  reasonsEnabled: boolean;
  onComplete: () => void;
}

// Slide transition variants matching ParticipantSession
const slideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
};

const slideTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

export function BatchVotingCarousel({
  questions,
  sessionId,
  participantId,
  displayName,
  reasonsEnabled,
  onComplete,
}: BatchVotingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQuestion = questions[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmitBatch = () => {
    onComplete();
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="h-dvh bg-gray-950 flex flex-col overflow-hidden">
      {/* Progress indicator - text counter at top */}
      <div className="px-4 py-3 text-center">
        <p className="text-gray-400 text-sm font-medium">
          Question {currentIndex + 1} of {questions.length}
        </p>
      </div>

      {/* Question area with slide transitions */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col lg:items-center lg:justify-center lg:p-8">
          <div className="flex-1 flex flex-col lg:flex-initial lg:w-full lg:max-w-2xl lg:rounded-2xl lg:bg-gray-900/50 lg:overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentQuestion.id}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="flex-1 flex flex-col"
              >
                {currentQuestion.type === 'agree_disagree' ? (
                  <VoteAgreeDisagree
                    question={currentQuestion}
                    sessionId={sessionId}
                    participantId={participantId}
                    displayName={displayName}
                    reasonsEnabled={reasonsEnabled}
                  />
                ) : (
                  <VoteMultipleChoice
                    question={currentQuestion}
                    sessionId={sessionId}
                    participantId={participantId}
                    displayName={displayName}
                    reasonsEnabled={reasonsEnabled}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Navigation footer - fixed at bottom */}
      <div className="px-4 py-4 flex gap-3 bg-gray-950">
        <button
          onClick={handlePrevious}
          disabled={isFirstQuestion}
          className="px-6 py-3 rounded-xl font-semibold bg-gray-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          aria-label={isFirstQuestion ? 'No previous question' : 'Go to previous question'}
        >
          Previous
        </button>

        {isLastQuestion ? (
          <button
            onClick={handleSubmitBatch}
            className="flex-1 px-6 py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Complete Batch
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
