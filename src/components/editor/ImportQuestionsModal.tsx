import { useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useTemplateStore } from '../../stores/template-store';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem, EditorQuestion } from '../../stores/template-editor-store';

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedSet {
  name: string;
  questions: string[];
}

function parseCSV(text: string): ParsedSet[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Expected format: question_set,question
  const sets = new Map<string, string[]>();

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const match = lines[i].match(/^"?([^"]*)"?,\s*"?([^"]*)"?$/);
    if (!match) continue;
    const setName = match[1].trim();
    const question = match[2].trim();
    if (!setName || !question) continue;

    if (!sets.has(setName)) sets.set(setName, []);
    sets.get(setName)!.push(question);
  }

  return Array.from(sets.entries()).map(([name, questions]) => ({ name, questions }));
}

function parseJSON(text: string): ParsedSet[] {
  const data = JSON.parse(text);

  // Support array of sets
  if (Array.isArray(data)) {
    return data
      .filter((s): s is { name: string; questions: string[] } =>
        typeof s.name === 'string' && Array.isArray(s.questions)
      )
      .map((s) => ({
        name: s.name,
        questions: s.questions.filter((q): q is string => typeof q === 'string' && q.trim().length > 0),
      }))
      .filter((s) => s.questions.length > 0);
  }

  return [];
}

const CSV_TEMPLATE = `question_set,question
"Team Health","We communicate effectively as a team."
"Team Health","Our team meetings are productive."
"Team Health","I feel supported by my teammates."
"Leadership","My manager provides clear direction."
"Leadership","I receive regular feedback on my work."`;

const JSON_TEMPLATE = JSON.stringify([
  {
    name: "Team Health",
    questions: [
      "We communicate effectively as a team.",
      "Our team meetings are productive.",
      "I feel supported by my teammates.",
    ],
  },
  {
    name: "Leadership",
    questions: [
      "My manager provides clear direction.",
      "I receive regular feedback on my work.",
    ],
  },
], null, 2);

function downloadTemplate(format: 'csv' | 'json') {
  const content = format === 'csv' ? CSV_TEMPLATE : JSON_TEMPLATE;
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `question-sets-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportQuestionsModal({ isOpen, onClose }: ImportQuestionsModalProps) {
  const [parsedSets, setParsedSets] = useState<ParsedSet[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const responseTemplates = useTemplateStore((s) => s.templates);
  const globalTemplateId = useTemplateEditorStore((s) => s.globalTemplateId);
  const addItem = useTemplateEditorStore((s) => s.addItem);

  if (!isOpen) return null;

  const totalQuestions = parsedSets.reduce((sum, s) => sum + s.questions.length, 0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        let sets: ParsedSet[];
        if (file.name.endsWith('.json')) {
          sets = parseJSON(text);
        } else {
          sets = parseCSV(text);
        }

        if (sets.length === 0) {
          setParseError('No question sets found. Check the file format matches the template.');
          setParsedSets([]);
        } else {
          setParsedSets(sets);
        }
      } catch {
        setParseError('Failed to parse file. Make sure it matches the template format.');
        setParsedSets([]);
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (parsedSets.length === 0) return;

    const templateId = useDefaultTemplate ? globalTemplateId : null;
    const template = templateId ? responseTemplates.find((t) => t.id === templateId) : null;

    for (const set of parsedSets) {
      const questions: EditorQuestion[] = set.questions.map((text) => ({
        id: nanoid(),
        text,
        type: template ? 'multiple_choice' : 'agree_disagree',
        options: template ? [...template.options] : null,
        timer_duration: null,
        template_id: templateId,
      }));

      const batch: EditorItem = {
        id: nanoid(),
        item_type: 'batch',
        batch: {
          name: set.name,
          questions,
          timer_duration: null,
          template_id: templateId,
          cover_image_path: null,
        },
      };

      addItem(batch, null);
    }

    // Reset and close
    setParsedSets([]);
    setFileName(null);
    setParseError(null);
    onClose();
  }

  function handleClose() {
    setParsedSets([]);
    setFileName(null);
    setParseError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Import Question Sets</h2>

        {/* Download template */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-sm text-gray-600">Download a template to fill in:</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadTemplate('csv')}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            >
              CSV Template
            </button>
            <button
              onClick={() => downloadTemplate('json')}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            >
              JSON Template
            </button>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload filled template
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-3 text-sm border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-500 hover:text-indigo-600 transition-colors"
          >
            {fileName ? `📄 ${fileName}` : 'Choose .csv or .json file…'}
          </button>
        </div>

        {/* Parse error */}
        {parseError && (
          <p className="text-sm text-red-600">{parseError}</p>
        )}

        {/* Preview */}
        {parsedSets.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {parsedSets.length} question set{parsedSets.length !== 1 ? 's' : ''} · {totalQuestions} total questions
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {parsedSets.map((set, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">{set.name}</p>
                  <p className="text-xs text-gray-500">{set.questions.length} question{set.questions.length !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default template checkbox */}
        {globalTemplateId && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={useDefaultTemplate}
              onChange={(e) => setUseDefaultTemplate(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Use default response template
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={parsedSets.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Import {parsedSets.length > 0 ? `${parsedSets.length} Sets (${totalQuestions} Questions)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
