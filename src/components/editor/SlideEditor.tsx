import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { uploadSlideImage, getSlideImageUrl } from '../../lib/slide-api';

interface SlideEditorProps {
  item: EditorItem;
}

export function SlideEditor({ item }: SlideEditorProps) {
  const { updateItem } = useTemplateEditorStore();
  const [uploading, setUploading] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!item.slide) return null;

  const hasImage = item.slide.image_path && item.slide.image_path.trim() !== '';

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value.trim() || null;
    updateItem(item.id, {
      slide: {
        ...item.slide!,
        caption: newCaption,
      },
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Compress image
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.85,
        preserveExif: false,
      });

      // Upload to Supabase storage
      const tempSessionId = 'templates';
      const imagePath = await uploadSlideImage(tempSessionId, compressed);

      // Update item with new image path
      updateItem(item.id, {
        slide: {
          ...item.slide!,
          image_path: imagePath,
        },
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = () => {
    if (hasImage) {
      setShowLightbox(true);
    }
  };

  const handleCloseLightbox = () => {
    setShowLightbox(false);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-2xl font-semibold text-gray-900">
        {item.slide.caption || 'Untitled Slide'}
      </h2>

      {/* Image section */}
      <div className="space-y-3">
        {hasImage ? (
          <>
            <div
              onClick={handleImageClick}
              className="relative w-full rounded-lg overflow-hidden border border-gray-300 cursor-pointer hover:border-indigo-400 transition-colors"
              style={{ maxHeight: '400px' }}
            >
              <img
                src={getSlideImageUrl(item.slide.image_path)}
                alt={item.slide.caption || 'Slide'}
                className="w-full h-auto object-contain"
                style={{ maxHeight: '400px' }}
              />
            </div>
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Change Image'}
            </button>
          </>
        ) : (
          <div
            onClick={handleUploadClick}
            className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
          >
            {uploading ? (
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Uploading...</p>
              </div>
            ) : (
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 font-medium">Click to upload image</p>
                <p className="text-gray-400 text-sm mt-1">JPEG, PNG, WebP, or GIF</p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Caption input */}
      <div className="space-y-2">
        <label htmlFor="caption" className="block text-sm font-medium text-gray-700">
          Caption
        </label>
        <input
          id="caption"
          type="text"
          value={item.slide.caption || ''}
          onChange={handleCaptionChange}
          placeholder="Add a caption for this slide..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Lightbox (placeholder) */}
      {showLightbox && hasImage && (
        <div
          onClick={handleCloseLightbox}
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={handleCloseLightbox}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={getSlideImageUrl(item.slide.image_path)}
              alt={item.slide.caption || 'Slide'}
              className="max-w-full max-h-screen object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
