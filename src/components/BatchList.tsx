import { useState, useMemo, useId } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Batch, Question } from '../types/database';
import { BatchCard } from './BatchCard';
import QuestionForm from './QuestionForm';

interface BatchListProps {
  sessionId: string;
  batches: Batch[];
  questions: Question[];
  activeBatchId: string | null;
  activeQuestionId: string | null;
  editingQuestion: Question | null;
  showActivateButton: boolean;
  onEditQuestion: (question: Question) => void;
  onCancelEdit: () => void;
  onDeleteQuestion: (question: Question) => void;
  onBatchNameChange: (batchId: string, name: string) => void;
  onQuestionReorder: (batchId: string, questionIds: string[]) => void;
  onAddQuestionToBatch: (batchId: string) => void;
  onCreateBatch: () => void;
  onDeleteBatch: (batchId: string) => void;
  onActivateBatch: (batchId: string) => void;
  onCloseBatch: (batchId: string) => void;
  onMoveQuestionToBatch?: (questionId: string, batchId: string | null) => void;
  onReorderItems?: (itemIds: string[]) => void;
}

type ListItem =
  | { type: 'batch'; batch: Batch; id: string; position: number }
  | { type: 'question'; question: Question; id: string; position: number };

// Sortable wrapper for unbatched questions
function SortableQuestionCard({
  question,
  isEditing,
  editingQuestion,
  sessionId,
  onEditQuestion,
  onDeleteQuestion,
  onCancelEdit,
}: {
  question: Question;
  isEditing: boolean;
  editingQuestion: Question | null;
  sessionId: string;
  onEditQuestion: (q: Question) => void;
  onDeleteQuestion: (q: Question) => void;
  onCancelEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `question-${question.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="bg-gray-800 border border-indigo-500 rounded-lg p-4">
        <QuestionForm
          sessionId={sessionId}
          editingQuestion={editingQuestion!}
          onSaved={onCancelEdit}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-800 border border-gray-700 rounded-lg p-4"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                question.type === 'agree_disagree'
                  ? 'bg-indigo-900 text-indigo-300'
                  : 'bg-emerald-900 text-emerald-300'
              }`}
            >
              {question.type === 'agree_disagree'
                ? 'Agree/Disagree'
                : 'Multiple Choice'}
            </span>
            <span className="text-gray-500 text-xs">Unbatched</span>
          </div>
          <p className="text-white">{question.text}</p>
          {question.type === 'multiple_choice' && question.options && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {question.options.map((opt, optIdx) => (
                <span
                  key={optIdx}
                  className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
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
            onClick={() => onEditQuestion(question)}
            className="px-2 py-1 text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDeleteQuestion(question)}
            className="px-2 py-1 text-gray-400 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Sortable wrapper for batches
function SortableBatchCard({
  batch,
  sessionId,
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
  onActivateBatch,
  onCloseBatch,
}: {
  batch: Batch;
  sessionId: string;
  questions: Question[];
  isExpanded: boolean;
  isAddingQuestion: boolean;
  isActive: boolean;
  canActivate: boolean;
  showActivateButton: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onQuestionReorder: (ids: string[]) => void;
  onEditQuestion: (q: Question) => void;
  onDeleteQuestion: (q: Question) => void;
  onAddQuestion: () => void;
  onAddQuestionDone: () => void;
  onDeleteBatch: () => void;
  onActivateBatch: (batchId: string) => void;
  onCloseBatch: (batchId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `batch-${batch.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BatchCard
        sessionId={sessionId}
        batch={batch}
        questions={questions}
        isExpanded={isExpanded}
        isAddingQuestion={isAddingQuestion}
        isActive={isActive}
        canActivate={canActivate}
        showActivateButton={showActivateButton}
        onToggle={onToggle}
        onNameChange={onNameChange}
        onQuestionReorder={onQuestionReorder}
        onEditQuestion={onEditQuestion}
        onDeleteQuestion={onDeleteQuestion}
        onAddQuestion={onAddQuestion}
        onAddQuestionDone={onAddQuestionDone}
        onDeleteBatch={onDeleteBatch}
        onActivate={onActivateBatch}
        onClose={onCloseBatch}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function BatchList({
  sessionId,
  batches,
  questions,
  activeBatchId,
  activeQuestionId,
  editingQuestion,
  showActivateButton,
  onEditQuestion,
  onCancelEdit,
  onDeleteQuestion,
  onBatchNameChange,
  onQuestionReorder,
  onAddQuestionToBatch,
  onCreateBatch,
  onDeleteBatch,
  onActivateBatch,
  onCloseBatch,
  onMoveQuestionToBatch,
  onReorderItems,
}: BatchListProps) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [addingToBatchId, setAddingToBatchId] = useState<string | null>(null);
  const [addingUnbatchedQuestion, setAddingUnbatchedQuestion] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Unique ID for this DndContext to prevent conflicts with nested DndContext in BatchCard
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

  // Create interleaved list sorted by position
  const interleavedItems = useMemo(() => {
    const items: ListItem[] = [];

    // Add batches with their positions
    for (const batch of batches) {
      items.push({
        type: 'batch',
        batch,
        id: `batch-${batch.id}`,
        position: batch.position,
      });
    }

    // Add unbatched questions
    for (const question of questions) {
      if (question.batch_id === null) {
        items.push({
          type: 'question',
          question,
          id: `question-${question.id}`,
          position: question.position,
        });
      }
    }

    // Sort by position ascending
    return items.sort((a, b) => a.position - b.position);
  }, [batches, questions]);

  const sortableIds = interleavedItems.map((item) => item.id);

  // Get questions for a specific batch
  function getBatchQuestions(batchId: string): Question[] {
    return questions.filter((q) => q.batch_id === batchId);
  }

  // Compute whether a specific batch can be activated
  const isLiveQuestionActive = activeQuestionId !== null;
  function canActivateBatch(batch: Batch): boolean {
    if (batch.status !== 'pending') return false;
    if (isLiveQuestionActive) return false;
    if (activeBatchId && activeBatchId !== batch.id) return false;
    const batchQuestions = getBatchQuestions(batch.id);
    return batchQuestions.length > 0;
  }

  function handleBatchToggle(batchId: string) {
    setExpandedBatchId((prev) => (prev === batchId ? null : batchId));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    // Ignore events from nested batch item drags
    if (id.startsWith('batch-item-')) {
      return;
    }
    setActiveId(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeIdStr = active.id as string;

    // Ignore events from nested batch item drags
    if (activeIdStr.startsWith('batch-item-')) {
      return;
    }

    setActiveId(null);

    if (!over || active.id === over.id) return;

    const overIdStr = over.id as string;

    // Reorder items (questions and batches can be reordered relative to each other)
    if (onReorderItems) {
      const oldIndex = sortableIds.indexOf(activeIdStr);
      const newIndex = sortableIds.indexOf(overIdStr);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...sortableIds];
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, activeIdStr);
        onReorderItems(newOrder);
      }
    }
  }

  // Find active item for drag overlay
  const activeItem = activeId
    ? interleavedItems.find((item) => item.id === activeId)
    : null;

  // Empty state
  if (interleavedItems.length === 0 && !addingUnbatchedQuestion && !editingQuestion) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            No questions yet. Create a batch to group questions, or add standalone questions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCreateBatch}
            className="flex-1 px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
          >
            + New Batch
          </button>
          <button
            type="button"
            onClick={() => setAddingUnbatchedQuestion(true)}
            className="flex-1 px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
          >
            + Standalone Question
          </button>
        </div>
      </div>
    );
  }

  // Show form if adding unbatched question in empty state
  if (interleavedItems.length === 0 && addingUnbatchedQuestion) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <QuestionForm
            sessionId={sessionId}
            onSaved={() => setAddingUnbatchedQuestion(false)}
            onCancel={() => setAddingUnbatchedQuestion(false)}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCreateBatch}
            className="flex-1 px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
          >
            + New Batch
          </button>
          <button
            type="button"
            disabled
            className="flex-1 px-4 py-2 border border-dashed border-gray-300 text-gray-300 rounded-lg cursor-not-allowed"
          >
            + Standalone Question
          </button>
        </div>
      </div>
    );
  }

  // Render mixed items - expanded batch is static, everything else is sortable
  const renderMixedItems = () => (
    <>
      {interleavedItems.map((item) => {
        if (item.type === 'batch') {
          // If this batch is expanded, render it statically to avoid DndContext conflicts
          if (expandedBatchId === item.batch.id) {
            return (
              <BatchCard
                key={item.id}
                batch={item.batch}
                sessionId={sessionId}
                questions={getBatchQuestions(item.batch.id)}
                isExpanded={true}
                isAddingQuestion={addingToBatchId === item.batch.id}
                isActive={activeBatchId === item.batch.id}
                canActivate={canActivateBatch(item.batch)}
                showActivateButton={showActivateButton}
                onToggle={() => handleBatchToggle(item.batch.id)}
                onNameChange={(name) => onBatchNameChange(item.batch.id, name)}
                onQuestionReorder={(ids) => onQuestionReorder(item.batch.id, ids)}
                onEditQuestion={onEditQuestion}
                onDeleteQuestion={onDeleteQuestion}
                onAddQuestion={() => {
                  setExpandedBatchId(item.batch.id);
                  setAddingToBatchId(item.batch.id);
                }}
                onAddQuestionDone={() => setAddingToBatchId(null)}
                onDeleteBatch={() => onDeleteBatch(item.batch.id)}
                onActivate={onActivateBatch}
                onClose={onCloseBatch}
              />
            );
          }
          // Collapsed batches are sortable
          return (
            <SortableBatchCard
              key={item.id}
              batch={item.batch}
              sessionId={sessionId}
              questions={getBatchQuestions(item.batch.id)}
              isExpanded={false}
              isAddingQuestion={addingToBatchId === item.batch.id}
              isActive={activeBatchId === item.batch.id}
              canActivate={canActivateBatch(item.batch)}
              showActivateButton={showActivateButton}
              onToggle={() => handleBatchToggle(item.batch.id)}
              onNameChange={(name) => onBatchNameChange(item.batch.id, name)}
              onQuestionReorder={(ids) => onQuestionReorder(item.batch.id, ids)}
              onEditQuestion={onEditQuestion}
              onDeleteQuestion={onDeleteQuestion}
              onAddQuestion={() => {
                setExpandedBatchId(item.batch.id);
                setAddingToBatchId(item.batch.id);
              }}
              onAddQuestionDone={() => setAddingToBatchId(null)}
              onDeleteBatch={() => onDeleteBatch(item.batch.id)}
              onActivateBatch={onActivateBatch}
              onCloseBatch={onCloseBatch}
            />
          );
        }

        const isEditing = editingQuestion?.id === item.question.id;
        return (
          <SortableQuestionCard
            key={item.id}
            question={item.question}
            isEditing={isEditing}
            editingQuestion={editingQuestion}
            sessionId={sessionId}
            onEditQuestion={onEditQuestion}
            onDeleteQuestion={onDeleteQuestion}
            onCancelEdit={onCancelEdit}
          />
        );
      })}
    </>
  );

  // Filter sortable IDs to exclude the expanded batch (it's rendered statically)
  const activeSortableIds = expandedBatchId
    ? sortableIds.filter((id) => id !== `batch-${expandedBatchId}`)
    : sortableIds;

  return (
    <div className="space-y-3">
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeSortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">{renderMixedItems()}</div>
        </SortableContext>

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeItem && activeItem.type === 'question' && (
            <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4 shadow-lg opacity-90">
              <p className="text-white">{activeItem.question.text}</p>
            </div>
          )}
          {activeItem && activeItem.type === 'batch' && (
            <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4 shadow-lg opacity-90">
              <p className="text-white font-medium">{activeItem.batch.name}</p>
              <p className="text-gray-400 text-sm">
                {getBatchQuestions(activeItem.batch.id).length} questions
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add unbatched question form */}
      {addingUnbatchedQuestion && (
        <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4">
          <QuestionForm
            sessionId={sessionId}
            onSaved={() => setAddingUnbatchedQuestion(false)}
            onCancel={() => setAddingUnbatchedQuestion(false)}
          />
        </div>
      )}

      {/* Bottom buttons - side by side */}
      {!addingUnbatchedQuestion && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCreateBatch}
            className="flex-1 px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
          >
            + New Batch
          </button>
          <button
            type="button"
            onClick={() => setAddingUnbatchedQuestion(true)}
            className="flex-1 px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
          >
            + Standalone Question
          </button>
        </div>
      )}
    </div>
  );
}
