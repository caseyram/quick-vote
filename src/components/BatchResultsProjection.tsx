import { useEffect, useRef } from 'react';
import type { Question, Vote } from '../types/database';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';
import { getTextColor } from '../lib/color-contrast';
import { getAdaptiveChartColor } from '../lib/chart-colors';

interface BatchResultsProjectionProps {
  batchId: string;
  batchName: string;
  questions: Question[];
  sessionVotes: Record<string, Vote[]>;
  revealedQuestions: Set<string>;
  highlightedReason: { questionId: string; reasonId: string } | null;
  /** Question ID selected by admin (synced via broadcast) */
  selectedQuestionId?: string | null;
  backgroundColor?: string;
  /** How many reasons to show at once in the panel (1, 2, or 4) */
  reasonsPerPage?: 1 | 2 | 4;
  /** Team filter - if set, only show votes from this team */
  teamFilter?: string | null;
}

export function BatchResultsProjection({
  batchId,
  batchName,
  questions,
  sessionVotes,
  revealedQuestions,
  highlightedReason,
  selectedQuestionId,
  backgroundColor,
  reasonsPerPage = 1,
  teamFilter,
}: BatchResultsProjectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute text color mode based on background
  const bgColor = backgroundColor || '#1a1a2e';
  const textMode = getTextColor(bgColor);
  const headingColor = textMode === 'light' ? 'text-white' : 'text-gray-900';
  const subTextColor = textMode === 'light' ? 'text-gray-400' : 'text-gray-600';
  const cardBg = textMode === 'light' ? 'bg-white/10' : 'bg-black/10';
  const reasonTextColor = textMode === 'light' ? 'text-white/80' : 'text-gray-700';
  const reasonNameColor = textMode === 'light' ? 'text-white/50' : 'text-gray-500';

  // Get batch questions sorted by position
  const batchQuestions = questions
    .filter((q) => q.batch_id === batchId)
    .sort((a, b) => a.position - b.position);

  // Determine which question to display (in priority order):
  // 1. If a reason is highlighted, show that reason's question
  // 2. Prefer admin-selected question (synced via broadcast)
  // 3. Fall back to first revealed batch question
  let currentQuestionId: string | undefined;
  if (
    highlightedReason &&
    revealedQuestions.has(highlightedReason.questionId) &&
    batchQuestions.some((q) => q.id === highlightedReason.questionId)
  ) {
    currentQuestionId = highlightedReason.questionId;
  } else if (
    selectedQuestionId &&
    revealedQuestions.has(selectedQuestionId) &&
    batchQuestions.some((q) => q.id === selectedQuestionId)
  ) {
    currentQuestionId = selectedQuestionId;
  } else {
    // Pick the first revealed batch question (by position order)
    currentQuestionId = batchQuestions
      .find((q) => revealedQuestions.has(q.id))?.id;
  }

  const currentQuestion = currentQuestionId
    ? batchQuestions.find((q) => q.id === currentQuestionId)
    : null;

  // Auto-scroll reasons panel to keep highlighted item(s) centered
  // (must be before early return to satisfy Rules of Hooks)
  useEffect(() => {
    if (!highlightedReason?.reasonId || !scrollContainerRef.current) return;
    // Scroll the first active item to center so context is visible above and below
    const ids = Array.from(activePageReasonIds);
    const targetId = ids.length > 0 ? ids[0] : highlightedReason.reasonId;
    const el = scrollContainerRef.current.querySelector(
      `[data-reason-id="${targetId}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedReason?.reasonId]);

  // If no questions revealed, show batch name with "Results ready"
  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <h2 className={`text-5xl font-bold ${headingColor} leading-tight mb-4`}>
          {batchName}
        </h2>
        <p className={`text-2xl ${subTextColor}`}>Results ready</p>
      </div>
    );
  }

  // Get votes for current question
  const questionVotes = sessionVotes[currentQuestion.id] || [];
  const aggregated = aggregateVotes(questionVotes, teamFilter);
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

  // Adapt chart colors for contrast with background
  const adaptedChartData = chartData.map((item) => ({
    ...item,
    color: getAdaptiveChartColor(item.color, bgColor),
  }));

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

  // Collect reasons grouped by option, in question option order
  const reasonsByOption: Record<string, Vote[]> = {};
  const optionOrder = currentQuestion.type === 'agree_disagree'
    ? ['Agree', 'Sometimes', 'Disagree']
    : (currentQuestion.options ?? []);
  for (const opt of optionOrder) {
    reasonsByOption[opt] = [];
  }
  questionVotes.forEach((vote) => {
    if (vote.reason && vote.reason.trim()) {
      if (!reasonsByOption[vote.value]) {
        reasonsByOption[vote.value] = [];
      }
      reasonsByOption[vote.value].push(vote);
    }
  });
  // Remove empty groups
  for (const key of Object.keys(reasonsByOption)) {
    if (reasonsByOption[key].length === 0) delete reasonsByOption[key];
  }

  const hasReasons = Object.keys(reasonsByOption).length > 0;

  // Build group-aware pages: each page stays within one option group
  const reasonPages: Vote[][] = [];
  for (const votes of Object.values(reasonsByOption)) {
    for (let i = 0; i < votes.length; i += reasonsPerPage) {
      reasonPages.push(votes.slice(i, i + reasonsPerPage));
    }
  }

  // Find current page based on highlighted reason
  const currentPageData = highlightedReason
    ? reasonPages.find((p) => p.some((v) => v.id === highlightedReason.reasonId))
    : null;
  const pageReasons = currentPageData ?? [];
  const currentPageIdx = currentPageData ? reasonPages.indexOf(currentPageData) : -1;
  const activePageReasonIds = new Set(
    currentPageData
      ? currentPageData.map((v) => v.id)
      : highlightedReason ? [highlightedReason.reasonId] : [],
  );

  return (
    <div className="flex flex-col h-full p-8">
      {/* Question text */}
      <div className="text-center shrink-0 mb-4">
        <h2 className={`text-3xl font-bold ${headingColor}`}>
          {currentQuestion.text}
        </h2>
        {teamFilter && (
          <p className={`text-sm ${subTextColor} mt-1`}>
            Showing: {teamFilter}
          </p>
        )}
      </div>

      {/* Chart + Reasons list layout */}
      <div className="flex-1 flex gap-8 min-h-0">
        {/* Chart section with highlighted reason(s) above the bars */}
        <div className={`flex-1 flex items-center justify-center min-h-0`}>
          <div className="w-full max-w-5xl">
            {/* Reason cards above chart — shows 1, 2, or 4 at a time */}
            {reasonsPerPage === 1 && highlightedReasonData && (
              <div className="flex justify-center mb-6">
                <div
                  className={`${cardBg} backdrop-blur rounded-lg p-6 max-w-4xl w-full text-center`}
                  style={{
                    borderLeft: `5px solid ${getReasonColor(highlightedReasonData.value)}`,
                  }}
                >
                  <p className={`${headingColor} text-3xl leading-relaxed`}>
                    &ldquo;{highlightedReasonData.reason || 'No reason provided'}&rdquo;
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    {highlightedReasonData.display_name && (
                      <span className={`text-lg ${subTextColor}`}>— {highlightedReasonData.display_name}</span>
                    )}
                    <span
                      className="text-base font-medium px-2.5 py-1 rounded"
                      style={{
                        backgroundColor: getReasonColor(highlightedReasonData.value) + '30',
                        color: textMode === 'light' ? '#fff' : getReasonColor(highlightedReasonData.value),
                      }}
                    >
                      {highlightedReasonData.value}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {reasonsPerPage > 1 && pageReasons.length > 0 && (
              <div className={`mb-6 ${reasonsPerPage === 4 ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-4'}`}>
                {pageReasons.map((vote) => (
                  <div
                    key={vote.id}
                    className={`${cardBg} backdrop-blur rounded-lg ${reasonsPerPage === 4 ? 'p-4' : 'p-5'} text-center`}
                    style={{
                      borderLeft: `5px solid ${getReasonColor(vote.value)}`,
                    }}
                  >
                    <p className={`${headingColor} ${reasonsPerPage === 4 ? 'text-xl' : 'text-2xl'} leading-relaxed`}>
                      &ldquo;{vote.reason}&rdquo;
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {vote.display_name && (
                        <span className={`${reasonsPerPage === 4 ? 'text-sm' : 'text-base'} ${subTextColor}`}>— {vote.display_name}</span>
                      )}
                      <span
                        className={`${reasonsPerPage === 4 ? 'text-sm' : 'text-base'} font-medium px-2 py-0.5 rounded`}
                        style={{
                          backgroundColor: getReasonColor(vote.value) + '20',
                          color: textMode === 'light' ? '#fff' : getReasonColor(vote.value),
                        }}
                      >
                        {vote.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <BarChart
              data={adaptedChartData}
              totalVotes={questionVotes.length}
              size="large"
              backgroundColor={bgColor}
            />
          </div>
        </div>

        {/* Reasons panel (right side, scrollable) */}
        {hasReasons && (
          <div className={`w-80 shrink-0 flex flex-col min-h-0 ${cardBg} backdrop-blur rounded-lg overflow-hidden`}>
            <div className="px-4 py-3 shrink-0 border-b border-white/10">
              <h4 className={`text-sm font-semibold ${headingColor}`}>Reasons</h4>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.entries(reasonsByOption).map(([option, votes]) => (
                <div key={option}>
                  <div
                    className="text-xs font-semibold mb-2 px-2 py-1 rounded inline-block"
                    style={{
                      backgroundColor: getReasonColor(option) + '20',
                      borderLeft: `3px solid ${getReasonColor(option)}`,
                      color: textMode === 'light' ? '#fff' : getReasonColor(option),
                    }}
                  >
                    {option}
                  </div>
                  <div className="space-y-2">
                    {votes.map((vote) => {
                      const isActive = activePageReasonIds.has(vote.id);
                      return (
                        <div
                          key={vote.id}
                          data-reason-id={vote.id}
                          className={`p-3 rounded-lg transition-all ${
                            isActive
                              ? `ring-2 ring-white/40 ${cardBg}`
                              : ''
                          }`}
                          style={{
                            borderLeft: `4px solid ${getReasonColor(vote.value)}`,
                          }}
                        >
                          <p className={`text-sm ${isActive ? headingColor : reasonTextColor}`}>
                            {vote.reason}
                          </p>
                          {vote.display_name && (
                            <p className={`text-xs ${reasonNameColor} mt-1`}>— {vote.display_name}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
