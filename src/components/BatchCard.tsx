import { useState, useRef, useEffect, useId } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Batch, Question } from '../types/database';
import { BatchQuestionItem } from './BatchQuestionItem';
import QuestionForm from './QuestionForm';

interface BatchCardProps {
  sessionId: string;
  batch: Batch;
  questions: Question[];
  isExpanded: boolean;
  isAddingQuestion: boolean;
  isActive: boolean;
  canActivate: boolean;
  showActivateButton: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onQuestionReorder: (questionIds: string[]) => void;
  onEditQuestion: (question: Question) => void;
  onDeleteQuestion: (question: Question) => void;
  onAddQuestion: () => void;
  onAddQuestionDone: () => void;
  onDeleteBatch: () => void;
  onActivate: (batchId: string) => void;
  onClose: (batchId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export function BatchCard({
  sessionId,
  batch,
  questions,
  isExpanded,
  isAddingQuestion,
  isActive,
  canActivate,
  showActivateButton,
  onToggle,
  onNameChange,
  onQuestionReorder,
  onEditQuestion,
  onDeleteQuestion,
  onAddQuestion,
  onAddQuestionDone,
  onDeleteBatch,
  onActivate,
  onClose,
  dragHandleProps,
}: BatchCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(batch.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unique ID for this DndContext to prevent conflicts with parent DndContext
  const dndContextId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort questions by position
  const sortedQuestions = [...questions].sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  function handleNameClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(batch.name);
  }

  function handleNameBlur() {
    setIsEditingName(false);
    if (editedName.trim() && editedName !== batch.name) {
      onNameChange(editedName.trim());
    } else {
      setEditedName(batch.name);
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditedName(batch.name);
      setIsEditingName(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedQuestions.findIndex((q) => q.id === active.id);
      const newIndex = sortedQuestions.findIndex((q) => q.id === over.id);
      const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
      onQuestionReorder(reordered.map((q) => q.id));
    }
  }

  // Preview text for collapsed state
  const previewText = sortedQuestions
    .slice(0, 3)
    .map((q) => q.text)
    .join(' | ');

  // Determine card border/styling based on state
  const cardClassName = [
    'bg-gray-800 rounded-lg overflow-hidden transition-all duration-200',
    isActive
      ? 'border-2 border-green-500 shadow-lg shadow-green-500/20'
      : 'border border-indigo-700/50',
    batch.status === 'closed' ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClassName}>
      {/* Header - always visible */}
      <div className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-750 transition-colors text-left">
        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
            </svg>
          </div>
        )}

        {/* Chevron + toggle button */}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`text-gray-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          >
            <path d="M6 3l5 5-5 5V3z" />
          </svg>
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-gray-700 border border-indigo-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <span
              onClick={handleNameClick}
              className="text-white font-medium cursor-text hover:text-indigo-300 transition-colors"
            >
              {batch.name}
            </span>
          )}
        </div>

        {/* Question count badge */}
        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs shrink-0">
          {sortedQuestions.length} question{sortedQuestions.length !== 1 ? 's' : ''}
        </span>

        {/* Activate/Close button - only shown when session is active */}
        {showActivateButton && batch.status !== 'closed' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              isActive ? onClose(batch.id) : onActivate(batch.id);
            }}
            disabled={!isActive && !canActivate}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors shrink-0 ${
              isActive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : canActivate
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60'
            }`}
            title={
              !canActivate && !isActive
                ? 'Close active question or batch first'
                : isActive
                  ? 'Close batch voting'
                  : 'Start batch voting'
            }
          >
            {isActive ? '\u25A0 Close' : '\u25B6 Activate'}
          </button>
        )}

        {/* Closed status indicator */}
        {batch.status === 'closed' && (
          <span className="px-2 py-1 text-xs text-gray-400 bg-gray-700 rounded">
            Closed
          </span>
        )}

        {/* Delete batch button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteBatch();
          }}
          className="px-2 py-1 text-gray-400 hover:text-red-400 text-xs font-medium transition-colors shrink-0"
          title="Delete batch"
        >
          Delete
        </button>
      </div>

      {/* Collapsed preview */}
      {!isExpanded && sortedQuestions.length > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-gray-500 text-xs line-clamp-1">{previewText}</p>
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
          {sortedQuestions.length === 0 ? (
            <div className="text-center py-4">
              {isAddingQuestion ? (
                <div className="bg-gray-900 rounded-lg p-4 text-left">
                  <QuestionForm
                    sessionId={sessionId}
                    batchId={batch.id}
                    onSaved={onAddQuestionDone}
                    onCancel={onAddQuestionDone}
                  />
                </div>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-3">No questions yet</p>
                  <button
                    type="button"
                    onClick={onAddQuestion}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors"
                  >
                    + Add Question
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <DndContext
                id={dndContextId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedQuestions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedQuestions.map((question, index) => (
                      <BatchQuestionItem
                        key={question.id}
                        question={question}
                        index={index}
                        onEdit={onEditQuestion}
                        onDelete={onDeleteQuestion}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {isAddingQuestion ? (
                <div className="mt-3 bg-gray-900 rounded-lg p-4">
                  <QuestionForm
                    sessionId={sessionId}
                    batchId={batch.id}
                    onSaved={onAddQuestionDone}
                    onCancel={onAddQuestionDone}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAddQuestion}
                  className="mt-3 w-full px-3 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 text-sm rounded transition-colors"
                >
                  + Add Question
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
