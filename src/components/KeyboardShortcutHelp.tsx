import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface KeyboardShortcutHelpProps {
  visible: boolean;
  onClose: () => void;
}

export function KeyboardShortcutHelp({ visible, onClose }: KeyboardShortcutHelpProps) {
  // Handle keyboard events when overlay is visible
  useEffect(() => {
    if (!visible) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === '?') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Keyboard Shortcuts</h2>

              <div className="space-y-4">
                <ShortcutRow
                  keys={['Space', 'Right Arrow']}
                  description="Next item"
                />
                <ShortcutRow
                  keys={['Left Arrow']}
                  description="Previous item"
                />
                <ShortcutRow
                  keys={['F']}
                  description="Toggle fullscreen"
                />
                <ShortcutRow
                  keys={['Esc']}
                  description="Exit fullscreen"
                />
                <ShortcutRow
                  keys={['B']}
                  description="Black screen"
                />
                <ShortcutRow
                  keys={['?']}
                  description="Show/hide this help"
                />
              </div>

              <p className="text-sm text-gray-500 text-center mt-6">
                Press Esc or ? to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {keys.map((key, index) => (
          <span key={index}>
            {index > 0 && <span className="text-gray-400 mx-1">or</span>}
            <kbd className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded font-mono text-sm font-semibold text-gray-800">
              {key}
            </kbd>
          </span>
        ))}
      </div>
      <span className="text-gray-600 ml-4">{description}</span>
    </div>
  );
}
