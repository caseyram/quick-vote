import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Question } from '../types/database';

interface BatchQuestionItemProps {
  question: Question;
  index: number;
  onEdit: (question: Question) => void;
  onDelete: (question: Question) => void;
}

export function BatchQuestionItem({
  question,
  index,
  onEdit,
  onDelete,
}: BatchQuestionItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-700 border border-gray-600 rounded-lg p-3 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          className="mt-1 p-1 text-gray-400 hover:text-gray-200 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="pointer-events-none"
          >
            <rect x="4" y="3" width="8" height="2" rx="0.5" />
            <rect x="4" y="7" width="8" height="2" rx="0.5" />
            <rect x="4" y="11" width="8" height="2" rx="0.5" />
          </svg>
        </button>

        {/* Question content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-400 text-sm font-mono">{index + 1}.</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                question.type === 'agree_disagree'
                  ? 'bg-indigo-900 text-indigo-300'
                  : 'bg-emerald-900 text-emerald-300'
              }`}
            >
              {question.type === 'agree_disagree' ? 'Agree/Disagree' : 'Multiple Choice'}
            </span>
          </div>
          <p className="text-white text-sm">{question.text}</p>
          {question.type === 'multiple_choice' && question.options && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {question.options.map((opt, optIdx) => (
                <span
                  key={optIdx}
                  className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded text-xs"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(question)}
            className="px-2 py-1 text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(question)}
            className="px-2 py-1 text-gray-400 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
