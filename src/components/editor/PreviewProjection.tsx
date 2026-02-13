import { motion, AnimatePresence } from 'motion/react';
import type { PreviewStep } from './SessionPreviewOverlay';
import { BarChart } from '../BarChart';
import { getSlideImageUrl } from '../../lib/slide-api';
import { generateMockVotes, MOCK_TOTAL_VOTES } from './preview-mock-data';

interface PreviewProjectionProps {
  step: PreviewStep;
}

const crossfadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

function stepKey(step: PreviewStep) {
  if (step.type === 'question') return `${step.item.id}-q${step.questionIndex}`;
  return step.item.id;
}

export function PreviewProjection({ step }: PreviewProjectionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey(step)}
        variants={crossfadeVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="h-full w-full flex items-center justify-center bg-white p-8"
      >
        {step.type === 'slide' && step.item.item_type === 'slide' && step.item.slide ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            {step.item.slide.image_path ? (
              <>
                <img
                  src={getSlideImageUrl(step.item.slide.image_path)}
                  alt={step.item.slide.caption || 'Slide'}
                  className="max-h-full max-w-full object-contain"
                  style={{ maxHeight: 'calc(100% - 3rem)' }}
                />
                {step.item.slide.caption && (
                  <p className="text-gray-800 text-xl mt-4 text-center">
                    {step.item.slide.caption}
                  </p>
                )}
              </>
            ) : (
              <div className="text-gray-400 text-lg">No image</div>
            )}
          </div>
        ) : step.type === 'question' ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {step.item.batch?.name}
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              Question {step.questionIndex + 1} of {step.totalQuestions}
            </p>
            <div className="flex flex-col items-center w-full max-w-4xl">
              <p className="text-xl text-gray-700 mb-6 text-center">
                {step.question.text || 'Untitled question'}
              </p>
              <div className="w-full" style={{ height: 300 }}>
                <BarChart
                  data={generateMockVotes(
                    step.question.type,
                    step.question.options
                  )}
                  theme="light"
                  size="default"
                />
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Total: {MOCK_TOTAL_VOTES} votes
              </p>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-lg">No content</div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
