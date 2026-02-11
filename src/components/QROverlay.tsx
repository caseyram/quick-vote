import { QRCodeSVG } from 'qrcode.react';

export type QRMode = 'hidden' | 'corner' | 'fullscreen';

interface QROverlayProps {
  mode: QRMode;
  sessionUrl: string;
}

export function QROverlay({ mode, sessionUrl }: QROverlayProps) {
  if (mode === 'hidden') {
    return null;
  }

  if (mode === 'corner') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-lg p-3">
        <QRCodeSVG
          value={sessionUrl}
          size={120}
          level="M"
          marginSize={1}
        />
      </div>
    );
  }

  if (mode === 'fullscreen') {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center">
        <QRCodeSVG
          value={sessionUrl}
          size={Math.min(window.innerWidth, window.innerHeight) * 0.6}
          level="M"
          marginSize={1}
        />
        <p className="text-4xl text-gray-600 font-medium mt-8">
          Scan to join
        </p>
      </div>
    );
  }

  return null;
}
