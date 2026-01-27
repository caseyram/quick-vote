import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDoubleTap } from '../hooks/use-double-tap';
import { useHaptic } from '../hooks/use-haptic';
import { useSessionStore } from '../stores/session-store';
import VoteConfirmation from './VoteConfirmation';
import type { Question } from '../types/database';

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
        {options.map((option) => {
          const isSelected = selectedValue === option;

          return (
            <button
              key={option}
              disabled={isLockedIn || submitting}
              onClick={() => handleTap(option)}
              className={`relative rounded-xl text-white font-semibold transition-all duration-150 text-left ${
                isCompact ? 'px-4 py-3 text-base' : 'px-5 py-5 text-lg flex-1'
              } ${
                isSelected
                  ? 'bg-indigo-600 ring-4 ring-indigo-400 scale-[1.01]'
                  : 'bg-gray-800 hover:bg-gray-700'
              } ${isLockedIn || submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span className="block">{option}</span>
              {isSelected && !isLockedIn && (
                <span className="block text-sm font-normal mt-1 text-indigo-200">
                  Tap again to lock in
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lock-in confirmation overlay */}
      <VoteConfirmation visible={isLockedIn} value={selectedValue ?? ''} />
    </div>
  );
}
