import { useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import {
  questionsToTemplates,
  templatesToJson,
  jsonToTemplates,
  bulkInsertQuestions,
} from '../lib/question-templates';

interface ImportExportPanelProps {
  sessionId: string;
}

export function ImportExportPanel({ sessionId }: ImportExportPanelProps) {
  const questions = useSessionStore((s) => s.questions);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  function handleExport() {
    // Export questions without batch info (simple export)
    const templates = questionsToTemplates(questions, []);
    const json = templatesToJson(templates);
    navigator.clipboard.writeText(json).then(() => {
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    });
  }

  async function handleImport() {
    setImportError(null);
    setImporting(true);

    try {
      const templates = jsonToTemplates(importText);
      if (templates.length === 0) {
        setImportError('No questions found in JSON.');
        return;
      }

      const maxPos = questions.length > 0
        ? Math.max(...questions.map((q) => q.position)) + 1
        : 0;

      // Import questions without batches (simple import)
      const result = await bulkInsertQuestions(sessionId, templates, [], maxPos, 0);
      for (const q of result.questions) {
        useSessionStore.getState().addQuestion(q);
      }

      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowImportModal(true)}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          Import JSON
        </button>
        <button
          onClick={handleExport}
          disabled={questions.length === 0}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {exportCopied ? 'Copied!' : 'Export JSON'}
        </button>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Import Questions</h3>
            <p className="text-sm text-gray-500">
              Paste a JSON array of question templates.
            </p>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder={'[\n  { "text": "...", "type": "agree_disagree", "options": null, "anonymous": true }\n]'}
              rows={8}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {importError && <p className="text-red-500 text-sm">{importError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                  setImportError(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim() || importing}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
