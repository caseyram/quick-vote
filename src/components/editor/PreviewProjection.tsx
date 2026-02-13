import { motion, AnimatePresence } from 'motion/react';
import type { EditorItem } from '../../stores/template-editor-store';
import { BarChart } from '../BarChart';
import { getSlideImageUrl } from '../../lib/slide-api';
import { generateMockVotes, MOCK_TOTAL_VOTES } from './preview-mock-data';

interface PreviewProjectionProps {
  item: EditorItem;
}

const crossfadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export function PreviewProjection({ item }: PreviewProjectionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        variants={crossfadeVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="h-full w-full flex items-center justify-center bg-white p-8"
      >
        {item.item_type === 'slide' && item.slide ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            {item.slide.image_path ? (
              <>
                <img
                  src={getSlideImageUrl(item.slide.image_path)}
                  alt={item.slide.caption || 'Slide'}
                  className="max-h-full max-w-full object-contain"
                  style={{ maxHeight: 'calc(100% - 3rem)' }}
                />
                {item.slide.caption && (
                  <p className="text-gray-800 text-xl mt-4 text-center">
                    {item.slide.caption}
                  </p>
                )}
              </>
            ) : (
              <div className="text-gray-400 text-lg">No image</div>
            )}
          </div>
        ) : item.item_type === 'batch' && item.batch ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">
              {item.batch.name}
            </h2>
            {item.batch.questions.length > 0 ? (
              <div className="flex flex-col items-center w-full max-w-4xl">
                <p className="text-xl text-gray-700 mb-6 text-center">
                  {item.batch.questions[0].text}
                </p>
                <div className="w-full" style={{ height: 300 }}>
                  <BarChart
                    data={generateMockVotes(
                      item.batch.questions[0].type,
                      item.batch.questions[0].options
                    )}
                    theme="light"
                    size="default"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Total: {MOCK_TOTAL_VOTES} votes
                </p>
              </div>
            ) : (
              <div className="text-gray-400 text-lg">No questions in this batch</div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-lg">No content</div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
