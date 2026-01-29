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

  // Default overlay mode - clickable to expand
  return (
    <div
      className="fixed bottom-18 right-4 bg-white p-3 rounded-xl shadow-lg z-50 cursor-pointer hover:shadow-xl transition-shadow"
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
  );
}
