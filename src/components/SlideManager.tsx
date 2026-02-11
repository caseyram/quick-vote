import { useState, useEffect } from 'react';
import { ImageUploader } from './ImageUploader';
import {
  fetchSessionItems,
  createSlide,
  updateSlideCaption,
  deleteSlide,
  getSlideImageUrl,
} from '../lib/slide-api';
import type { SessionItem } from '../types/database';

interface SlideManagerProps {
  sessionId: string;
}

export function SlideManager({ sessionId }: SlideManagerProps) {
  const [slides, setSlides] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const [previewSlide, setPreviewSlide] = useState<SessionItem | null>(null);

  useEffect(() => {
    loadSlides();
  }, [sessionId]);

  const loadSlides = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await fetchSessionItems(sessionId);
      const slideItems = items.filter((item) => item.item_type === 'slide');
      setSlides(slideItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slides');
    } finally {
      setLoading(false);
    }
  };

  const handleUploaded = async (imagePath: string) => {
    try {
      const newSlide = await createSlide(sessionId, imagePath, null);
      setSlides((prev) => [...prev, newSlide]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create slide');
    }
  };

  const handleEditCaption = (slide: SessionItem) => {
    setEditingId(slide.id);
    setEditingCaption(slide.slide_caption || '');
  };

  const handleSaveCaption = async (slideId: string) => {
    try {
      const caption = editingCaption.trim() || null;
      await updateSlideCaption(slideId, caption);
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === slideId ? { ...slide, slide_caption: caption } : slide
        )
      );
      setEditingId(null);
      setEditingCaption('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update caption');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingCaption('');
  };

  const handleDelete = async (slide: SessionItem) => {
    if (!window.confirm('Delete this slide? The image will be permanently removed.')) {
      return;
    }

    try {
      await deleteSlide(slide.id, slide.slide_image_path!);
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slide');
    }
  };

  const handlePreview = (slide: SessionItem) => {
    setPreviewSlide(slide);
  };

  const handleClosePreview = () => {
    setPreviewSlide(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, slideId: string) => {
    if (e.key === 'Enter') {
      handleSaveCaption(slideId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewSlide) {
        handleClosePreview();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewSlide]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2}/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2}/><path d="M21 15l-5-5L5 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h2 className="text-lg font-semibold text-gray-900">Image Slides</h2>
        </div>
        <p className="text-gray-600">Loading slides...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2}/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2}/><path d="M21 15l-5-5L5 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
        <h2 className="text-lg font-semibold text-gray-900">Image Slides</h2>
        <span className="ml-auto text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {slides.length}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Image uploader */}
      <div className="mb-4">
        <ImageUploader sessionId={sessionId} onUploaded={handleUploaded} />
      </div>

      {/* Slide list */}
      {slides.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2}/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2}/><path d="M21 15l-5-5L5 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
          <p>No slides yet. Upload an image to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Thumbnail */}
              <img
                src={getSlideImageUrl(slide.slide_image_path!)}
                alt={slide.slide_caption || 'Slide'}
                className="w-12 h-12 object-cover rounded"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3ENot found%3C/text%3E%3C/svg%3E';
                }}
              />

              {/* Caption */}
              <div className="flex-1 min-w-0">
                {editingId === slide.id ? (
                  <input
                    type="text"
                    value={editingCaption}
                    onChange={(e) => setEditingCaption(e.target.value)}
                    onBlur={() => handleSaveCaption(slide.id)}
                    onKeyDown={(e) => handleKeyDown(e, slide.id)}
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    placeholder="Enter caption..."
                  />
                ) : (
                  <button
                    onClick={() => handleEditCaption(slide)}
                    className="text-left w-full text-sm text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {slide.slide_caption || (
                      <span className="text-gray-400 italic">No caption</span>
                    )}
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreview(slide)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition-colors"
                  title="Preview"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeWidth={2}/></svg>
                </button>
                <button
                  onClick={() => handleDelete(slide)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen preview overlay */}
      {previewSlide && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
          onClick={handleClosePreview}
        >
          {/* Close button */}
          <button
            onClick={handleClosePreview}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {/* Image */}
          <img
            src={getSlideImageUrl(previewSlide.slide_image_path!)}
            alt={previewSlide.slide_caption || 'Slide preview'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          {previewSlide.slide_caption && (
            <p className="absolute bottom-8 text-white text-center text-sm px-4 max-w-2xl">
              {previewSlide.slide_caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
