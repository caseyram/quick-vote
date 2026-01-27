interface ConnectionBannerProps {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status === 'connected' || status === 'connecting') return null;

  const isReconnecting = status === 'reconnecting';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium ${
        isReconnecting
          ? 'bg-yellow-900 text-yellow-200'
          : 'bg-red-900 text-red-200'
      }`}
    >
      {isReconnecting ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Reconnecting...
        </span>
      ) : (
        'Connection lost. Please refresh if this persists.'
      )}
    </div>
  );
}
