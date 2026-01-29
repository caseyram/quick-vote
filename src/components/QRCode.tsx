import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  visible: boolean;
  size?: number;
  mode?: 'overlay' | 'centered';
}

export function SessionQRCode({ url, visible, size = 120, mode = 'overlay' }: QRCodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  if (!visible) return null;

  if (mode === 'centered') {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          marginSize={1}
        />
      </div>
    );
  }

  // Fullscreen expanded mode
  if (isExpanded) {
    return (
      <div
        className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center cursor-pointer"
        onClick={() => setIsExpanded(false)}
      >
        <QRCodeSVG
          value={url}
          size={Math.min(window.innerWidth, window.innerHeight) * 0.7}
          level="M"
          marginSize={1}
        />
        <p className="text-2xl text-gray-600 text-center mt-6 font-medium">
          Scan to join
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Tap anywhere to close
        </p>
      </div>
    );
  }

  // Hidden state — show a small toggle to bring it back
  if (isHidden) {
    return (
      <button
        onClick={() => setIsHidden(false)}
        className="fixed bottom-18 right-4 bg-white p-2 rounded-lg shadow-lg z-50 hover:shadow-xl transition-shadow text-gray-400 hover:text-gray-600"
        title="Show QR code"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
    );
  }

  // Default overlay mode - clickable to expand, with hide button
  return (
    <div className="fixed bottom-18 right-4 z-50">
      <button
        onClick={(e) => { e.stopPropagation(); setIsHidden(true); }}
        className="absolute -top-2 -left-2 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
        title="Hide QR code"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div
        className="bg-white p-3 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
        onClick={() => setIsExpanded(true)}
        title="Click to enlarge"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          marginSize={1}
        />
        <p className="text-xs text-gray-600 text-center mt-1 font-medium">
          Scan to join
        </p>
      </div>
    </div>
  );
}
