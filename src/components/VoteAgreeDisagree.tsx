import { useEffect, useCallback, useRef } from 'react';
import { motion, useAnimate } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useDoubleTap } from '../hooks/use-double-tap';
import { useHaptic } from '../hooks/use-haptic';
import { useSessionStore } from '../stores/session-store';
import { AGREE_DISAGREE_COLORS } from './BarChart';
import VoteConfirmation from './VoteConfirmation';
import type { Question } from '../types/database';

const UNSELECTED = 'rgba(55, 65, 81, 0.5)';

interface VoteAgreeDisagreeProps {
  question: Question;
  sessionId: string;
  participantId: string;
  displayName: string | null;
}

export default function VoteAgreeDisagree({
  question,
  sessionId,
  participantId,
  displayName,
}: VoteAgreeDisagreeProps) {
  const haptic = useHaptic();
  const { currentVote, setCurrentVote, submitting, setSubmitting } = useSessionStore();
  const [agreeRef, animateAgree] = useAnimate();
  const [disagreeRef, animateDisagree] = useAnimate();
  const prevSelected = useRef<string | null>(null);

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

  // Trigger pulse animation when selection changes
  useEffect(() => {
    if (selectedValue && selectedValue !== prevSelected.current) {
      if (selectedValue === 'agree' && agreeRef.current) {
        animateAgree(agreeRef.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
      } else if (selectedValue === 'disagree' && disagreeRef.current) {
        animateDisagree(disagreeRef.current, { scale: [1, 1.05, 1] }, { duration: 0.3, ease: 'easeOut' });
      }
    }
    prevSelected.current = selectedValue;
  }, [selectedValue, agreeRef, disagreeRef, animateAgree, animateDisagree]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Question text */}
      <div className="px-4 py-6 text-center">
        <h2 className="text-2xl font-bold text-white">{question.text}</h2>
      </div>

      {/* Voting buttons */}
      <div className="flex-1 flex flex-col gap-4 px-4 pb-6">
        {/* Agree button */}
        <motion.button
          ref={agreeRef}
          disabled={isLockedIn || submitting}
          onClick={() => handleTap('agree')}
          animate={{
            backgroundColor: selectedValue === 'agree' ? AGREE_DISAGREE_COLORS.agree : UNSELECTED,
          }}
          whileTap={!isLockedIn && !submitting ? { scale: 0.97 } : undefined}
          transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
          className="flex-1 flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
          Agree
          {selectedValue === 'agree' && !isLockedIn && (
            <span className="text-sm font-normal mt-1 text-white/70">Tap again to lock in</span>
          )}
        </motion.button>

        {/* Disagree button */}
        <motion.button
          ref={disagreeRef}
          disabled={isLockedIn || submitting}
          onClick={() => handleTap('disagree')}
          animate={{
            backgroundColor: selectedValue === 'disagree' ? AGREE_DISAGREE_COLORS.disagree : UNSELECTED,
          }}
          whileTap={!isLockedIn && !submitting ? { scale: 0.97 } : undefined}
          transition={{ backgroundColor: { duration: 0.15 }, scale: { duration: 0.1 } }}
          className="flex-1 flex flex-col items-center justify-center rounded-2xl text-white text-2xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 017.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
            />
          </svg>
          Disagree
          {selectedValue === 'disagree' && !isLockedIn && (
            <span className="text-sm font-normal mt-1 text-white/70">Tap again to lock in</span>
          )}
        </motion.button>
      </div>

      {/* Lock-in confirmation overlay */}
      <VoteConfirmation visible={isLockedIn} value={selectedValue ?? ''} />
    </div>
  );
}
