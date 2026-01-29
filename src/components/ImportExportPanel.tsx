import { useState, useRef } from 'react';
import { useSessionStore } from '../stores/session-store';
import {
  questionsToTemplates,
  templatesToJson,
  jsonToTemplates,
  bulkInsertQuestions,
} from '../lib/question-templates';
import { parseCsv, downloadCsvTemplate } from '../lib/csv-import';

interface ImportExportPanelProps {
  sessionId: string;
}

export function ImportExportPanel({ sessionId }: ImportExportPanelProps) {
  const questions = useSessionStore((s) => s.questions);
  const batches = useSessionStore((s) => s.batches);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'json' | 'csv'>('csv');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    // Export questions without batch info (simple export)
    const templates = questionsToTemplates(questions, []);
    const json = templatesToJson(templates);
    navigator.clipboard.writeText(json).then(() => {
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    });
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportText(content);
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    event.target.value = '';
  }

  async function handleImport() {
    setImportError(null);
    setImporting(true);

    try {
      // Calculate next position considering both batches and unbatched questions
      const unbatchedQuestions = questions.filter(q => q.batch_id === null);
      const maxUnbatchedPos = unbatchedQuestions.length > 0
        ? Math.max(...unbatchedQuestions.map(q => q.position))
        : -1;
      const maxBatchPos = batches.length > 0
        ? Math.max(...batches.map(b => b.position))
        : -1;
      const nextPosition = Math.max(maxUnbatchedPos, maxBatchPos) + 1;

      let questionTemplates;
      let batchTemplates: Parameters<typeof bulkInsertQuestions>[2] = [];

      if (importMode === 'csv') {
        const parsed = parseCsv(importText);
        questionTemplates = parsed.questions;
        batchTemplates = parsed.batches;

        if (questionTemplates.length === 0 && batchTemplates.length === 0) {
          setImportError('No questions found in CSV.');
          return;
        }
      } else {
        questionTemplates = jsonToTemplates(importText);
        if (questionTemplates.length === 0) {
          setImportError('No questions found in JSON.');
          return;
        }
      }

      const result = await bulkInsertQuestions(
        sessionId,
        questionTemplates,
        batchTemplates,
        nextPosition,
        nextPosition
      );

      // Add batches first so questions can reference them
      for (const b of result.batches) {
        useSessionStore.getState().addBatch(b);
      }
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
          Import
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

            {/* Format toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => {
                  setImportMode('csv');
                  setImportText('');
                  setImportError(null);
                }}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  importMode === 'csv'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => {
                  setImportMode('json');
                  setImportText('');
                  setImportError(null);
                }}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  importMode === 'json'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                JSON
              </button>
            </div>

            {importMode === 'csv' ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Upload a CSV file or paste CSV content below. Use the <strong>batch</strong> column to group questions.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadCsvTemplate}
                      className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      Download Template
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      Upload CSV
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder={`question,type,options,batch,anonymous
"Do you agree?",,,,
"Pick one",multiple_choice,"A|B|C",,
"Batch question 1",,,1,
"Batch question 2",,,1,`}
                  rows={8}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400">
                  Columns: <strong>question</strong> (required), <strong>type</strong> (agree_disagree or multiple_choice),
                  <strong>options</strong> (pipe-separated for multiple choice), <strong>batch</strong> (number to group),
                  <strong>anonymous</strong> (true/false)
                </p>
              </>
            ) : (
              <>
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
              </>
            )}

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
