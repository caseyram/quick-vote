import { QRCodeSVG } from 'qrcode.react';

interface TeamQRGridProps {
  sessionId: string;
  teams: string[];
  onClose: () => void;
  participantUrl: string;
  linkCopied: boolean;
  onCopyLink: () => void;
}

export function TeamQRGrid({ sessionId, teams, onClose, participantUrl, linkCopied, onCopyLink }: TeamQRGridProps) {
  const baseUrl = window.location.origin;

  // All teams + general "Any Team" QR in one row
  const allCodes = [
    ...teams.map((name) => ({
      label: name,
      url: `${baseUrl}/session/${sessionId}?team=${encodeURIComponent(name)}`,
    })),
    {
      label: 'Any Team',
      url: participantUrl,
    },
  ];

  // Scale QR size to fill the screen — these are fullscreen overlays
  const count = allCodes.length;
  const qrSize = count <= 3 ? 280 : count <= 4 ? 240 : 180;

  return (
    <div
      className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Scan your team's QR code
      </h1>

      <div className="flex items-start justify-center gap-8 px-8">
        {allCodes.map(({ label, url }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-lg">
              <QRCodeSVG value={url} size={qrSize} level="M" marginSize={1} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">{label}</h2>
          </div>
        ))}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopyLink();
        }}
        className="mt-8 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
      >
        {linkCopied ? (
          <>
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            Copy Link
          </>
        )}
      </button>
      <p className="text-sm text-gray-400 mt-2">Click anywhere to close</p>
    </div>
  );
}
