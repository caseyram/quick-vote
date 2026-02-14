import { motion, AnimatePresence } from 'motion/react';
import type { PreviewStep } from './SessionPreviewOverlay';
import { BarChart } from '../BarChart';
import { getSlideImageUrl } from '../../lib/slide-api';
import { generateMockVotes, MOCK_TOTAL_VOTES } from './preview-mock-data';
import { getTextColor } from '../../lib/color-contrast';

interface PreviewProjectionProps {
  step: PreviewStep;
  direction?: 'forward' | 'backward' | null;
  backgroundColor?: string;
}

const slideVariants = {
  enter: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '100%' : direction === 'backward' ? '-100%' : 0,
    opacity: direction ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '-100%' : direction === 'backward' ? '100%' : 0,
    opacity: direction ? 0 : 1,
  }),
};

function stepKey(step: PreviewStep) {
  if (step.type === 'question') return `${step.item.id}-q${step.questionIndex}`;
  return step.item.id;
}

export function PreviewProjection({ step, direction = null, backgroundColor = '#1a1a2e' }: PreviewProjectionProps) {
  const textMode = getTextColor(backgroundColor);
  const textColorClass = textMode === 'light' ? 'text-white' : 'text-gray-900';
  const secondaryTextClass = textMode === 'light' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={stepKey(step)}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
          className={`h-full w-full absolute inset-0 flex items-center justify-center p-8 ${textColorClass}`}
          style={{ backgroundColor }}
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
                  <p className={`${textColorClass} text-xl mt-4 text-center`}>
                    {step.item.slide.caption}
                  </p>
                )}
              </>
            ) : (
              <div className={secondaryTextClass}>No image</div>
            )}
          </div>
        ) : step.type === 'question' ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <h2 className={`text-3xl font-bold ${textColorClass} mb-2`}>
              {step.item.batch?.name}
            </h2>
            <p className={`text-sm ${secondaryTextClass} mb-8`}>
              Question {step.questionIndex + 1} of {step.totalQuestions}
            </p>
            <div className="flex flex-col items-center w-full max-w-4xl">
              <p className={`text-xl ${textColorClass} mb-6 text-center`}>
                {step.question.text || 'Untitled question'}
              </p>
              <div className="w-full" style={{ height: 300 }}>
                <BarChart
                  data={generateMockVotes(
                    step.question.type,
                    step.question.options
                  )}
                  backgroundColor={backgroundColor}
                  size="default"
                />
              </div>
              <p className={`text-sm ${secondaryTextClass} mt-4`}>
                Total: {MOCK_TOTAL_VOTES} votes
              </p>
            </div>
          </div>
        ) : (
          <div className={secondaryTextClass}>No content</div>
        )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
