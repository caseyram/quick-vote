import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ResponseTemplate } from '../types/database';

interface TemplateEditorProps {
  template?: ResponseTemplate | null;  // null = create mode, object = edit mode
  onSave: (name: string, options: string[]) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
}

interface SortableOptionProps {
  optionId: string;
  value: string;
  index: number;
  canRemove: boolean;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

function SortableOption({
  optionId,
  value,
  index,
  canRemove,
  onChange,
  onRemove,
}: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: optionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </div>

      {/* Option input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(index, e.target.value)}
        placeholder={`Option ${index + 1}`}
        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-2 py-2 text-red-500 hover:text-red-400 text-sm font-medium"
          aria-label={`Remove option ${index + 1}`}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  saving = false,
  error = null,
}: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!template;

  // Initialize form from template if editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setOptions([...template.options]);
    } else {
      setName('');
      setOptions(['', '']);
    }
    setValidationError(null);
  }, [template]);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = options.findIndex((_, i) => `option-${i}` === active.id);
    const newIndex = options.findIndex((_, i) => `option-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setOptions(arrayMove(options, oldIndex, newIndex));
    }
  }

  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
    setValidationError(null);
  }

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleInputChange(value: string) {
    setName(value);
    setValidationError(null);
  }

  async function handleSave() {
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Template name is required');
      return;
    }

    // Validate options
    const filteredOptions = options
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (filteredOptions.length < 2) {
      setValidationError('At least 2 non-empty options are required');
      return;
    }

    // Check for duplicates (case-sensitive, after trim)
    const uniqueOptions = new Set(filteredOptions);
    if (uniqueOptions.size !== filteredOptions.length) {
      setValidationError('Options must be unique (no duplicates)');
      return;
    }

    // Call onSave
    await onSave(trimmedName, filteredOptions);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }

  const sortableIds = options.map((_, index) => `option-${index}`);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditMode ? 'Edit Template' : 'Create Template'}
        </h3>

        {/* Name input */}
        <div>
          <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            ref={nameInputRef}
            id="template-name"
            type="text"
            value={name}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Options list with drag-and-drop */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Options</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {options.map((opt, index) => (
                  <SortableOption
                    key={`option-${index}`}
                    optionId={`option-${index}`}
                    value={opt}
                    index={index}
                    canRemove={options.length > 2}
                    onChange={handleOptionChange}
                    onRemove={removeOption}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add Option button */}
          {options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
            >
              + Add Option
            </button>
          )}
        </div>

        {/* Error messages */}
        {(validationError || error) && (
          <p className="text-red-500 text-sm">{validationError || error}</p>
        )}

        {/* Footer buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium disabled:text-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
