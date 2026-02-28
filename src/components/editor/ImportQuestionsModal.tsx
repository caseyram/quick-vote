import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useTemplateStore } from '../../stores/template-store';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem, EditorQuestion } from '../../stores/template-editor-store';

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportQuestionsModal({ isOpen, onClose }: ImportQuestionsModalProps) {
  const [questionsText, setQuestionsText] = useState('');
  const [setName, setSetName] = useState('');
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const responseTemplates = useTemplateStore((s) => s.templates);
  const globalTemplateId = useTemplateEditorStore((s) => s.globalTemplateId);
  const addItem = useTemplateEditorStore((s) => s.addItem);

  if (!isOpen) return null;

  const lines = questionsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const handleImport = () => {
    if (lines.length === 0) return;

    const templateId = useDefaultTemplate ? globalTemplateId : null;
    const template = templateId ? responseTemplates.find((t) => t.id === templateId) : null;

    const questions: EditorQuestion[] = lines.map((line) => ({
      id: nanoid(),
      text: line,
      type: template ? 'multiple_choice' : 'agree_disagree',
      options: template ? [...template.options] : null,
      timer_duration: null,
      template_id: templateId,
    }));

    const batch: EditorItem = {
      id: nanoid(),
      item_type: 'batch',
      batch: {
        name: setName.trim() || `Imported (${questions.length} questions)`,
        questions,
        timer_duration: null,
        template_id: templateId,
        cover_image_path: null,
      },
    };

    addItem(batch, null);
    setQuestionsText('');
    setSetName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Import Questions</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Set Name
          </label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="e.g. Team Health Assessment"
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Questions <span className="text-gray-400 font-normal">(one per line)</span>
          </label>
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder={"We communicate effectively as a team.\nOur team meetings are productive.\nI feel supported by my teammates."}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm resize-none"
            rows={8}
          />
          {lines.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{lines.length} question{lines.length !== 1 ? 's' : ''} detected</p>
          )}
        </div>

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

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={lines.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Import {lines.length > 0 ? `${lines.length} Questions` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
