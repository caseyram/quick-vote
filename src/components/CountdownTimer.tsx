interface CountdownTimerProps {
  remainingSeconds: number;
  isRunning: boolean;
  size?: 'default' | 'large';
  theme?: 'dark' | 'light';
}

export function CountdownTimer({
  remainingSeconds,
  isRunning,
  size = 'default',
  theme = 'dark',
}: CountdownTimerProps) {
  if (!isRunning) return null;

  const isUrgent = remainingSeconds <= 5;
  const isLarge = size === 'large';
  const isLight = theme === 'light';

  const iconSize = isLarge ? 24 : 16;

  let colorClass: string;
  if (isUrgent) {
    colorClass = isLight
      ? 'bg-red-100 text-red-700 animate-pulse'
      : 'bg-red-900 text-red-300 animate-pulse';
  } else {
    colorClass = isLight
      ? 'bg-gray-100 text-gray-700'
      : 'bg-gray-800 text-gray-300';
  }

  const sizeClass = isLarge
    ? 'gap-2 px-4 py-2 rounded-full text-2xl font-medium'
    : 'gap-1.5 px-3 py-1 rounded-full text-sm font-medium';

  return (
    <span className={`inline-flex items-center ${sizeClass} ${colorClass}`}>
      <svg
        width={iconSize}
        height={iconSize}
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
