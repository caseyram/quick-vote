import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  visible: boolean;
  size?: number;
  mode?: 'overlay' | 'centered';
}

export function SessionQRCode({ url, visible, size = 120, mode = 'overlay' }: QRCodeProps) {
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

  return (
    <div className="fixed bottom-4 right-4 bg-white p-3 rounded-xl shadow-lg z-50">
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
