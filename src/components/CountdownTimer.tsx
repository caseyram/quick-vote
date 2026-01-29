interface CountdownTimerProps {
  remainingSeconds: number;
  isRunning: boolean;
  size?: 'default' | 'large' | 'hero';
  theme?: 'dark' | 'light';
  showExpired?: boolean; // Show "Time!" when expired instead of hiding
}

export function CountdownTimer({
  remainingSeconds,
  isRunning,
  size = 'default',
  theme = 'dark',
  showExpired = false,
}: CountdownTimerProps) {
  const isExpired = remainingSeconds <= 0;

  // Hide if not running and not showing expired state
  if (!isRunning && !showExpired) return null;
  if (!isRunning && showExpired && !isExpired) return null;

  const isUrgent = remainingSeconds <= 5 && remainingSeconds > 0;
  const isLight = theme === 'light';

  let iconSize: number;
  let sizeClass: string;

  switch (size) {
    case 'hero':
      iconSize = 32;
      sizeClass = 'gap-3 px-6 py-3 rounded-2xl text-4xl font-bold';
      break;
    case 'large':
      iconSize = 24;
      sizeClass = 'gap-2 px-4 py-2 rounded-full text-2xl font-medium';
      break;
    default:
      iconSize = 16;
      sizeClass = 'gap-1.5 px-3 py-1 rounded-full text-sm font-medium';
  }

  let colorClass: string;
  if (isExpired) {
    colorClass = isLight
      ? 'bg-red-100 text-red-700 animate-pulse'
      : 'bg-red-900 text-red-300 animate-pulse';
  } else if (isUrgent) {
    colorClass = isLight
      ? 'bg-orange-100 text-orange-700 animate-pulse'
      : 'bg-orange-900 text-orange-300 animate-pulse';
  } else {
    colorClass = isLight
      ? 'bg-blue-100 text-blue-700'
      : 'bg-blue-900 text-blue-300';
  }

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
      {isExpired ? "Time!" : `${remainingSeconds}s`}
    </span>
  );
}
