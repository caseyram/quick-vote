import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useHaptic } from '../hooks/use-haptic';
import { useSessionStore } from '../stores/session-store';
import { MULTI_CHOICE_COLORS } from './BarChart';
import type { Question } from '../types/database';

const UNSELECTED = 'rgba(55, 65, 81, 0.5)';

interface VoteMultipleChoiceProps {
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

export default function VoteMultipleChoice({
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
}: VoteMultipleChoiceProps) {
  const haptic = useHaptic();
  const { setCurrentVote, submitting, setSubmitting } = useSessionStore();
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

  // In batch mode, notify parent of selection changes
  useEffect(() => {
    if (batchMode && onSelectionChange) {
      onSelectionChange(pendingSelection, reason);
    }
  }, [batchMode, pendingSelection, reason, onSelectionChange]);

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

  const options = question.options ?? [];
  const isCompact = options.length > 4;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Question text */}
      <div className="px-4 py-6 text-center shrink-0">
        <h2 className="text-2xl font-bold text-white">{question.text}</h2>
      </div>

      {/* Option cards */}
      <div className="flex flex-col gap-3 px-4">
        {options.map((option, index) => {
          const isSelected = pendingSelection === option;
          const optionColor = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];

          return (
            <motion.button
              key={option}
              onClick={() => handleSelect(option)}
              animate={{
                backgroundColor: isSelected ? optionColor : UNSELECTED,
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
              className={`relative rounded-xl text-white font-semibold text-left ${
                isCompact ? 'px-4 py-3 text-base' : 'px-5 py-5 text-lg'
              }`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span className="block">{option}</span>
            </motion.button>
          );
        })}
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
