import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useCountdown } from '../hooks/use-countdown';
import { aggregateVotes } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';
import { CountdownTimer } from './CountdownTimer';
import type { Question, Vote } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RefObject } from 'react';

interface AdminQuestionControlProps {
  question: Question;
  sessionId: string;
  isActive: boolean;
  isClosed: boolean;
  channelRef: RefObject<RealtimeChannel | null>;
  votes: Vote[];
  projectionMode?: boolean;
  hideControls?: boolean;
  theme?: 'dark' | 'light';
  onActivate?: (questionId: string, timerDuration: number | null) => void;
  onCloseVoting?: (questionId: string) => void;
}

export default function AdminQuestionControl({
  question,
  sessionId,
  isActive,
  isClosed,
  channelRef,
  votes,
  projectionMode,
  hideControls,
  theme = 'dark',
  onActivate,
  onCloseVoting,
}: AdminQuestionControlProps) {
  const updateQuestion = useSessionStore((s) => s.updateQuestion);
  const [loading, setLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);

  // Compute aggregated vote data from props
  const aggregated = useMemo(() => aggregateVotes(votes), [votes]);

  // Sort votes by id for stable rendering order (prevents reordering while reading)
  const sortedVotes = useMemo(() => [...votes].sort((a, b) => a.id.localeCompare(b.id)), [votes]);

  // Compute bar chart data
  const barData = useMemo(() => {
    return aggregated.map((vc, index) => {
      let color: string;
      if (question.type === 'agree_disagree') {
        const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
        color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
      } else {
        color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
      }
      return {
        label: vc.value,
        count: vc.count,
        percentage: vc.percentage,
        color,
      };
    });
  }, [aggregated, question.type]);

  // Timer auto-close handler
  async function handleTimerComplete() {
    await handleCloseVoting();
  }

  const { remaining, isRunning, start: startCountdown, stop: stopCountdown } = useCountdown(handleTimerComplete);

  async function handleActivate() {
    if (onActivate) {
      onActivate(question.id, timerDuration);
      return;
    }

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

      // Broadcast question activation
      channelRef.current?.send({
        type: 'broadcast',
        event: 'question_activated',
        payload: { questionId: question.id, timerSeconds: timerDuration },
      });

      // Start countdown timer if duration is set
      if (timerDuration) {
        startCountdown(timerDuration * 1000);
      }
    }

    setLoading(false);
  }

  async function handleCloseVoting() {
    if (onCloseVoting) {
      onCloseVoting(question.id);
      return;
    }

    setLoading(true);

    // Stop countdown if running
    stopCountdown();

    const { error } = await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('id', question.id);

    if (!error) {
      updateQuestion(question.id, { status: 'closed' });
      setShowBreakdown(true);

      // Broadcast voting closed
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voting_closed',
        payload: { questionId: question.id },
      });

      // Auto-reveal results
      channelRef.current?.send({
        type: 'broadcast',
        event: 'results_revealed',
        payload: { questionId: question.id },
      });
    }

    setLoading(false);
  }

  const isPending = question.status === 'pending';
  const isRevealed = question.status === 'revealed';
  const showResults = isClosed || isRevealed;

  const timerOptions = [
    { label: '15s', value: 15 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: 'No timer', value: null },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Anonymous/Named badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            question.anonymous
              ? 'bg-gray-200 text-gray-700'
              : 'bg-amber-100 text-amber-700'
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

      {/* Pending state: Show Start button with timer selection */}
      {isPending && !hideControls && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleActivate}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Starting...' : 'Start'}
          </button>

          {/* Timer selection pills */}
          <div className="flex items-center gap-1.5">
            {timerOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setTimerDuration(opt.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  timerDuration === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active state: Show vote count, countdown timer, and close button */}
      {isActive && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${projectionMode ? 'text-base' : 'text-sm'} text-gray-700`}>
                {showBreakdown ? (
                  <div className="space-y-1">
                    {aggregated.length === 0 ? (
                      <p className="text-gray-400">No votes yet</p>
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
              <CountdownTimer
                remainingSeconds={Math.ceil(remaining / 1000)}
                isRunning={isRunning}
              />
            </div>
            <button
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              {showBreakdown ? 'Show count' : 'Show breakdown'}
            </button>
          </div>

          {!hideControls && (
            <button
              onClick={handleCloseVoting}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Closing...' : 'Close Voting'}
            </button>
          )}
        </div>
      )}

      {/* Closed/Revealed state: Show bar chart results */}
      {showResults && (
        <div className="space-y-2">
          {aggregated.length === 0 ? (
            <p className="text-gray-400 text-sm">No votes recorded</p>
          ) : (
            <BarChart data={barData} totalVotes={votes.length} size={projectionMode ? 'large' : 'default'} theme={theme} />
          )}

          {/* Named votes: show voter names for closed named questions */}
          {!question.anonymous && votes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-xs text-gray-500 font-medium mb-2">Voter details</p>
              <div className="space-y-1">
                {sortedVotes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs lg:text-sm gap-4">
                    <span className="text-gray-500">
                      {v.display_name || 'Anonymous'}
                    </span>
                    <span className="text-gray-700 font-medium">{v.value}</span>
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
