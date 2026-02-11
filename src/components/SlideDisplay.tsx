import { getSlideImageUrl } from '../lib/slide-api';

interface SlideDisplayProps {
  imagePath: string;
  caption?: string | null;
}

export function SlideDisplay({ imagePath, caption }: SlideDisplayProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      <img
        src={getSlideImageUrl(imagePath)}
        alt={caption || 'Slide'}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
