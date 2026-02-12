import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface SlideLightboxProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  alt?: string;
}

export function SlideLightbox({ open, onClose, imageSrc, alt }: SlideLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={[{ src: imageSrc, alt: alt }]}
    />
  );
}
