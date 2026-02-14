import { QRCodeSVG } from 'qrcode.react';

interface TeamQRGridProps {
  sessionId: string;
  teams: string[];
}

export function TeamQRGrid({ sessionId, teams }: TeamQRGridProps) {
  const baseUrl = window.location.origin;
  const generalUrl = `${baseUrl}/session/${sessionId}`;

  // Determine grid columns based on team count
  const gridCols = teams.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">
        Scan your team's QR code
      </h1>

      <div className={`grid ${gridCols} gap-6 max-w-4xl mb-8`}>
        {teams.map((teamName) => {
          const teamUrl = `${generalUrl}?team=${encodeURIComponent(teamName)}`;
          return (
            <div
              key={teamName}
              className="bg-white border-2 border-gray-200 rounded-xl p-6 flex flex-col items-center shadow-lg"
            >
              <QRCodeSVG
                value={teamUrl}
                size={200}
                level="M"
                marginSize={1}
              />
              <h2 className="text-2xl font-bold text-gray-900 mt-4">
                {teamName}
              </h2>
              <p className="text-xs text-gray-500 mt-2 text-center break-all">
                {teamUrl}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-300 pt-6 flex flex-col items-center">
        <p className="text-lg text-gray-600 mb-3">Or scan to choose your team</p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <QRCodeSVG
            value={generalUrl}
            size={120}
            level="M"
            marginSize={1}
          />
          <p className="text-xs text-gray-500 text-center mt-2">
            General session link
          </p>
        </div>
      </div>
    </div>
  );
}
