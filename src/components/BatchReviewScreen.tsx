import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Question, Vote } from '../types/database';

interface BatchReviewScreenProps {
  questions: Question[];
  sessionId: string;
  participantId: string;
  onConfirm: () => void;
  onGoBack: () => void;
}

type VoteMap = Record<string, Vote>;

export function BatchReviewScreen({
  questions,
  sessionId,
  participantId,
  onConfirm,
  onGoBack,
}: BatchReviewScreenProps) {
  const [votes, setVotes] = useState<VoteMap>({});
  const [loading, setLoading] = useState(true);

  // Fetch all votes for participant in this batch
  useEffect(() => {
    let cancelled = false;

    async function fetchVotes() {
      const questionIds = questions.map((q) => q.id);

      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('participant_id', participantId)
        .in('question_id', questionIds);

      if (cancelled) return;

      if (error) {
        console.error('Failed to fetch votes for review:', error);
        setLoading(false);
        return;
      }

      // Build map of questionId -> vote
      const voteMap: VoteMap = {};
      for (const vote of data || []) {
        voteMap[vote.question_id] = vote;
      }

      setVotes(voteMap);
      setLoading(false);
    }

    fetchVotes();

    return () => {
      cancelled = true;
    };
  }, [questions, participantId]);

  const answeredCount = Object.keys(votes).length;
  const totalCount = questions.length;

  // Format answer display based on question type
  function formatAnswer(question: Question, vote: Vote | undefined): { text: string; color: string } {
    if (!vote) {
      return { text: 'Not answered', color: 'text-gray-500' };
    }

    if (question.type === 'agree_disagree') {
      switch (vote.value) {
        case 'agree':
          return { text: 'Agree', color: 'text-green-400' };
        case 'sometimes':
          return { text: 'Sometimes', color: 'text-yellow-400' };
        case 'disagree':
          return { text: 'Disagree', color: 'text-red-400' };
        default:
          return { text: vote.value, color: 'text-gray-300' };
      }
    }

    // Multiple choice - show the selected option text
    return { text: vote.value, color: 'text-indigo-400' };
  }

  // Truncate long question text
  function truncateText(text: string, maxLength: number = 80): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  if (loading) {
    return (
      <div className="h-dvh bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading review...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-dvh bg-gray-950 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white text-center">Review Your Answers</h1>
        <p className="text-sm text-gray-400 text-center mt-1">
          {answeredCount} of {totalCount} answered
        </p>
      </div>

      {/* Scrollable question list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {questions.map((question, index) => {
            const vote = votes[question.id];
            const answer = formatAnswer(question, vote);

            return (
              <div
                key={question.id}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800"
              >
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 text-sm font-medium min-w-[24px]">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed">
                      {truncateText(question.text)}
                    </p>
                    <p className={`text-sm font-medium mt-2 ${answer.color}`}>
                      {answer.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with buttons */}
      <div className="px-4 py-4 flex gap-3 border-t border-gray-800 bg-gray-950">
        <button
          onClick={onGoBack}
          className="px-6 py-3 rounded-xl font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-6 py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
        >
          Confirm & Complete
        </button>
      </div>
    </motion.div>
  );
}
