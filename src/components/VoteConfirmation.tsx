import { motion, AnimatePresence } from 'motion/react';

interface VoteConfirmationProps {
  visible: boolean;
  value: string;
}

export default function VoteConfirmation({ visible, value }: VoteConfirmationProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-lg z-10"
        >
          {/* Checkmark with draw-in animation */}
          <motion.svg
            className="w-16 h-16 text-green-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </motion.svg>
          <p className="text-white text-xl font-semibold">Locked in!</p>
          <p className="text-gray-400 text-sm mt-1">{value}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
