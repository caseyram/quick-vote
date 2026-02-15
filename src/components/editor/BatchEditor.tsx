import { useState, useRef, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTemplateEditorStore } from '../../stores/template-editor-store';
import type { EditorItem, EditorQuestion } from '../../stores/template-editor-store';
import { useTemplateStore } from '../../stores/template-store';
import { fetchTemplates } from '../../lib/template-api';
import { getSlideImageUrl } from '../../lib/slide-api';
import { QuestionRow } from './QuestionRow';

interface BatchEditorProps {
  item: EditorItem;
}

export function BatchEditor({ item }: BatchEditorProps) {
  const { updateItem, items } = useTemplateEditorStore();
  const responseTemplates = useTemplateStore((s) => s.templates);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(item.batch?.name || '');
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [newQuestionId, setNewQuestionId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Fetch response templates on mount
  useEffect(() => {
    if (responseTemplates.length === 0) {
      fetchTemplates().catch(console.error);
    }
  }, [responseTemplates.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  if (!item.batch) return null;

  const questions = item.batch.questions;

  // Find the nearest preceding slide in the sequence for cover image
  const previousSlide = useMemo(() => {
    const idx = items.findIndex((i) => i.id === item.id);
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].item_type === 'slide' && items[i].slide?.image_path) {
        return items[i];
      }
    }
    return null;
  }, [items, item.id]);

  // Keep cover in sync when previous slide changes (e.g. after reorder)
  const previousSlidePath = previousSlide?.slide?.image_path ?? null;
  useEffect(() => {
    if (!item.batch?.cover_image_path) return; // cover not enabled
    if (item.batch.cover_image_path === previousSlidePath) return; // already correct
    updateItem(item.id, {
      batch: { ...item.batch!, cover_image_path: previousSlidePath },
    });
  }, [previousSlidePath]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const id = nanoid();

    // Inherit template from batch-level template_id
    let type: EditorQuestion['type'] = 'agree_disagree';
    let options: string[] | null = null;
    let templateId: string | null = null;

    if (item.batch?.template_id) {
      const template = responseTemplates.find((t) => t.id === item.batch!.template_id);
      if (template) {
        templateId = item.batch!.template_id;
        type = 'multiple_choice';
        options = [...template.options];
      }
    }

    const newQuestion: EditorQuestion = {
      id,
      text: '',
      type,
      options,
      timer_duration: null,
      template_id: templateId,
    };

    setCollapseSignal((prev) => prev + 1);
    setNewQuestionId(id);
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
    <div className="space-y-3">
      {/* Batch toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center gap-3">
        {/* Batch name */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleNameKeyDown}
            className="text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded px-2 py-0.5 min-w-0"
          />
        ) : (
          <h2
            onClick={handleStartEditName}
            className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 truncate"
          >
            {item.batch.name}
          </h2>
        )}

        {/* Question count badge */}
        <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {questions.length} {questions.length === 1 ? 'Q' : 'Qs'}
        </span>

        {/* Slide cover checkbox */}
        {previousSlide && (
          <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer group">
            <input
              type="checkbox"
              checked={!!item.batch.cover_image_path}
              onChange={(e) => {
                updateItem(item.id, {
                  batch: {
                    ...item.batch!,
                    cover_image_path: e.target.checked ? previousSlide.slide!.image_path : null,
                  },
                });
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <img
              src={getSlideImageUrl(previousSlide.slide!.image_path)}
              alt="Cover"
              className="w-6 h-6 rounded object-cover opacity-70 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-xs text-gray-500">Cover</span>
          </label>
        )}

        <div className="flex-1" />

        {/* Timer */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <input
            type="number"
            min="0"
            step="1"
            value={item.batch.timer_duration || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateItem(item.id, {
                batch: {
                  ...item.batch!,
                  timer_duration: val === '' || val === '0' ? null : parseInt(val) || null,
                },
              });
            }}
            placeholder="Timer"
            className="w-20 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm"
            title="Timer (seconds)"
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
                responseTemplates={responseTemplates}
                initialExpanded={question.id === newQuestionId}
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
