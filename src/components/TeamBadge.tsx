interface TeamBadgeProps {
  teamName: string;
}

export function TeamBadge({ teamName }: TeamBadgeProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-indigo-600/80 text-white px-3 py-1 rounded-full text-sm font-medium z-40">
      {teamName}
    </div>
  );
}
