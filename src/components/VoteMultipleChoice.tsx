import { useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useDoubleTap } from '../hooks/use-double-tap';
import { useHaptic } from '../hooks/use-haptic';
import { useSessionStore } from '../stores/session-store';
import { MULTI_CHOICE_COLORS } from './BarChart';
import VoteConfirmation from './VoteConfirmation';
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
      }
    }

    setCurrentVote(null);
    fetchExistingVote();

    return () => {
      cancelled = true;
    };
  }, [question.id, participantId, setCurrentVote]);

  const submitVote = useCallback(
    async (value: string, lockedIn: boolean) => {
      setSubmitting(true);
      try {
        const payload = {
          question_id: question.id,
          session_id: sessionId,
          participant_id: participantId,
          value,
          locked_in: lockedIn,
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
        }
      } catch (err) {
        console.error('Vote submission error:', err);
      } finally {
        setSubmitting(false);
      }
    },
    [question.id, question.anonymous, sessionId, participantId, displayName, setCurrentVote, setSubmitting],
  );

  const onSingleTap = useCallback(
    (value: string) => {
      haptic.tap();
      submitVote(value, false);
    },
    [haptic, submitVote],
  );

  const onDoubleTap = useCallback(
    (value: string) => {
      haptic.confirm();
      submitVote(value, true);
    },
    [haptic, submitVote],
  );

  const handleTap = useDoubleTap(onSingleTap, onDoubleTap);

  const isLockedIn = currentVote?.locked_in === true;
  const selectedValue = currentVote?.value ?? null;
  const options = question.options ?? [];
  const isCompact = options.length > 4;

  return (
    <div className="relative flex flex-col h-full">
      {/* Question text */}
      <div className="px-4 py-6 text-center">
        <h2 className="text-2xl font-bold text-white">{question.text}</h2>
      </div>

      {/* Option cards */}
      <div className={`flex-1 flex flex-col gap-3 px-4 pb-6 ${isCompact ? 'overflow-y-auto' : ''}`}>
        {options.map((option, index) => {
          const isSelected = selectedValue === option;
          const optionColor = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];

          return (
            <motion.button
              key={option}
              disabled={isLockedIn || submitting}
              onClick={() => handleTap(option)}
              animate={{
                backgroundColor: isSelected ? optionColor : UNSELECTED,
              }}
              whileTap={!isLockedIn && !submitting ? { scale: 0.97 } : undefined}
              transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
              className={`relative rounded-xl text-white font-semibold text-left disabled:opacity-60 disabled:cursor-not-allowed ${
                isCompact ? 'px-4 py-3 text-base' : 'px-5 py-5 text-lg flex-1'
              }`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span className="block">{option}</span>
              {isSelected && !isLockedIn && (
                <span className="block text-sm font-normal mt-1 text-white/70">
                  Tap again to lock in
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Lock-in confirmation overlay */}
      <VoteConfirmation visible={isLockedIn} value={selectedValue ?? ''} />
    </div>
  );
}
