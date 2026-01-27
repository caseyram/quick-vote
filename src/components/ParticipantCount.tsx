interface ParticipantCountProps {
  count: number;
}

export function ParticipantCount({ count }: ParticipantCountProps) {
  const isActive = count > 0;

  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-300">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        }`}
      />
      {count} connected
    </span>
  );
}
