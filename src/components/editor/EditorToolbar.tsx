import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { nanoid } from 'nanoid';
import imageCompression from 'browser-image-compression';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { saveSessionTemplate, overwriteSessionTemplate } from '../../lib/session-template-api';
import { uploadSlideImage } from '../../lib/slide-api';
import { SegmentedControl } from './SegmentedControl';

export function EditorToolbar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    templateId,
    templateName,
    items,
    selectedItemId,
    isDirty,
    saving,
    setTemplateName,
    addItem,
    setSaving,
    markClean,
    toBlueprint,
  } = useTemplateEditorStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(templateName);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read mode from URL search params
  const mode = searchParams.get('mode') || 'edit';

  // Sync editedName with store when templateName changes
  useEffect(() => {
    setEditedName(templateName);
  }, [templateName]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleNameConfirm = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== templateName) {
      setTemplateName(trimmed);
    } else {
      setEditedName(templateName);
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(templateName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameConfirm();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleAddBatch = () => {
    const batchCount = items.filter((item) => item.item_type === 'batch').length;
    const newBatch: EditorItem = {
      id: nanoid(),
      item_type: 'batch',
      batch: {
        name: `Batch ${batchCount + 1}`,
        questions: [],
        timer_duration: null,
      },
    };
    addItem(newBatch, selectedItemId);
  };

  const handleAddSlide = () => {
    const newSlide: EditorItem = {
      id: nanoid(),
      item_type: 'slide',
      slide: {
        image_path: '',
        caption: null,
      },
    };
    addItem(newSlide, selectedItemId);
  };

  const handleUploadImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

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
      // Use a temporary session ID for template images
      const tempSessionId = 'templates';
      const imagePath = await uploadSlideImage(tempSessionId, compressed);

      // Create new slide item with uploaded image
      const newSlide: EditorItem = {
        id: nanoid(),
        item_type: 'slide',
        slide: {
          image_path: imagePath,
          caption: null,
        },
      };
      addItem(newSlide, selectedItemId);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const blueprint = toBlueprint();
      const itemCount = items.length;

      if (templateId) {
        // Update existing template
        await overwriteSessionTemplate(templateId, blueprint, itemCount);
      } else {
        // Create new template
        const newTemplate = await saveSessionTemplate(templateName, blueprint, itemCount);

        // Update store with new ID and navigate to edit URL
        useTemplateEditorStore.setState({ templateId: newTemplate.id });
        navigate(`/templates/${newTemplate.id}/edit`, { replace: true });
      }

      markClean();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save template:', err);
      alert(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode: string) => {
    if (newMode === 'preview') {
      setSearchParams({ mode: 'preview' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      {/* Left section: Back arrow + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Back to home"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onBlur={handleNameConfirm}
            onKeyDown={handleNameKeyDown}
            className="px-2 py-1 text-lg font-semibold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ width: `${Math.max(editedName.length, 10)}ch` }}
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="px-2 py-1 text-lg font-semibold hover:bg-gray-100 rounded transition-colors"
          >
            {templateName}
          </button>
        )}
      </div>

      {/* Center section: Insert actions */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        <button
          onClick={handleAddBatch}
          className="px-3 py-1.5 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transition-colors"
        >
          + Add Batch
        </button>
        <button
          onClick={handleAddSlide}
          className="px-3 py-1.5 text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors"
        >
          + Add Slide
        </button>
        <button
          onClick={handleUploadImageClick}
          disabled={uploadingImage}
          className="px-3 py-1.5 text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingImage ? 'Uploading...' : 'Upload Image'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Right section: Save + Edit/Preview toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            'Save'
          )}
        </button>

        {/* Edit/Preview toggle */}
        <SegmentedControl
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' },
          ]}
          value={mode}
          onChange={handleModeChange}
        />
      </div>
    </div>
  );
}
