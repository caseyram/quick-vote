import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  visible: boolean;
}

export function SessionQRCode({ url, visible }: QRCodeProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white p-3 rounded-xl shadow-lg z-50">
      <QRCodeSVG
        value={url}
        size={120}
        level="M"
        marginSize={1}
      />
      <p className="text-xs text-gray-600 text-center mt-1 font-medium">
        Scan to join
      </p>
    </div>
  );
}
