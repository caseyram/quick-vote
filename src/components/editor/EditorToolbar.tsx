import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import imageCompression from 'browser-image-compression';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem } from '../../stores/template-editor-store';
import { useTemplateStore } from '../../stores/template-store';
import { fetchTemplates } from '../../lib/template-api';
import { saveSessionTemplate, overwriteSessionTemplate, loadTemplateIntoSession } from '../../lib/session-template-api';
import { uploadSlideImage } from '../../lib/slide-api';
import { validateTeamList } from '../../lib/team-api';
import { supabase } from '../../lib/supabase';

interface EditorToolbarProps {
  onOpenPreview: (startIndex: number) => void;
}

export function EditorToolbar({ onOpenPreview }: EditorToolbarProps) {
  const navigate = useNavigate();
  const {
    templateId,
    templateName,
    globalTemplateId,
    backgroundColor,
    items,
    selectedItemId,
    isDirty,
    saving,
    setGlobalTemplateId,
    setTemplateName,
    setBackgroundColor,
    addItem,
    updateItem,
    setSaving,
    markClean,
    toBlueprint,
  } = useTemplateEditorStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(templateName);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [showPreviewDropdown, setShowPreviewDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Per-session settings (NOT stored in template blueprint)
  const [reasonsEnabled, setReasonsEnabled] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [teamInput, setTeamInput] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);
  const [showTeamPopover, setShowTeamPopover] = useState(false);

  const responseTemplates = useTemplateStore((s) => s.templates);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const teamPopoverRef = useRef<HTMLDivElement>(null);

  // Fetch response templates on mount
  useEffect(() => {
    if (responseTemplates.length === 0) {
      fetchTemplates().catch(console.error);
    }
  }, [responseTemplates.length]);

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

  // Click-outside detection for color picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  // Click-outside detection for team popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamPopoverRef.current && !teamPopoverRef.current.contains(event.target as Node)) {
        setShowTeamPopover(false);
      }
    }
    if (showTeamPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTeamPopover]);

  const handleAddTeam = () => {
    const trimmed = teamInput.trim();
    if (!trimmed) return;

    const newTeams = [...teams, trimmed];
    const validation = validateTeamList(newTeams);

    if (!validation.valid) {
      setTeamError(validation.error || 'Invalid team name');
      return;
    }

    setTeams(newTeams);
    setTeamInput('');
    setTeamError(null);
  };

  const handleRemoveTeam = (teamName: string) => {
    setTeams(teams.filter((t) => t !== teamName));
    setTeamError(null);
  };

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
        name: `Question Set ${batchCount + 1}`,
        questions: [],
        timer_duration: null,
        template_id: null,
        cover_image_path: null,
      },
    };
    addItem(newBatch, selectedItemId);
  };

  const handleAddSlide = () => {
    slideFileInputRef.current?.click();
  };

  const handleSlideFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlide(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.85,
        preserveExif: false,
      });

      const imagePath = await uploadSlideImage('templates', compressed);

      const newSlide: EditorItem = {
        id: nanoid(),
        item_type: 'slide',
        slide: { image_path: imagePath, caption: null, notes: null },
      };
      addItem(newSlide, selectedItemId);
    } catch (err) {
      console.error('Failed to upload slide image:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingSlide(false);
      if (slideFileInputRef.current) slideFileInputRef.current.value = '';
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

  const handleStartSession = async () => {
    setStartingSession(true);

    try {
      // Serialize current editor state to blueprint
      const blueprint = toBlueprint();

      // Create new session
      const sessionId = nanoid();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Authentication failed. Please refresh and try again.');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({
          session_id: sessionId,
          title: templateName || 'Untitled Session',
          created_by: user.id,
          reasons_enabled: reasonsEnabled,
          test_mode: testMode,
          teams: teams.length > 0 ? teams : [],
          status: 'active',
        })
        .select('admin_token, session_id')
        .single();

      if (insertError) {
        alert(insertError.message);
        return;
      }

      // Load template blueprint into session (materialize batches/questions/items)
      await loadTemplateIntoSession(sessionId, blueprint);

      // Navigate to admin view — session is already active, skipping draft
      navigate(`/admin/${data.admin_token}`);
    } catch (err) {
      console.error('Failed to start session:', err);
      alert(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStartingSession(false);
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
          + Question Set
        </button>
        <button
          onClick={handleAddSlide}
          disabled={uploadingSlide}
          className="px-3 py-1.5 text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingSlide ? 'Uploading...' : '+ Add Slide'}
        </button>
        <input
          ref={slideFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleSlideFileSelect}
          className="hidden"
        />

        {/* Global response template */}
        {responseTemplates.length > 0 && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <span className="text-xs text-gray-500">Responses</span>
            <select
              value={globalTemplateId ?? ''}
              onChange={(e) => {
                const tid = e.target.value || null;
                setGlobalTemplateId(tid);
                const template = tid ? responseTemplates.find((t) => t.id === tid) : null;
                items.forEach((itm) => {
                  if (itm.item_type === 'batch' && itm.batch) {
                    const updatedQuestions = itm.batch.questions.map((q) => ({
                      ...q,
                      template_id: tid,
                      ...(template
                        ? { type: 'multiple_choice' as const, options: [...template.options] }
                        : {}),
                    }));
                    updateItem(itm.id, {
                      batch: { ...itm.batch, template_id: tid, questions: updatedQuestions },
                    });
                  }
                });
              }}
              className="bg-gray-50 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="">None (custom)</option>
              {responseTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </>
        )}

        {/* Background color */}
        <div className="w-px h-6 bg-gray-300" />
        <span className="text-xs text-gray-500">Background</span>
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-8 h-8 rounded border-2 border-gray-300 shadow-sm cursor-pointer"
            style={{ backgroundColor: backgroundColor || '#1a1a2e' }}
            title="Projection background color"
          />
          {showColorPicker && (
            <div className="absolute top-10 left-0 z-50 bg-white p-3 rounded-lg shadow-xl border border-gray-200">
              <HexColorPicker
                color={backgroundColor || '#1a1a2e'}
                onChange={setBackgroundColor}
              />
              <HexColorInput
                color={backgroundColor || '#1a1a2e'}
                onChange={setBackgroundColor}
                prefixed
                className="w-full mt-2 px-2 py-1 border border-gray-300 rounded text-sm font-mono text-gray-900"
              />
            </div>
          )}
        </div>

        {/* Session settings */}
        <div className="w-px h-6 bg-gray-300" />
        <span className="text-xs text-gray-500">Session</span>
        <button
          onClick={() => setReasonsEnabled(!reasonsEnabled)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            reasonsEnabled
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title={reasonsEnabled ? 'Reasons enabled' : 'Reasons disabled'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Reasons
        </button>
        <button
          onClick={() => setTestMode(!testMode)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            testMode
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title={testMode ? 'Test mode on' : 'Test mode off'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Test
        </button>
        <div className="relative" ref={teamPopoverRef}>
          <button
            onClick={() => setShowTeamPopover(!showTeamPopover)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              teams.length > 0
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Configure teams"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Teams{teams.length > 0 && <span className="ml-0.5 bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{teams.length}</span>}
          </button>
          {showTeamPopover && (
            <div className="absolute top-8 left-0 z-50 w-64 bg-white p-3 rounded-lg shadow-xl border border-gray-200 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTeam();
                    }
                  }}
                  placeholder="Team name"
                  maxLength={50}
                  className="flex-1 px-2 py-1 bg-gray-50 border border-gray-300 rounded text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddTeam}
                  disabled={!teamInput.trim() || teams.length >= 5}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500">{teams.length} of 5 teams</p>
              {teamError && <p className="text-xs text-red-600">{teamError}</p>}
              {teams.length > 0 ? (
                <div className="space-y-1">
                  {teams.map((team) => (
                    <div key={team} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                      <span className="text-sm text-gray-700">{team}</span>
                      <button
                        onClick={() => handleRemoveTeam(team)}
                        className="text-red-500 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1">No teams configured</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section: Start Session + Save Template + Preview */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleStartSession}
          disabled={startingSession || items.length === 0}
          className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {startingSession ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting...
            </>
          ) : (
            'Start Session'
          )}
        </button>

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
            'Save Template'
          )}
        </button>

        {/* Preview button with dropdown */}
        <div className="relative">
          <div className="flex items-center">
            <button
              onClick={() => onOpenPreview(0)}
              disabled={items.length === 0}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-l transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview
            </button>
            <button
              onClick={() => setShowPreviewDropdown(!showPreviewDropdown)}
              onBlur={() => setTimeout(() => setShowPreviewDropdown(false), 200)}
              disabled={items.length === 0}
              className="px-2 py-1.5 text-sm border-l-0 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showPreviewDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-10">
              <button
                onClick={() => {
                  onOpenPreview(0);
                  setShowPreviewDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Preview All
              </button>
              <button
                onClick={() => {
                  const startIdx = selectedItemId
                    ? items.findIndex((i) => i.id === selectedItemId)
                    : 0;
                  onOpenPreview(startIdx >= 0 ? startIdx : 0);
                  setShowPreviewDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Preview from Here
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
