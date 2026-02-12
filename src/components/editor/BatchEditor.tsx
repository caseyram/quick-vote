import { useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem, EditorQuestion } from '../../stores/template-editor-store';
import { QuestionRow } from './QuestionRow';
import { DurationInput } from '../shared/DurationInput';

interface BatchEditorProps {
  item: EditorItem;
}

export function BatchEditor({ item }: BatchEditorProps) {
  const { updateItem } = useTemplateEditorStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(item.batch?.name || '');
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  if (!item.batch) return null;

  const questions = item.batch.questions;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveQuestionId(event.active.id as string);
    // Auto-collapse all expanded questions to prevent glitchy drag overlays
    setCollapseSignal((prev) => prev + 1);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuestionId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedQuestions = [...questions];
    const [movedQuestion] = reorderedQuestions.splice(oldIndex, 1);
    reorderedQuestions.splice(newIndex, 0, movedQuestion);

    updateItem(item.id, {
      batch: {
        ...item.batch!,
        questions: reorderedQuestions,
      },
    });
  };

  const handleUpdateQuestion = (questionId: string, updates: Partial<EditorQuestion>) => {
    const updatedQuestions = questions.map((q) =>
      q.id === questionId ? { ...q, ...updates } : q
    );
    updateItem(item.id, {
      batch: {
        ...item.batch!,
        questions: updatedQuestions,
      },
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    const updatedQuestions = questions.filter((q) => q.id !== questionId);
    updateItem(item.id, {
      batch: {
        ...item.batch!,
        questions: updatedQuestions,
      },
    });
  };

  const handleAddQuestion = () => {
    const newQuestion: EditorQuestion = {
      id: nanoid(),
      text: '',
      type: 'agree_disagree',
      options: null,
      anonymous: false,
      timer_duration: null,
      template_id: null,
    };

    updateItem(item.id, {
      batch: {
        ...item.batch!,
        questions: [...questions, newQuestion],
      },
    });
  };

  const handleStartEditName = () => {
    setIsEditingName(true);
    setEditedName(item.batch?.name || '');
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      updateItem(item.id, {
        batch: {
          ...item.batch!,
          name: editedName.trim(),
        },
      });
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setEditedName(item.batch?.name || '');
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  // Find active question for drag overlay
  const activeQuestion = activeQuestionId
    ? questions.find((q) => q.id === activeQuestionId)
    : null;

  return (
    <div className="space-y-6">
      {/* Batch header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleNameKeyDown}
                className="text-2xl font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded px-2 py-1 flex-1"
              />
            ) : (
              <h2
                onClick={handleStartEditName}
                className="text-2xl font-semibold text-gray-900 cursor-pointer hover:text-indigo-600"
              >
                {item.batch.name}
              </h2>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </p>
        </div>

        {/* Batch timer duration */}
        <div className="pt-4 border-t border-gray-200">
          <DurationInput
            value={item.batch.timer_duration || null}
            onChange={(value) => {
              updateItem(item.id, {
                batch: {
                  ...item.batch!,
                  timer_duration: value,
                },
              });
            }}
            label="Batch Timer (seconds)"
            placeholder="No timer"
          />
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {questions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
                onDelete={() => handleDeleteQuestion(question.id)}
                collapseSignal={collapseSignal}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeQuestion && (
              <div className="bg-white rounded-lg border border-gray-300 p-3 shadow-lg opacity-90">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    {activeQuestion.type === 'agree_disagree' ? 'A/D' : 'MC'}
                  </span>
                  <span className="text-sm text-gray-900 truncate">
                    {activeQuestion.text || 'New question...'}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Add question button */}
        <button
          onClick={handleAddQuestion}
          className="w-full px-4 py-3 text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          + Add Question
        </button>
      </div>
    </div>
  );
}
