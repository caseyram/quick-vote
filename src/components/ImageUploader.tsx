import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { uploadSlideImage } from '../lib/slide-api';
import { Upload } from 'lucide-react';

interface ImageUploaderProps {
  sessionId: string;
  onUploaded: (imagePath: string) => void;
  disabled?: boolean;
}

type UploadStatus = 'idle' | 'validating' | 'compressing' | 'uploading' | 'error';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUploader({ sessionId, onUploaded, disabled = false }: ImageUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const validateFile = async (file: File): Promise<boolean> => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload JPEG, PNG, WebP, or GIF images only.');
      return false;
    }

    // Reject SVG explicitly (security risk)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setError('SVG files are not allowed for security reasons.');
      return false;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return false;
    }

    // Validate it's a real image by loading it
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError('File is not a valid image.');
        resolve(false);
      };

      img.src = objectUrl;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setError(null);
    cleanupPreview();

    // Show preview
    const previewObjectUrl = URL.createObjectURL(file);
    setPreviewUrl(previewObjectUrl);

    // Validate
    setStatus('validating');
    const isValid = await validateFile(file);
    if (!isValid) {
      setStatus('error');
      cleanupPreview();
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Compress
    setStatus('compressing');
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp' as const,
        initialQuality: 0.85,
        preserveExif: false,
      };

      const compressed = await imageCompression(file, options);

      // Upload
      setStatus('uploading');
      const imagePath = await uploadSlideImage(sessionId, compressed);

      // Success
      setStatus('idle');
      cleanupPreview();
      onUploaded(imagePath);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
      cleanupPreview();
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const isLoading = status === 'validating' || status === 'compressing' || status === 'uploading';

  const getStatusText = () => {
    switch (status) {
      case 'validating':
        return 'Validating...';
      case 'compressing':
        return 'Compressing...';
      case 'uploading':
        return 'Uploading...';
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isLoading}
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="w-4 h-4" />
        {isLoading ? getStatusText() : 'Upload Image'}
      </button>

      {previewUrl && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-12 h-12 object-cover rounded"
          />
          <span className="text-sm text-gray-600">Selected image</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
