import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import type { Question } from '../types/database';

interface QuestionListProps {
  onEditQuestion: (question: Question) => void;
}

export default function QuestionList({ onEditQuestion }: QuestionListProps) {
  const questions = useSessionStore((s) => s.questions);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(question: Question) {
    if (!window.confirm(`Delete question "${question.text}"?`)) return;

    setDeletingId(question.id);
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', question.id);

    if (!error) {
      useSessionStore.getState().removeQuestion(question.id);
    }
    setDeletingId(null);
  }

  async function moveQuestion(index: number, direction: 'up' | 'down') {
    const sorted = [...questions]; // already sorted by position from store
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const current = sorted[index];
    const target = sorted[targetIndex];
    const currentPos = current.position;
    const targetPos = target.position;

    setMovingId(current.id);

    // Use individual updates for reliability (avoids upsert NOT NULL column issues)
    const [res1, res2] = await Promise.all([
      supabase.from('questions').update({ position: targetPos }).eq('id', current.id),
      supabase.from('questions').update({ position: currentPos }).eq('id', target.id),
    ]);

    if (!res1.error && !res2.error) {
      const newOrder = [...sorted];
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      useSessionStore.getState().reorderQuestions(newOrder.map((q) => q.id));
    }

    setMovingId(null);
  }

  if (questions.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No questions yet. Add your first question using the form below.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {questions.map((q, index) => (
        <li
          key={q.id}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400 text-sm font-mono">{index + 1}.</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    q.type === 'agree_disagree'
                      ? 'bg-indigo-900 text-indigo-300'
                      : 'bg-emerald-900 text-emerald-300'
                  }`}
                >
                  {q.type === 'agree_disagree' ? 'Agree/Disagree' : 'Multiple Choice'}
                </span>
              </div>
              <p className="text-white">{q.text}</p>
              {q.type === 'multiple_choice' && q.options && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {q.options.map((opt, optIdx) => (
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
                onClick={() => moveQuestion(index, 'up')}
                disabled={index === 0 || movingId !== null}
                className="px-2 py-1 text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed text-sm transition-colors"
                aria-label="Move up"
                title="Move up"
              >
                &#9650;
              </button>
              <button
                onClick={() => moveQuestion(index, 'down')}
                disabled={index === questions.length - 1 || movingId !== null}
                className="px-2 py-1 text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed text-sm transition-colors"
                aria-label="Move down"
                title="Move down"
              >
                &#9660;
              </button>
              <button
                onClick={() => onEditQuestion(q)}
                className="px-2 py-1 text-gray-400 hover:text-indigo-400 text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(q)}
                disabled={deletingId === q.id}
                className="px-2 py-1 text-gray-400 hover:text-red-400 disabled:text-gray-700 text-sm font-medium transition-colors"
              >
                {deletingId === q.id ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
