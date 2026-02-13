import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EditorQuestion } from '../../stores/template-editor-store';
import type { ResponseTemplate } from '../../types/database';

interface QuestionRowProps {
  question: EditorQuestion;
  onUpdate: (updates: Partial<EditorQuestion>) => void;
  onDelete: () => void;
  collapseSignal: number;
  responseTemplates: ResponseTemplate[];
  initialExpanded?: boolean;
}

export function QuestionRow({ question, onUpdate, onDelete, collapseSignal, responseTemplates, initialExpanded = false }: QuestionRowProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Auto-collapse when collapseSignal changes
  useEffect(() => {
    if (collapseSignal > 0) {
      setIsExpanded(false);
    }
  }, [collapseSignal]);

  // Auto-focus textarea on expand
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCollapse();
    }
  };

  const handleTypeChange = (type: 'agree_disagree' | 'multiple_choice') => {
    onUpdate({
      type,
      options: type === 'multiple_choice' ? (question.options || ['Option 1', 'Option 2']) : null,
      template_id: null, // Clear template when manually changing type
    });
  };

  const handleTemplateChange = (templateId: string | null) => {
    if (!templateId) {
      // Clearing template — keep current type and options
      onUpdate({ template_id: null });
      return;
    }
    const template = responseTemplates.find((t) => t.id === templateId);
    if (template) {
      onUpdate({
        template_id: templateId,
        type: 'multiple_choice',
        options: [...template.options],
      });
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
    onUpdate({ options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    if ((question.options?.length || 0) <= 2) return; // Min 2 options
    const newOptions = question.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options: newOptions });
  };

  // Type badge text
  const typeBadge = question.type === 'agree_disagree' ? 'A/D' : 'MC';

  if (!isExpanded) {
    // Collapsed state: compact row with drag handle
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          {/* Drag handle - only visible when collapsed */}
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>

          {/* Type badge */}
          <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
            {typeBadge}
          </span>

          {/* Question text (truncated) */}
          <span className="flex-1 text-sm text-gray-900 truncate">
            {question.text || 'New question...'}
          </span>

          {/* Expand chevron */}
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  // Expanded state: inline editing form
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-300 p-4 space-y-4"
      onKeyDown={handleKeyDown}
    >
      {/* Header with collapse button */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Edit Question</h3>
        <button
          onClick={handleCollapse}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Question Text
        </label>
        <textarea
          ref={textareaRef}
          value={question.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Enter your question..."
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm resize-none"
          rows={3}
        />
      </div>

      {/* Response template */}
      {responseTemplates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Template
          </label>
          <select
            value={question.template_id ?? ''}
            onChange={(e) => handleTemplateChange(e.target.value || null)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
          >
            <option value="">None (custom)</option>
            {responseTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Response type (only show when no template selected) */}
      {!question.template_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Type
          </label>
          <select
            value={question.type}
            onChange={(e) => handleTypeChange(e.target.value as 'agree_disagree' | 'multiple_choice')}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
          >
            <option value="agree_disagree">Agree/Disagree</option>
            <option value="multiple_choice">Multiple Choice</option>
          </select>
        </div>
      )}

      {/* Options (if multiple choice and no template) */}
      {question.type === 'multiple_choice' && !question.template_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
                />
                {(question.options?.length || 0) > 2 && (
                  <button
                    onClick={() => handleRemoveOption(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddOption}
              className="w-full px-3 py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
            >
              + Add Option
            </button>
          </div>
        </div>
      )}

      {/* Template options preview (read-only when template selected) */}
      {question.type === 'multiple_choice' && question.template_id && question.options && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options <span className="text-gray-400 font-normal">(from template)</span>
          </label>
          <div className="space-y-1">
            {question.options.map((option, index) => (
              <div key={index} className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">
                {option}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer override */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Question Timer Override (seconds)
        </label>
        <input
          type="number"
          min="0"
          value={question.timer_duration || ''}
          onChange={(e) => onUpdate({ timer_duration: e.target.value ? parseInt(e.target.value) : null })}
          placeholder="Optional timer override"
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
        />
      </div>

      {/* Delete button */}
      <div className="flex justify-end pt-2 border-t border-gray-200">
        <button
          onClick={onDelete}
          className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
        >
          Delete Question
        </button>
      </div>
    </div>
  );
}
