interface TeamFilterTabsProps {
  teams: string[];
  selectedTeam: string | null;
  onTeamChange: (team: string | null) => void;
  theme?: 'light' | 'dark';
}

export function TeamFilterTabs({
  teams,
  selectedTeam,
  onTeamChange,
  theme = 'light',
}: TeamFilterTabsProps) {
  // Don't render if no teams configured
  if (teams.length === 0) return null;

  const isDark = theme === 'dark';

  // Style classes based on theme
  const containerClass = isDark
    ? 'border-b border-gray-700'
    : 'border-b border-gray-200';

  const activeTabClass = isDark
    ? 'border-b-2 border-blue-400 text-blue-300 font-medium'
    : 'border-b-2 border-blue-500 text-blue-600 font-medium';

  const inactiveTabClass = isDark
    ? 'text-gray-400 hover:text-gray-200'
    : 'text-gray-500 hover:text-gray-700';

  return (
    <div className={`flex gap-1 overflow-x-auto ${containerClass} pb-1`}>
      {/* "All" tab */}
      <button
        onClick={() => onTeamChange(null)}
        className={`px-4 py-2 transition-colors whitespace-nowrap ${
          selectedTeam === null ? activeTabClass : inactiveTabClass
        }`}
      >
        All
      </button>

      {/* Individual team tabs */}
      {teams.map((teamName) => (
        <button
          key={teamName}
          onClick={() => onTeamChange(teamName)}
          className={`px-4 py-2 transition-colors whitespace-nowrap ${
            selectedTeam === teamName ? activeTabClass : inactiveTabClass
          }`}
        >
          {teamName}
        </button>
      ))}
    </div>
  );
}
