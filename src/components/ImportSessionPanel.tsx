import { useState, useRef } from 'react';
import { validateImportFile, importSessionData, type ImportData } from '../lib/session-import';

interface ImportSessionPanelProps {
  sessionId: string;
  onImportComplete?: (result: { batchCount: number; questionCount: number }) => void;
}

export function ImportSessionPanel({ sessionId, onImportComplete }: ImportSessionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validatedData, setValidatedData] = useState<ImportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

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
      const result = await importSessionData(sessionId, validatedData);

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
    setError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Preview info from validated data
  const previewInfo = validatedData ? {
    batches: validatedData.batches.filter(b => b.name !== '_unbatched').length,
    questions: validatedData.batches.reduce((sum, b) => sum + b.questions.length, 0),
  } : null;

  return (
    <div className="space-y-3">
      {/* File input - hidden with styled button trigger */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:text-gray-400 disabled:bg-gray-100 rounded-lg transition-colors"
        >
          Select JSON File
        </button>
        {fileName && (
          <span className="text-sm text-gray-500 truncate max-w-[200px]">
            {fileName}
          </span>
        )}
      </div>

      {/* Validation error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Preview and confirm section */}
      {previewInfo && !error && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <p className="text-sm text-green-700">
            Ready to import: {previewInfo.batches} batch{previewInfo.batches !== 1 ? 'es' : ''}, {previewInfo.questions} question{previewInfo.questions !== 1 ? 's' : ''}
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
    </div>
  );
}
