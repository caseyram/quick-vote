interface CountdownTimerProps {
  remainingSeconds: number;
  isRunning: boolean;
}

export function CountdownTimer({ remainingSeconds, isRunning }: CountdownTimerProps) {
  if (!isRunning) return null;

  const isUrgent = remainingSeconds <= 5;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
        isUrgent
          ? 'bg-red-900 text-red-300 animate-pulse'
          : 'bg-gray-800 text-gray-300'
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {remainingSeconds}s
    </span>
  );
}
