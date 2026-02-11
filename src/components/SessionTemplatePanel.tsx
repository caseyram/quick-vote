import { useState, useEffect } from 'react';
import {
  fetchSessionTemplates,
  saveSessionTemplate,
  overwriteSessionTemplate,
  renameSessionTemplate,
  deleteSessionTemplate,
  checkTemplateNameExists,
  serializeSession,
  loadTemplateIntoSession,
} from '../lib/session-template-api';
import { useSessionTemplateStore } from '../stores/session-template-store';
import { useSessionStore } from '../stores/session-store';
import { getSlideImageUrl } from '../lib/slide-api';
import { supabase } from '../lib/supabase';
import type { SessionTemplate, SessionBlueprint } from '../types/database';

interface SessionTemplatePanelProps {
  sessionId: string;
}

export function SessionTemplatePanel({ sessionId }: SessionTemplatePanelProps) {
  const { templates, loading } = useSessionTemplateStore();
  const { sessionItems, batches, questions } = useSessionStore();

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);

  // Save state
  const [saveName, setSaveName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameCollision, setNameCollision] = useState<{
    name: string;
    blueprint: SessionBlueprint;
    itemCount: number;
    existingId: string;
  } | null>(null);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<SessionTemplate | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Load state
  const [loadTarget, setLoadTarget] = useState<SessionTemplate | null>(null);
  const [loadMode, setLoadMode] = useState<'replace' | 'append' | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [missingTemplateWarning, setMissingTemplateWarning] = useState<number | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    fetchSessionTemplates().catch((err) => {
      console.error('Failed to fetch session templates:', err?.message || err);
    });
  }, []);

  // Save workflow
  async function handleSaveTemplate() {
    const trimmedName = saveName.trim();
    if (!trimmedName) return;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      // Check if name exists
      const exists = await checkTemplateNameExists(trimmedName);
      if (exists) {
        // Find the existing template ID
        const existingTemplate = templates.find((t) => t.name === trimmedName);
        if (!existingTemplate) {
          throw new Error('Template exists but could not be found');
        }

        // Serialize blueprint
        const blueprint = serializeSession(sessionItems, batches, questions);
        const itemCount = sessionItems.length;

        // Show collision prompt
        setNameCollision({
          name: trimmedName,
          blueprint,
          itemCount,
          existingId: existingTemplate.id,
        });
        setSaveStatus('idle');
        return;
      }

      // New template - serialize and save
      const blueprint = serializeSession(sessionItems, batches, questions);
      const itemCount = sessionItems.length;
      await saveSessionTemplate(trimmedName, blueprint, itemCount);

      // Success state
      setSaveStatus('success');
      setSaveName('');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save template');
    }
  }

  // Handle name collision - overwrite
  async function handleOverwrite() {
    if (!nameCollision) return;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      await overwriteSessionTemplate(
        nameCollision.existingId,
        nameCollision.blueprint,
        nameCollision.itemCount
      );

      // Success
      setSaveStatus('success');
      setSaveName('');
      setNameCollision(null);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to overwrite template');
      setNameCollision(null);
    }
  }

  // Handle name collision - save as new
  function handleSaveAsNew() {
    setNameCollision(null);
    setSaveName('');
  }

  // Inline rename
  async function handleRenameStart(template: SessionTemplate) {
    setEditingId(template.id);
    setEditValue(template.name);
  }

  async function handleRenameSubmit(id: string) {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      setEditingId(null);
      return;
    }

    try {
      await renameSessionTemplate(id, trimmedValue);
      setEditingId(null);
    } catch (err) {
      console.error('Failed to rename template:', err);
      alert(err instanceof Error ? err.message : 'Failed to rename template');
    }
  }

  function handleRenameCancel() {
    setEditingId(null);
    setEditValue('');
  }

  // Type-to-confirm delete
  function handleDeleteStart(template: SessionTemplate) {
    setDeleteTarget(template);
    setDeleteConfirmText('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteSessionTemplate(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
    setDeleteConfirmText('');
  }

  // Load workflow
  function handleLoadStart(template: SessionTemplate) {
    setLoadTarget(template);
    setMissingTemplateWarning(null);

    // If session has content, show replace/append prompt
    if (sessionItems.length > 0) {
      // Show prompt (handled in JSX below)
    } else {
      // Empty session - load directly
      handleLoadExecute(template, null);
    }
  }

  async function handleLoadExecute(template: SessionTemplate, mode: 'replace' | 'append' | null) {
    setLoadingTemplate(true);
    setMissingTemplateWarning(null);

    try {
      let blueprint = template.blueprint;

      // Replace mode: clear all existing content first
      if (mode === 'replace') {
        await supabase.from('questions').delete().eq('session_id', sessionId);
        await supabase.from('batches').delete().eq('session_id', sessionId);
        await supabase.from('session_items').delete().eq('session_id', sessionId);
      }

      // Append mode: adjust positions
      if (mode === 'append') {
        const maxPosition = Math.max(...sessionItems.map((item) => item.position), -1);
        blueprint = structuredClone(template.blueprint);
        blueprint.sessionItems.forEach((item) => {
          item.position += maxPosition + 1;
        });
      }

      // Load template
      const { missingTemplateCount } = await loadTemplateIntoSession(sessionId, blueprint);

      // Refresh session store
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      const { data: batchesData } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      const { data: itemsData } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      if (questionsData) useSessionStore.getState().setQuestions(questionsData);
      if (batchesData) useSessionStore.getState().setBatches(batchesData);
      if (itemsData) useSessionStore.getState().setSessionItems(itemsData);

      // Show warning if templates missing
      if (missingTemplateCount > 0) {
        setMissingTemplateWarning(missingTemplateCount);
      }

      // Close load dialog
      setLoadTarget(null);
      setLoadMode(null);
    } catch (err) {
      console.error('Failed to load template:', err);
      alert(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoadingTemplate(false);
    }
  }

  // Calculate summary for load preview
  function getTemplateSummary(blueprint: SessionBlueprint) {
    const batches = blueprint.sessionItems.filter((item) => item.item_type === 'batch');
    const slides = blueprint.sessionItems.filter((item) => item.item_type === 'slide');
    const totalQuestions = batches.reduce((sum, item) => {
      return sum + (item.batch?.questions.length ?? 0);
    }, 0);

    return {
      batchCount: batches.length,
      slideCount: slides.length,
      totalQuestions,
      slides: slides.map((item) => item.slide?.image_path).filter(Boolean) as string[],
    };
  }

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <>
      <div className="bg-white rounded-lg p-6 space-y-4">
        {/* Title and toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Session Templates</h2>
            <p className="text-sm text-gray-500 mt-1">
              Save and reuse session structures (batches, slides, questions)
            </p>
          </div>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            {panelOpen ? 'Close' : 'Open Panel'}
          </button>
        </div>

        {/* Panel content */}
        {panelOpen && (
          <div className="space-y-4 border-t pt-4">
            {/* Save section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Save Current Session as Template
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Template name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={saveStatus === 'saving'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTemplate();
                  }}
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={!saveName.trim() || saveStatus === 'saving' || saveStatus === 'success'}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                    saveStatus === 'success'
                      ? 'bg-green-600'
                      : saveStatus === 'saving'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'success' && (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </>
                  )}
                  {saveStatus === 'idle' && 'Save Template'}
                  {saveStatus === 'error' && 'Save Template'}
                </button>
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              {nameCollision && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-gray-900">
                    Template <strong>"{nameCollision.name}"</strong> already exists. What would you like to do?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleOverwrite}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                    >
                      Overwrite
                    </button>
                    <button
                      onClick={handleSaveAsNew}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                    >
                      Save as New
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Template list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Saved Templates</h3>

              {loading && <p className="text-sm text-gray-400">Loading templates...</p>}

              {!loading && templates.length === 0 && (
                <p className="text-sm text-gray-400">
                  No session templates yet. Save the current session to create one.
                </p>
              )}

              {!loading && templates.length > 0 && (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`bg-gray-50 rounded-lg px-3 py-2 ${
                        deleteTarget?.id === template.id ? 'ring-2 ring-red-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: name, date, item count */}
                        <div className="flex-1 min-w-0">
                          {editingId === template.id ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(template.id);
                                if (e.key === 'Escape') handleRenameCancel();
                              }}
                              onBlur={() => handleRenameSubmit(template.id)}
                              autoFocus
                              className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <button
                              onClick={() => handleRenameStart(template)}
                              className="text-sm font-medium text-gray-800 hover:text-indigo-600 text-left"
                            >
                              {template.name}
                            </button>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">{formatDate(template.updated_at)}</p>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs text-gray-500">{template.item_count} items</p>
                          </div>
                        </div>

                        {/* Right: Load + Delete buttons */}
                        {editingId !== template.id && deleteTarget?.id !== template.id && (
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <button
                              onClick={() => handleLoadStart(template)}
                              className="px-2 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => handleDeleteStart(template)}
                              className="px-2 py-1 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Type-to-confirm delete UI */}
                      {deleteTarget?.id === template.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                          <p className="text-sm text-gray-900">
                            Type <strong>"{template.name}"</strong> to confirm deletion
                          </p>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Template name"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleDeleteConfirm}
                              disabled={deleteConfirmText !== template.name || deleting}
                              className={`px-3 py-1.5 text-sm font-medium text-white rounded transition-colors ${
                                deleteConfirmText === template.name && !deleting
                                  ? 'bg-red-600 hover:bg-red-500'
                                  : 'bg-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                              onClick={handleDeleteCancel}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Load preview/prompt modal */}
      {loadTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              const startTarget = e.target;
              const handleMouseUp = (upEvent: MouseEvent) => {
                if (upEvent.target === startTarget) {
                  setLoadTarget(null);
                  setLoadMode(null);
                }
                document.removeEventListener('mouseup', handleMouseUp);
              };
              document.addEventListener('mouseup', handleMouseUp);
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Load Template: {loadTarget.name}</h3>
              <button
                onClick={() => {
                  setLoadTarget(null);
                  setLoadMode(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Template summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Template Summary</h4>
              {(() => {
                const summary = getTemplateSummary(loadTarget.blueprint);
                return (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-gray-900">
                      <strong>{loadTarget.item_count} items:</strong> {summary.batchCount} batches, {summary.slideCount} slides
                    </p>
                    <p className="text-sm text-gray-900">
                      <strong>{summary.totalQuestions} questions</strong> across all batches
                    </p>

                    {/* Slide thumbnails */}
                    {summary.slides.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-600">Slide Previews:</p>
                        <div className="flex gap-2 flex-wrap">
                          {summary.slides.slice(0, 6).map((imagePath, idx) => (
                            <img
                              key={idx}
                              src={getSlideImageUrl(imagePath)}
                              alt={`Slide ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded border border-gray-300"
                            />
                          ))}
                          {summary.slides.length > 6 && (
                            <div className="w-16 h-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600">
                              +{summary.slides.length - 6}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Replace/Append prompt or Load button */}
            {sessionItems.length > 0 && !loadMode ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  This session already has <strong>{sessionItems.length} items</strong>. How would you like to load this template?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLoadMode('replace')}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                    Replace All Content
                  </button>
                  <button
                    onClick={() => setLoadMode('append')}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    Append to End
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoadExecute(loadTarget, loadMode)}
                  disabled={loadingTemplate}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loadingTemplate ? 'Loading...' : `Load Template${loadMode ? ` (${loadMode})` : ''}`}
                </button>
                <button
                  onClick={() => {
                    setLoadTarget(null);
                    setLoadMode(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Missing template warning */}
            {missingTemplateWarning !== null && missingTemplateWarning > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-gray-900">
                  <strong>Warning:</strong> {missingTemplateWarning} response template{missingTemplateWarning === 1 ? '' : 's'} no longer exist. Questions loaded without template assignments.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
