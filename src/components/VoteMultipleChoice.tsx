import { useEffect, useState, useCallback } from 'react';
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
}

export default function VoteMultipleChoice({
  question,
  sessionId,
  participantId,
  displayName,
}: VoteMultipleChoiceProps) {
  const haptic = useHaptic();
  const { currentVote, setCurrentVote, submitting, setSubmitting } = useSessionStore();
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Fetch existing vote on mount or when question changes
  useEffect(() => {
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
        setSubmitted(true);
      }
    }

    setCurrentVote(null);
    setPendingSelection(null);
    setSubmitted(false);
    fetchExistingVote();

    return () => {
      cancelled = true;
    };
  }, [question.id, participantId, setCurrentVote]);

  const submitVote = useCallback(async () => {
    if (!pendingSelection) return;
    setSubmitting(true);
    haptic.tap();
    try {
      const payload = {
        question_id: question.id,
        session_id: sessionId,
        participant_id: participantId,
        value: pendingSelection,
        locked_in: false,
        display_name: question.anonymous ? null : displayName,
      };

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
      }
    } catch (err) {
      console.error('Vote submission error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [pendingSelection, question.id, question.anonymous, sessionId, participantId, displayName, haptic, setCurrentVote, setSubmitting]);

  function handleSelect(value: string) {
    setPendingSelection(value);
    setSubmitted(false);
    haptic.tap();
  }

  const options = question.options ?? [];
  const isCompact = options.length > 4;

  return (
    <div className="flex flex-col h-full">
      {/* Question text */}
      <div className="px-4 py-6 text-center">
        <h2 className="text-2xl font-bold text-white">{question.text}</h2>
      </div>

      {/* Option cards */}
      <div className={`flex-1 flex flex-col gap-3 px-4 ${isCompact ? 'overflow-y-auto' : ''}`}>
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
                isCompact ? 'px-4 py-3 text-base' : 'px-5 py-5 text-lg flex-1'
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

      {/* Submit button */}
      <div className="px-4 py-4">
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
      </div>
    </div>
  );
}
