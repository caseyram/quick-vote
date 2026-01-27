import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { aggregateVotes, type VoteCount } from '../lib/vote-aggregation';
import type { Question, Vote } from '../types/database';

interface AdminQuestionControlProps {
  question: Question;
  sessionId: string;
  isActive: boolean;
  isClosed: boolean;
}

export default function AdminQuestionControl({
  question,
  sessionId,
  isActive,
  isClosed,
}: AdminQuestionControlProps) {
  const updateQuestion = useSessionStore((s) => s.updateQuestion);
  const [loading, setLoading] = useState(false);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [aggregated, setAggregated] = useState<VoteCount[]>([]);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('question_id', question.id);

    if (data) {
      setVotes(data);
      setAggregated(aggregateVotes(data));
    }
  }, [question.id]);

  // Poll votes every 3 seconds for active questions
  useEffect(() => {
    if (!isActive) return;

    fetchVotes();

    const interval = setInterval(fetchVotes, 3000);
    return () => clearInterval(interval);
  }, [isActive, fetchVotes]);

  // Fetch votes once for closed/revealed questions
  useEffect(() => {
    if (isClosed) {
      fetchVotes();
    }
  }, [isClosed, fetchVotes]);

  async function handleActivate() {
    setLoading(true);

    // Close any currently active questions for this session
    await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('session_id', sessionId)
      .eq('status', 'active');

    // Update closed questions in store
    const questions = useSessionStore.getState().questions;
    for (const q of questions) {
      if (q.status === 'active' && q.session_id === sessionId) {
        updateQuestion(q.id, { status: 'closed' });
      }
    }

    // Activate this question
    const { error } = await supabase
      .from('questions')
      .update({ status: 'active' as const })
      .eq('id', question.id);

    if (!error) {
      updateQuestion(question.id, { status: 'active' });
    }

    setLoading(false);
  }

  async function handleCloseVoting() {
    setLoading(true);

    const { error } = await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('id', question.id);

    if (!error) {
      updateQuestion(question.id, { status: 'closed' });
      // Automatically show results after closing
      setShowBreakdown(true);
      await fetchVotes();
    }

    setLoading(false);
  }

  const isPending = question.status === 'pending';
  const isRevealed = question.status === 'revealed';
  const showResults = isClosed || isRevealed;

  return (
    <div className="space-y-3">
      {/* Anonymous/Named badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            question.anonymous
              ? 'bg-gray-700 text-gray-300'
              : 'bg-amber-900 text-amber-300'
          }`}
        >
          {question.anonymous ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Anonymous
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Named
            </>
          )}
        </span>
      </div>

      {/* Pending state: Show Start button */}
      {isPending && (
        <button
          onClick={handleActivate}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Starting...' : 'Start'}
        </button>
      )}

      {/* Active state: Show vote count and close button */}
      {isActive && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              {showBreakdown ? (
                <div className="space-y-1">
                  {aggregated.length === 0 ? (
                    <p className="text-gray-500">No votes yet</p>
                  ) : (
                    aggregated.map((vc) => (
                      <p key={vc.value}>
                        {vc.value}: {vc.count} ({vc.percentage}%)
                      </p>
                    ))
                  )}
                </div>
              ) : (
                <p>{votes.length} vote{votes.length !== 1 ? 's' : ''} cast</p>
              )}
            </div>
            <button
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {showBreakdown ? 'Show count' : 'Show breakdown'}
            </button>
          </div>

          <button
            onClick={handleCloseVoting}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Closing...' : 'Close Voting'}
          </button>
        </div>
      )}

      {/* Closed/Revealed state: Show aggregated results */}
      {showResults && (
        <div className="space-y-2">
          {aggregated.length === 0 ? (
            <p className="text-gray-500 text-sm">No votes recorded</p>
          ) : (
            <>
              {aggregated.map((vc) => (
                <div key={vc.value} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{vc.value}</span>
                    <span className="text-gray-400">
                      {vc.count} ({vc.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-indigo-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${vc.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500 mt-1">
                Total: {votes.length} vote{votes.length !== 1 ? 's' : ''}
              </p>
            </>
          )}

          {/* Named votes: show voter names for closed named questions */}
          {!question.anonymous && votes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400 font-medium mb-2">Voter details</p>
              <div className="space-y-1">
                {votes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      {v.display_name || 'Anonymous'}
                    </span>
                    <span className="text-gray-300 font-medium">{v.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
