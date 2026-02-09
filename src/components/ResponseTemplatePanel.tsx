import { useState, useEffect } from 'react';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateUsageCount,
  checkTemplateVotes,
} from '../lib/template-api';
import { useTemplateStore } from '../stores/template-store';
import { TemplateEditor } from './TemplateEditor';
import { ConfirmDialog } from './ConfirmDialog';
import type { ResponseTemplate } from '../types/database';

export function ResponseTemplatePanel() {
  const { templates, loading } = useTemplateStore();
  const [editingTemplate, setEditingTemplate] = useState<ResponseTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    template: ResponseTemplate;
    usageCount: number;
  } | null>(null);
  const [editConfirm, setEditConfirm] = useState<{
    template: ResponseTemplate;
    name: string;
    options: string[];
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates().catch((err) => {
      console.error('Failed to fetch templates:', err);
    });
  }, []);

  // Create flow
  async function handleCreateSave(name: string, options: string[]) {
    setSaving(true);
    setSaveError(null);

    try {
      await createTemplate(name, options);
      setCreating(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create template');
      throw err; // Re-throw so TemplateEditor knows save failed
    } finally {
      setSaving(false);
    }
  }

  // Edit flow
  async function handleEditSave(name: string, options: string[]) {
    if (!editingTemplate) return;

    setSaving(true);
    setSaveError(null);

    try {
      // Check if options changed
      const optionsChanged =
        JSON.stringify(options) !== JSON.stringify(editingTemplate.options);

      if (optionsChanged) {
        // Check for votes on linked questions
        const hasVotes = await checkTemplateVotes(editingTemplate.id);
        if (hasVotes) {
          setSaveError('Cannot edit options: linked questions have received votes');
          setSaving(false);
          throw new Error('Cannot edit options: linked questions have received votes');
        }

        // Check for linked questions (no votes)
        const usageCount = await getTemplateUsageCount(editingTemplate.id);
        if (usageCount > 0) {
          // Show confirmation dialog
          setEditConfirm({
            template: editingTemplate,
            name,
            options,
          });
          setSaving(false);
          return;
        }
      }

      // No votes, no linked questions (or only name changed) - proceed with update
      await updateTemplate(editingTemplate.id, { name, options });
      setEditingTemplate(null);
    } catch (err) {
      if (!saveError) {
        // Only set error if not already set
        setSaveError(err instanceof Error ? err.message : 'Failed to update template');
      }
      throw err; // Re-throw so TemplateEditor knows save failed
    } finally {
      setSaving(false);
    }
  }

  // Edit confirmation flow
  async function handleEditConfirm() {
    if (!editConfirm) return;

    setSaving(true);
    setSaveError(null);

    try {
      await updateTemplate(editConfirm.template.id, {
        name: editConfirm.name,
        options: editConfirm.options,
      });
      setEditingTemplate(null);
      setEditConfirm(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  // Delete flow
  async function handleDeleteClick(template: ResponseTemplate) {
    const usageCount = await getTemplateUsageCount(template.id);
    setDeleteConfirm({ template, usageCount });
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;

    setDeleting(true);

    try {
      await deleteTemplate(deleteConfirm.template.id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg p-6 space-y-4">
        {/* Title and subtitle */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Response Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Reusable sets of response options for multiple choice questions
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <p className="text-sm text-gray-400">Loading templates...</p>
        )}

        {/* Template list */}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-gray-400">
            No response templates yet. Create one to use across sessions.
          </p>
        )}

        {!loading && templates.length > 0 && (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
              >
                {/* Left: name + options preview */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{template.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {template.options.join(', ')}
                  </p>
                </div>

                {/* Right: Edit + Delete buttons */}
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="px-2 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(template)}
                    className="px-2 py-1 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Template button */}
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          + Create Template
        </button>
      </div>

      {/* Create editor */}
      {creating && (
        <TemplateEditor
          onSave={handleCreateSave}
          onCancel={() => {
            setCreating(false);
            setSaveError(null);
          }}
          saving={saving}
          error={saveError}
        />
      )}

      {/* Edit editor */}
      {editingTemplate && !editConfirm && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleEditSave}
          onCancel={() => {
            setEditingTemplate(null);
            setSaveError(null);
          }}
          saving={saving}
          error={saveError}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          title="Delete Template"
          message={
            deleteConfirm.usageCount > 0
              ? `This template is used by ${deleteConfirm.usageCount} question(s). Deleting will detach those questions from the template.`
              : 'Delete this template? This cannot be undone.'
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          loading={deleting}
        />
      )}

      {/* Edit propagation confirmation dialog */}
      {editConfirm && (
        <ConfirmDialog
          isOpen={true}
          onConfirm={handleEditConfirm}
          onCancel={() => {
            setEditConfirm(null);
            setSaving(false);
          }}
          title="Update Template Options"
          message={`${
            (() => {
              const count = editConfirm.template.id
                ? templates.find((t) => t.id === editConfirm.template.id)
                : null;
              return count ? 'Multiple' : 'Some';
            })()
          } question(s) will be updated with the new options.`}
          confirmLabel="Update"
          confirmVariant="primary"
          loading={saving}
        />
      )}
    </>
  );
}
