import { motion, AnimatePresence } from 'motion/react';
import type { Question, Vote } from '../types/database';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';

interface BatchResultsProjectionProps {
  batchId: string;
  batchName: string;
  questions: Question[];
  sessionVotes: Record<string, Vote[]>;
  revealedQuestions: Set<string>;
  highlightedReason: { questionId: string; reasonId: string } | null;
}

export function BatchResultsProjection({
  batchId,
  batchName,
  questions,
  sessionVotes,
  revealedQuestions,
  highlightedReason,
}: BatchResultsProjectionProps) {
  // Get batch questions sorted by position
  const batchQuestions = questions
    .filter((q) => q.batch_id === batchId)
    .sort((a, b) => a.position - b.position);

  // Find the most recently revealed question
  const revealedArray = Array.from(revealedQuestions);
  const currentQuestionId = revealedArray
    .reverse()
    .find((qId) => batchQuestions.some((q) => q.id === qId));

  const currentQuestion = currentQuestionId
    ? batchQuestions.find((q) => q.id === currentQuestionId)
    : null;

  // If no questions revealed, show batch name with "Results ready"
  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <h2 className="text-5xl font-bold text-white leading-tight mb-4">
          {batchName}
        </h2>
        <p className="text-2xl text-gray-400">Results ready</p>
      </div>
    );
  }

  // Get votes for current question
  const questionVotes = sessionVotes[currentQuestion.id] || [];
  const aggregated = aggregateVotes(questionVotes);
  const barData = buildConsistentBarData(currentQuestion, aggregated);

  // Map bar data to BarChart format with colors
  const chartData = barData.map((item, index) => {
    let color: string;
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        Agree: AGREE_DISAGREE_COLORS.agree,
        Sometimes: AGREE_DISAGREE_COLORS.sometimes,
        Disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      color = colorMap[item.value] || MULTI_CHOICE_COLORS[0];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }

    return {
      label: item.value,
      count: item.count,
      percentage: item.percentage,
      color,
    };
  });

  // Find highlighted reason if exists
  const highlightedReasonData =
    highlightedReason?.questionId === currentQuestion.id
      ? questionVotes.find((v) => v.id === highlightedReason.reasonId)
      : null;

  // Get reason color based on vote value
  const getReasonColor = (voteValue: string): string => {
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        Agree: AGREE_DISAGREE_COLORS.agree,
        Sometimes: AGREE_DISAGREE_COLORS.sometimes,
        Disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      return colorMap[voteValue] || MULTI_CHOICE_COLORS[0];
    } else {
      const optionIndex = currentQuestion.options?.indexOf(voteValue) ?? -1;
      return MULTI_CHOICE_COLORS[optionIndex % MULTI_CHOICE_COLORS.length];
    }
  };

  return (
    <div className="flex flex-col h-full p-8">
      {/* Question text */}
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        {currentQuestion.text}
      </h2>

      {/* Chart + Reason layout */}
      <div className="flex-1 flex items-center justify-center gap-8 min-h-0">
        {/* Chart section */}
        <div
          className={`flex items-center justify-center ${
            highlightedReasonData ? 'w-1/2' : 'w-full'
          }`}
        >
          <div className="w-full max-w-2xl">
            <BarChart
              data={chartData}
              totalVotes={questionVotes.length}
              size="large"
              theme="dark"
            />
          </div>
        </div>

        {/* Reason section (if highlighted) */}
        <AnimatePresence>
          {highlightedReasonData && (
            <motion.div
              className="w-1/2 flex items-center justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div
                className="bg-white/10 backdrop-blur rounded-lg p-6 max-w-lg"
                style={{
                  borderLeft: `4px solid ${getReasonColor(highlightedReasonData.value)}`,
                }}
              >
                <p className="text-white text-xl leading-relaxed mb-4">
                  {highlightedReasonData.reason || 'No reason provided'}
                </p>
                {highlightedReasonData.display_name && (
                  <p className="text-gray-300 text-sm">
                    — {highlightedReasonData.display_name}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
