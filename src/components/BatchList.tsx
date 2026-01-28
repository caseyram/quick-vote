import { useState, useMemo } from 'react';
import type { Batch, Question } from '../types/database';
import { BatchCard } from './BatchCard';
import QuestionForm from './QuestionForm';

interface BatchListProps {
  sessionId: string;
  batches: Batch[];
  questions: Question[];
  activeBatchId: string | null;
  activeQuestionId: string | null;
  onEditQuestion: (question: Question) => void;
  onDeleteQuestion: (question: Question) => void;
  onBatchNameChange: (batchId: string, name: string) => void;
  onQuestionReorder: (batchId: string, questionIds: string[]) => void;
  onAddQuestionToBatch: (batchId: string) => void;
  onCreateBatch: () => void;
  onDeleteBatch: (batchId: string) => void;
  onActivateBatch: (batchId: string) => void;
  onCloseBatch: (batchId: string) => void;
}

type ListItem =
  | { type: 'batch'; batch: Batch; createdAt: string }
  | { type: 'question'; question: Question; createdAt: string };

export function BatchList({
  sessionId,
  batches,
  questions,
  activeBatchId,
  activeQuestionId,
  onEditQuestion,
  onDeleteQuestion,
  onBatchNameChange,
  onQuestionReorder,
  onAddQuestionToBatch,
  onCreateBatch,
  onDeleteBatch,
  onActivateBatch,
  onCloseBatch,
}: BatchListProps) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [addingToBatchId, setAddingToBatchId] = useState<string | null>(null);

  // Create interleaved list sorted by created_at
  const interleavedItems = useMemo(() => {
    const items: ListItem[] = [];

    // Add batches
    for (const batch of batches) {
      items.push({
        type: 'batch',
        batch,
        createdAt: batch.created_at,
      });
    }

    // Add unbatched questions
    for (const question of questions) {
      if (question.batch_id === null) {
        items.push({
          type: 'question',
          question,
          createdAt: question.created_at,
        });
      }
    }

    // Sort by created_at ascending (oldest first)
    return items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [batches, questions]);

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

  // Empty state
  if (interleavedItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">
          No questions yet. Create a batch or add individual questions.
        </p>
        <button
          type="button"
          onClick={onCreateBatch}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
        >
          + New Batch
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* New Batch button at top */}
      <button
        type="button"
        onClick={onCreateBatch}
        className="w-full px-4 py-2 border border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
      >
        + New Batch
      </button>

      {/* Interleaved items */}
      {interleavedItems.map((item) => {
        if (item.type === 'batch') {
          return (
            <BatchCard
              key={item.batch.id}
              sessionId={sessionId}
              batch={item.batch}
              questions={getBatchQuestions(item.batch.id)}
              isExpanded={expandedBatchId === item.batch.id}
              isAddingQuestion={addingToBatchId === item.batch.id}
              isActive={activeBatchId === item.batch.id}
              canActivate={canActivateBatch(item.batch)}
              onToggle={() => handleBatchToggle(item.batch.id)}
              onNameChange={(name) => onBatchNameChange(item.batch.id, name)}
              onQuestionReorder={(ids) => onQuestionReorder(item.batch.id, ids)}
              onEditQuestion={onEditQuestion}
              onDeleteQuestion={onDeleteQuestion}
              onAddQuestion={() => {
                // Expand the batch and show the form
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

        // Unbatched question - simple card display (not draggable)
        return (
          <div
            key={item.question.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.question.type === 'agree_disagree'
                        ? 'bg-indigo-900 text-indigo-300'
                        : 'bg-emerald-900 text-emerald-300'
                    }`}
                  >
                    {item.question.type === 'agree_disagree'
                      ? 'Agree/Disagree'
                      : 'Multiple Choice'}
                  </span>
                  <span className="text-gray-500 text-xs">Unbatched</span>
                </div>
                <p className="text-white">{item.question.text}</p>
                {item.question.type === 'multiple_choice' && item.question.options && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.question.options.map((opt, optIdx) => (
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
                  onClick={() => onEditQuestion(item.question)}
                  className="px-2 py-1 text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteQuestion(item.question)}
                  className="px-2 py-1 text-gray-400 hover:text-red-400 text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
