import { useState } from 'react';

interface TeamPickerProps {
  teams: string[];
  onJoinTeam: (teamName: string) => void;
}

export function TeamPicker({ teams, onJoinTeam }: TeamPickerProps) {
  const [selectedTeam, setSelectedTeam] = useState('');

  const handleJoin = () => {
    if (selectedTeam) {
      onJoinTeam(selectedTeam);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold text-white text-center">Select Your Team</h2>

        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Choose a team...</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <button
          onClick={handleJoin}
          disabled={!selectedTeam}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          Join Team
        </button>
      </div>
    </div>
  );
}
