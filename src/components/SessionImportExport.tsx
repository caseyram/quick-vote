import { useState, useRef } from 'react';
import { useSessionStore } from '../stores/session-store';
import { useTemplateStore } from '../stores/template-store';
import { validateImportFile, importSessionData, exportSessionData, type ImportData } from '../lib/session-import';
import { downloadJSON, generateExportFilename } from '../lib/session-export';
import { parseCsv, downloadCsvTemplate } from '../lib/csv-import';
import { bulkInsertQuestions } from '../lib/question-templates';

interface SessionImportExportProps {
  sessionId: string;
  sessionName?: string;
  onImportComplete?: (result: { batchCount: number; questionCount: number; templateCount: number; slideCount?: number; missingSlideCount?: number }) => void;
}

export function SessionImportExport({ sessionId, sessionName, onImportComplete }: SessionImportExportProps) {
  const questions = useSessionStore((s) => s.questions);
  const batches = useSessionStore((s) => s.batches);
  const sessionItems = useSessionStore((s) => s.sessionItems);
  const templates = useTemplateStore((s) => s.templates);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [validatedData, setValidatedData] = useState<ImportData | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ questions: number; batches: number } | null>(null);
  const [csvData, setCsvData] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [exportDownloaded, setExportDownloaded] = useState(false);

  function handleExport() {
    const json = exportSessionData(questions, batches, sessionName, templates, sessionItems, null);
    const data = JSON.parse(json);
    const filename = generateExportFilename(sessionName ?? 'session');
    downloadJSON(data, filename);
    setExportDownloaded(true);
    setTimeout(() => setExportDownloaded(false), 2000);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setValidatedData(null);
    setFileName(file.name);

    const result = await validateImportFile(file);
    if (!result.success) {
      setError(result.error ?? 'Validation failed');
      return;
    }

    setValidatedData(result.data!);
  }

  async function handleImport() {
    if (!validatedData) return;

    setImporting(true);
    setError(null);

    try {
      const result = await importSessionData(
        sessionId,
        validatedData,
        async (missingPaths: string[]) => {
          // Prompt user confirmation for missing slide images
          const count = missingPaths.length;
          const message = `${count} slide image${count !== 1 ? 's' : ''} not found in Storage:\n${missingPaths.slice(0, 5).join('\n')}${count > 5 ? `\n... and ${count - 5} more` : ''}\n\nImport anyway (missing slides will be skipped)?`;
          return window.confirm(message);
        }
      );

      // Reset state after successful import
      setValidatedData(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onImportComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function handleCancel() {
    setValidatedData(null);
    setCsvPreview(null);
    setCsvData(null);
    setError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
  }

  async function handleCsvFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setValidatedData(null);
    setCsvPreview(null);
    setCsvData(null);
    setFileName(file.name);

    try {
      const content = await file.text();
      const parsed = parseCsv(content);
      setCsvData(parsed);
      setCsvPreview({
        questions: parsed.questions.length,
        batches: parsed.batches.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }

  async function handleCsvImport() {
    if (!csvData) return;

    setImporting(true);
    setError(null);

    try {
      // Calculate next position
      const unbatchedQuestions = questions.filter(q => q.batch_id === null);
      const maxUnbatchedPos = unbatchedQuestions.length > 0
        ? Math.max(...unbatchedQuestions.map(q => q.position))
        : -1;
      const maxBatchPos = batches.length > 0
        ? Math.max(...batches.map(b => b.position))
        : -1;
      const nextPosition = Math.max(maxUnbatchedPos, maxBatchPos) + 1;

      const result = await bulkInsertQuestions(
        sessionId,
        csvData.questions,
        csvData.batches,
        nextPosition,
        nextPosition
      );

      // Add to store
      for (const b of result.batches) {
        useSessionStore.getState().addBatch(b);
      }
      for (const q of result.questions) {
        useSessionStore.getState().addQuestion(q);
      }

      // Reset state
      setCsvData(null);
      setCsvPreview(null);
      setFileName(null);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';

      onImportComplete?.({ batchCount: result.batches.length, questionCount: result.questions.length, templateCount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  }

  // Preview info from validated data
  const previewInfo = validatedData ? {
    batches: validatedData.batches.filter(b => !('type' in b && b.type === 'slide') && b.name !== '_unbatched').length,
    questions: validatedData.batches.reduce((sum, b) => {
      if ('questions' in b) {
        return sum + b.questions.length;
      }
      return sum;
    }, 0),
    templates: validatedData.templates?.length ?? 0,
    slides: validatedData.batches.filter(b => 'type' in b && b.type === 'slide').length,
  } : null;

  const hasContent = questions.length > 0 || batches.length > 0;

  return (
    <div className="space-y-3">
      {/* Import / Export buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvFileSelect}
          className="hidden"
        />
        <button
          onClick={() => csvFileInputRef.current?.click()}
          disabled={importing}
          className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:text-gray-400 disabled:bg-gray-100 rounded-lg transition-colors"
        >
          Import CSV
        </button>
        <button
          onClick={downloadCsvTemplate}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          CSV Template
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:text-gray-400 disabled:bg-gray-100 rounded-lg transition-colors"
        >
          Import JSON
        </button>
        <button
          onClick={handleExport}
          disabled={!hasContent}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {exportDownloaded ? 'Downloaded!' : 'Export JSON'}
        </button>
      </div>
      {fileName && !validatedData && !csvPreview && !error && (
        <span className="text-sm text-gray-500 truncate max-w-[200px]">
          {fileName}
        </span>
      )}

      {/* Validation error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
            <button
              onClick={handleCancel}
              className="text-red-500 hover:text-red-700 shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Preview and confirm section - JSON */}
      {previewInfo && !error && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <p className="text-sm text-green-700">
            Ready to import (JSON): {previewInfo.batches > 0 ? `${previewInfo.batches} batch${previewInfo.batches !== 1 ? 'es' : ''}, ` : ''}{previewInfo.questions} question{previewInfo.questions !== 1 ? 's' : ''}{previewInfo.slides > 0 ? `, ${previewInfo.slides} slide${previewInfo.slides !== 1 ? 's' : ''}` : ''}{previewInfo.templates > 0 ? `, ${previewInfo.templates} template${previewInfo.templates !== 1 ? 's' : ''}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:bg-green-300 rounded-lg transition-colors"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={handleCancel}
              disabled={importing}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview and confirm section - CSV */}
      {csvPreview && !error && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
          <p className="text-sm text-emerald-700">
            Ready to import (CSV): {csvPreview.batches > 0 ? `${csvPreview.batches} batch${csvPreview.batches !== 1 ? 'es' : ''}, ` : ''}{csvPreview.questions} question{csvPreview.questions !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCsvImport}
              disabled={importing}
              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 rounded-lg transition-colors"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={handleCancel}
              disabled={importing}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
