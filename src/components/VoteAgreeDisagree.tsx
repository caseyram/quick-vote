import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, useAnimate } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useHaptic } from '../hooks/use-haptic';
import { useSessionStore } from '../stores/session-store';
import { AGREE_DISAGREE_COLORS } from './BarChart';
import type { Question } from '../types/database';

const UNSELECTED = 'rgba(55, 65, 81, 0.5)';

interface VoteAgreeDisagreeProps {
  question: Question;
  sessionId: string;
  participantId: string;
  displayName: string | null;
  reasonsEnabled?: boolean;
  onVoteSubmit?: () => void;
  // Batch mode props - when true, defers submission to parent
  batchMode?: boolean;
  onSelectionChange?: (selection: string | null, reason?: string) => void;
  initialSelection?: string | null;
  initialReason?: string;
}

export default function VoteAgreeDisagree({
  question,
  sessionId,
  participantId,
  displayName,
  reasonsEnabled = false,
  onVoteSubmit,
  batchMode = false,
  onSelectionChange,
  initialSelection = null,
  initialReason = '',
}: VoteAgreeDisagreeProps) {
  const haptic = useHaptic();
  const { setCurrentVote, submitting, setSubmitting } = useSessionStore();
  const [agreeRef, animateAgree] = useAnimate();
  const [sometimesRef, animateSometimes] = useAnimate();
  const [disagreeRef, animateDisagree] = useAnimate();
  const prevSelected = useRef<string | null>(null);
  const prevQuestionId = useRef<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState('');

  // Fetch existing vote on mount or when question changes
  // In batch mode, initialize from props instead of fetching
  // Note: initialSelection/initialReason are captured at question change only to avoid cycles
  useEffect(() => {
    // Skip if question hasn't changed (prevents infinite loops from prop updates)
    if (prevQuestionId.current === question.id) {
      return;
    }
    prevQuestionId.current = question.id;

    let cancelled = false;

    async function fetchExistingVote() {
      const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('question_id', question.id)
        .eq('participant_id', participantId)
        .maybeSingle();

      if (!cancelled && data) {
        setCurrentVote(data);
        setPendingSelection(data.value);
        setReason(data.reason ?? '');
        setSubmitted(true);
      }
    }

    setCurrentVote(null);
    setSubmitted(false);

    if (batchMode) {
      // In batch mode, initialize from props (captured at question change)
      setPendingSelection(initialSelection);
      setReason(initialReason);
    } else {
      // Normal mode - fetch from database
      setPendingSelection(null);
      setReason('');
      fetchExistingVote();
    }

    return () => {
      cancelled = true;
    };
  }, [question.id, participantId, setCurrentVote, batchMode, initialSelection, initialReason]);

  const submitVote = useCallback(async () => {
    if (!pendingSelection) return;
    setSubmitting(true);
    haptic.tap();
    try {
      const payload: Record<string, unknown> = {
        question_id: question.id,
        session_id: sessionId,
        participant_id: participantId,
        value: pendingSelection,
        locked_in: false,
        display_name: question.anonymous ? null : displayName,
      };
      if (reasonsEnabled) {
        payload.reason = reason.trim() || null;
      }

      const { data, error } = await supabase
        .from('votes')
        .upsert(payload, { onConflict: 'question_id,participant_id' })
        .select()
        .single();

      if (error) {
        console.error('Vote submission failed:', error);
      } else if (data) {
        setCurrentVote(data);
        setSubmitted(true);
        onVoteSubmit?.();  // Call callback for completion feedback
      }
    } catch (err) {
      console.error('Vote submission error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [pendingSelection, reason, reasonsEnabled, question.id, question.anonymous, sessionId, participantId, displayName, haptic, setCurrentVote, setSubmitting, onVoteSubmit]);

  function handleSelect(value: string) {
    setPendingSelection(value);
    setSubmitted(false);
    haptic.tap();
  }

  // Trigger pulse animation when selection changes
  useEffect(() => {
    if (pendingSelection && pendingSelection !== prevSelected.current) {
      if (pendingSelection === 'agree' && agreeRef.current) {
        animateAgree(agreeRef.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
      } else if (pendingSelection === 'sometimes' && sometimesRef.current) {
        animateSometimes(sometimesRef.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
      } else if (pendingSelection === 'disagree' && disagreeRef.current) {
        animateDisagree(disagreeRef.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
      }
    }
    prevSelected.current = pendingSelection;
  }, [pendingSelection, agreeRef, sometimesRef, disagreeRef, animateAgree, animateSometimes, animateDisagree]);

  // In batch mode, notify parent of selection changes
  useEffect(() => {
    if (batchMode && onSelectionChange) {
      onSelectionChange(pendingSelection, reason);
    }
  }, [batchMode, pendingSelection, reason, onSelectionChange]);

  return (
    <div className="flex flex-col">
      {/* Question text */}
      <div className="px-4 py-6 text-center shrink-0">
        <h2 className="text-2xl font-bold text-white">{question.text}</h2>
      </div>

      {/* Voting buttons */}
      <div className="flex flex-col gap-3 px-4" style={{ minHeight: '280px' }}>
        {/* Agree button */}
        <motion.button
          ref={agreeRef}
          onClick={() => handleSelect('agree')}
          animate={{
            backgroundColor: pendingSelection === 'agree' ? AGREE_DISAGREE_COLORS.agree : UNSELECTED,
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
          className="flex-1 min-h-[100px] flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-12 h-12 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
          Agree
        </motion.button>

        {/* Sometimes in between button */}
        <motion.button
          ref={sometimesRef}
          onClick={() => handleSelect('sometimes')}
          animate={{
            backgroundColor: pendingSelection === 'sometimes' ? AGREE_DISAGREE_COLORS.sometimes : UNSELECTED,
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
          className="flex-1 min-h-[80px] flex flex-col items-center justify-center rounded-2xl text-white text-xl font-bold"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h8"
            />
          </svg>
          Sometimes in between
        </motion.button>

        {/* Disagree button */}
        <motion.button
          ref={disagreeRef}
          onClick={() => handleSelect('disagree')}
          animate={{
            backgroundColor: pendingSelection === 'disagree' ? AGREE_DISAGREE_COLORS.disagree : UNSELECTED,
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
          className="flex-1 min-h-[100px] flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-12 h-12 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 017.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
            />
          </svg>
          Disagree
        </motion.button>
      </div>

      {/* Reason + Submit (hidden in batch mode) — pinned to bottom */}
      <div className="px-4 py-4 pb-8 space-y-3 shrink-0">
        {reasonsEnabled && (
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setSubmitted(false); }}
            placeholder="Why? (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-base"
          />
        )}
        {!batchMode && (
          <button
            onClick={submitVote}
            disabled={!pendingSelection || submitting}
            className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
              submitted
                ? 'bg-green-600 text-white'
                : pendingSelection
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {submitting
              ? 'Submitting...'
              : submitted
                ? 'Vote Submitted!'
                : 'Submit Vote'}
          </button>
        )}
      </div>
    </div>
  );
}
