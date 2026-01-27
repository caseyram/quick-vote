interface VoteConfirmationProps {
  visible: boolean;
  value: string;
}

export default function VoteConfirmation({ visible, value }: VoteConfirmationProps) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-lg transition-opacity duration-300 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <svg
        className="w-16 h-16 text-green-400 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <p className="text-white text-xl font-semibold">Locked in!</p>
      <p className="text-gray-400 text-sm mt-1">{value}</p>
    </div>
  );
}
