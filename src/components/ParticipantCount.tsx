interface ParticipantCountProps {
  count: number;
  size?: 'default' | 'large';
}

export function ParticipantCount({ count, size = 'default' }: ParticipantCountProps) {
  const isActive = count > 0;
  const isLarge = size === 'large';

  return (
    <span
      className={`inline-flex items-center ${
        isLarge
          ? 'gap-3 text-4xl font-bold text-gray-700'
          : 'gap-2 text-sm text-gray-300'
      }`}
    >
      <span
        className={`rounded-full ${
          isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        } ${isLarge ? 'w-3 h-3' : 'w-1.5 h-1.5'}`}
      />
      {count} {isLarge ? 'participants connected' : 'connected'}
    </span>
  );
}
