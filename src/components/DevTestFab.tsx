import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Question } from '../types/database';

interface DevTestFabProps {
  sessionId: string;
  testMode: boolean;
  activeQuestion: Question | null;
  activeBatchId: string | null;
  batchQuestionIds: string[];
  teams?: string[];
}

const VOTE_OPTIONS = [
  { label: '+5 votes', count: 5 },
  { label: '+15 votes', count: 15 },
  { label: '+30 votes', count: 30 },
];

export function DevTestFab({
  sessionId,
  testMode,
  activeQuestion,
  activeBatchId,
  batchQuestionIds,
  teams,
}: DevTestFabProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!testMode) return null;

  const hasTarget = !!activeQuestion || (!!activeBatchId && batchQuestionIds.length > 0);

  async function addVotes(count: number, questionIds: string[]) {
    setLoading(true);
    setFeedback(null);
    try {
      let total = 0;
      for (const qId of questionIds) {
        const { data, error } = await supabase.rpc('insert_test_votes', {
          p_session_id: sessionId,
          p_question_id: qId,
          p_count: count,
          p_teams: teams && teams.length > 0 ? teams : [],
        });
        if (error) throw error;
        total += (data as number) ?? 0;
      }
      setFeedback(`+${total} votes`);
      setTimeout(() => setFeedback(null), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setFeedback(`Error: ${msg}`);
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  function handleOption(count: number) {
    if (activeBatchId && batchQuestionIds.length > 0) {
      addVotes(count, batchQuestionIds);
    } else if (activeQuestion) {
      addVotes(count, [activeQuestion.id]);
    }
  }

  return (
    <div className="fixed bottom-20 left-4 z-50">
      {/* Feedback toast */}
      {feedback && (
        <div className="absolute bottom-14 left-0 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {feedback}
        </div>
      )}

      {/* Menu */}
      {open && hasTarget && (
        <div className="absolute bottom-14 left-0 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[140px]">
          <div className="px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100">
            {activeBatchId ? 'Batch votes' : 'Question votes'}
          </div>
          {VOTE_OPTIONS.map((opt) => (
            <button
              key={opt.count}
              onClick={() => handleOption(opt.count)}
              disabled={loading}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!hasTarget || loading}
        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all
          ${hasTarget
            ? 'bg-amber-500 hover:bg-amber-400 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
          ${loading ? 'animate-pulse' : ''}
        `}
        title="Add test votes"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </button>
    </div>
  );
}
