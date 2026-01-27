import { useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import {
  getSavedTemplates,
  saveTemplate,
  deleteTemplate,
  bulkInsertQuestions,
} from '../lib/question-templates';
import type { SavedTemplate } from '../lib/question-templates';

interface TemplatePanelProps {
  sessionId: string;
}

export function TemplatePanel({ sessionId }: TemplatePanelProps) {
  const questions = useSessionStore((s) => s.questions);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => getSavedTemplates());
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (questions.length === 0) return;
    saveTemplate(trimmed, questions);
    setTemplates(getSavedTemplates());
    setName('');
  }

  function handleDelete(templateName: string) {
    deleteTemplate(templateName);
    setTemplates(getSavedTemplates());
  }

  async function handleLoad(template: SavedTemplate) {
    setLoading(true);
    setError(null);
    try {
      const maxPos = questions.length > 0
        ? Math.max(...questions.map((q) => q.position)) + 1
        : 0;
      const inserted = await bulkInsertQuestions(sessionId, template.questions, maxPos);
      for (const q of inserted) {
        useSessionStore.getState().addQuestion(q);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Templates</h2>

      {/* Save current questions as template */}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
        <button
          onClick={handleSave}
          disabled={!name.trim() || questions.length === 0}
          className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
        >
          Save as Template
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Saved templates list */}
      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.name + t.createdAt}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {t.questions.length} question{t.questions.length !== 1 ? 's' : ''}
                  {' \u00b7 '}
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button
                  onClick={() => handleLoad(t)}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => handleDelete(t.name)}
                  className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-gray-400">No saved templates yet.</p>
      )}
    </div>
  );
}
