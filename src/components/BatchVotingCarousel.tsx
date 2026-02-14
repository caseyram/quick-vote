import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimate } from 'motion/react';
import { supabase } from '../lib/supabase';
import VoteAgreeDisagree from './VoteAgreeDisagree';
import VoteMultipleChoice from './VoteMultipleChoice';
import type { Question } from '../types/database';

interface BatchVotingCarouselProps {
  questions: Question[];
  sessionId: string;
  participantId: string;
  displayName: string | null;
  reasonsEnabled: boolean;
  onComplete: () => void;
  teamId?: string | null;
}

interface PendingVote {
  value: string;
  reason?: string;
}

// Slide transition variants matching ParticipantSession
const slideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
};

const slideTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

export function BatchVotingCarousel({
  questions,
  sessionId,
  participantId,
  displayName,
  reasonsEnabled,
  onComplete,
  teamId = null,
}: BatchVotingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [progressRef, animateProgress] = useAnimate();

  // Local state for pending votes - not persisted until Submit
  const [pendingVotes, setPendingVotes] = useState<Map<string, PendingVote>>(new Map());

  // Derive current question early so we can use it in memoized callbacks
  const currentQuestion = questions[currentIndex];

  // Handle selection change from vote components - stable callback that includes questionId
  const handleSelectionChange = useCallback((questionId: string, selection: string | null, reason?: string) => {
    setPendingVotes(prev => {
      const next = new Map(prev);
      if (selection) {
        next.set(questionId, { value: selection, reason });
      } else {
        next.delete(questionId);
      }
      return next;
    });

    // Subtle pulse on progress indicator as completion feedback
    if (selection && progressRef.current) {
      animateProgress(
        progressRef.current,
        { scale: [1, 1.1, 1] },
        { duration: 0.3, ease: 'easeOut' }
      );
    }
  }, [animateProgress, progressRef]);

  // Create a stable callback for the current question
  const currentQuestionSelectionChange = useMemo(() => {
    if (!currentQuestion) return undefined;
    return (selection: string | null, reason?: string) => {
      handleSelectionChange(currentQuestion.id, selection, reason);
    };
  }, [currentQuestion?.id, handleSelectionChange]);

  // Keyboard navigation (desktop only)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't navigate if user is typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [questions.length]);

  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;

  // Get current vote for the current question
  const currentVote = pendingVotes.get(currentQuestion?.id ?? '');

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Submit all votes at once
  const handleSubmitAll = async () => {
    if (pendingVotes.size === 0) {
      // No votes to submit - just complete
      onComplete();
      return;
    }

    setSubmitting(true);
    try {
      // Build array of votes to upsert
      const votes = Array.from(pendingVotes.entries()).map(([questionId, vote]) => {
        const question = questions.find(q => q.id === questionId);
        return {
          question_id: questionId,
          session_id: sessionId,
          participant_id: participantId,
          value: vote.value,
          reason: vote.reason?.trim() || null,
          locked_in: false,
          display_name: question?.anonymous ? null : displayName,
          team_id: teamId,
        };
      });

      // Upsert all votes in a single request
      const { error } = await supabase
        .from('votes')
        .upsert(votes, { onConflict: 'question_id,participant_id' });

      if (error) {
        console.error('Failed to submit batch votes:', error);
        // Still complete on error - votes may have partially succeeded
      }

      onComplete();
    } catch (err) {
      console.error('Batch submission error:', err);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentQuestion) {
    return null;
  }

  // Count answered questions for progress
  const answeredCount = pendingVotes.size;

  return (
    <div className="flex flex-col min-h-full bg-gray-950">
      {/* Progress indicator - text counter at top */}
      <div ref={progressRef} className="px-4 py-3 text-center shrink-0">
        <p className="text-gray-400 text-sm font-medium">
          Question {currentIndex + 1} of {questions.length}
          {answeredCount > 0 && (
            <span className="ml-2 text-green-400">
              ({answeredCount} answered)
            </span>
          )}
        </p>
      </div>

      {/* Question area with slide transitions */}
      <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:p-8">
        <div className="w-full lg:max-w-2xl lg:rounded-2xl lg:bg-gray-900/50 lg:overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentQuestion.id}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              {currentQuestion.type === 'agree_disagree' ? (
                <VoteAgreeDisagree
                  question={currentQuestion}
                  sessionId={sessionId}
                  participantId={participantId}
                  displayName={displayName}
                  reasonsEnabled={reasonsEnabled}
                  batchMode={true}
                  onSelectionChange={currentQuestionSelectionChange}
                  initialSelection={currentVote?.value ?? null}
                  initialReason={currentVote?.reason ?? ''}
                />
              ) : (
                <VoteMultipleChoice
                  question={currentQuestion}
                  sessionId={sessionId}
                  participantId={participantId}
                  displayName={displayName}
                  reasonsEnabled={reasonsEnabled}
                  batchMode={true}
                  onSelectionChange={currentQuestionSelectionChange}
                  initialSelection={currentVote?.value ?? null}
                  initialReason={currentVote?.reason ?? ''}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation footer - fixed at bottom */}
      <div className="px-4 py-4 flex gap-3 bg-gray-950 shrink-0">
        <button
          onClick={handlePrevious}
          disabled={isFirstQuestion}
          className="px-6 py-3 rounded-xl font-semibold bg-gray-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          aria-label={isFirstQuestion ? 'No previous question' : 'Go to previous question'}
        >
          Previous
        </button>

        {isLastQuestion ? (
          <button
            onClick={handleSubmitAll}
            disabled={submitting}
            className="flex-1 px-6 py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
