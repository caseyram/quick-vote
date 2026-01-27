import { motion, AnimatePresence } from 'motion/react';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';

interface ConnectionPillProps {
  status: ConnectionStatus;
}

export function ConnectionPill({ status }: ConnectionPillProps) {
  const isConnected = status === 'connected';
  const isDisconnected = status === 'disconnected';
  const isReconnecting = status === 'reconnecting';

  const showLabel = isDisconnected || isReconnecting;
  const label = isDisconnected ? 'Disconnected' : 'Reconnecting';

  const pillClassName = isDisconnected
    ? 'bg-red-900/90 text-red-200'
    : isReconnecting
      ? 'bg-yellow-900/90 text-yellow-200'
      : 'bg-gray-800/80 text-gray-400';

  const dotClassName = isConnected
    ? 'bg-green-400'
    : isDisconnected
      ? 'bg-red-400'
      : 'bg-yellow-400';

  return (
    <div className="fixed top-3 right-3 z-50">
      <motion.div
        layout
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pillClassName}`}
      >
        {/* Animated status dot */}
        <motion.span
          className={`block w-2 h-2 rounded-full ${dotClassName}`}
          animate={isConnected ? { scale: [1, 1.3, 1] } : {}}
          transition={
            isConnected
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : undefined
          }
        />

        {/* Conditional text label with animated width */}
        <AnimatePresence>
          {showLabel && (
            <motion.span
              key="label"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
