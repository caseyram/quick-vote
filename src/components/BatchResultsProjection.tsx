import { useEffect, useRef } from 'react';
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
  selectedQuestionId?: string | null;
  moderatedVoteIds?: Set<string>;
  reasonsPerPage?: 1 | 2 | 4;
  teamFilter?: string | null;
  theme?: 'dark' | 'light';
}

export function BatchResultsProjection({
  batchId,
  batchName,
  questions,
  sessionVotes,
  revealedQuestions,
  highlightedReason,
  selectedQuestionId,
  moderatedVoteIds,
  reasonsPerPage = 1,
  teamFilter,
  theme = 'dark',
}: BatchResultsProjectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const batchQuestions = questions
    .filter((q) => q.batch_id === batchId)
    .sort((a, b) => a.position - b.position);

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
    currentQuestionId = batchQuestions.find((q) => revealedQuestions.has(q.id))?.id;
  }

  const currentQuestion = currentQuestionId
    ? batchQuestions.find((q) => q.id === currentQuestionId)
    : null;

  const activePageReasonIds = new Set<string>();
  const questionIndex = currentQuestion ? batchQuestions.findIndex((q) => q.id === currentQuestion.id) : -1;
  const questionNumber = questionIndex + 1;
  const questionTotal = batchQuestions.length;

  useEffect(() => {
    if (!highlightedReason?.reasonId || !scrollContainerRef.current) return;
    const ids = Array.from(activePageReasonIds);
    const targetId = ids.length > 0 ? ids[0] : highlightedReason.reasonId;
    const el = scrollContainerRef.current.querySelector(`[data-reason-id="${targetId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedReason?.reasonId]);

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <h2 className="text-5xl font-bold text-[var(--pres-text)] leading-tight">{batchName}</h2>
      </div>
    );
  }

  const questionVotes = sessionVotes[currentQuestion.id] || [];
  const aggregated = aggregateVotes(questionVotes, teamFilter);
  const barData = buildConsistentBarData(currentQuestion, aggregated);

  const chartData = barData.map((item, index) => {
    let color: string;
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        agree: AGREE_DISAGREE_COLORS.agree,
        sometimes: AGREE_DISAGREE_COLORS.sometimes,
        disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      color = colorMap[item.value.toLowerCase()] || MULTI_CHOICE_COLORS[0];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }

    return { label: item.value, count: item.count, percentage: item.percentage, color };
  });

  const highlightedReasonData =
    highlightedReason?.questionId === currentQuestion.id
      ? questionVotes.find(
          (v) => v.id === highlightedReason.reasonId && !moderatedVoteIds?.has(v.id)
        )
      : null;

  const getReasonColor = (voteValue: string): string => {
    if (currentQuestion.type === 'agree_disagree') {
      const colorMap: Record<string, string> = {
        agree: AGREE_DISAGREE_COLORS.agree,
        sometimes: AGREE_DISAGREE_COLORS.sometimes,
        disagree: AGREE_DISAGREE_COLORS.disagree,
      };
      return colorMap[voteValue.toLowerCase()] || MULTI_CHOICE_COLORS[0];
    }
    const optionIndex = currentQuestion.options?.indexOf(voteValue) ?? -1;
    return MULTI_CHOICE_COLORS[optionIndex % MULTI_CHOICE_COLORS.length];
  };

  const canonicalAgreeValues: Record<string, string> = {
    agree: 'Agree', sometimes: 'Sometimes', disagree: 'Disagree',
  };
  const reasonsByOption: Record<string, Vote[]> = {};
  const optionOrder = currentQuestion.type === 'agree_disagree'
    ? ['Agree', 'Sometimes', 'Disagree']
    : (currentQuestion.options ?? []);
  for (const opt of optionOrder) reasonsByOption[opt] = [];

  questionVotes.forEach((vote) => {
    // Skip moderated responses — no indication to audience that anything was removed
    if (moderatedVoteIds?.has(vote.id)) return;
    if (vote.reason && vote.reason.trim()) {
      const groupKey = currentQuestion.type === 'agree_disagree'
        ? (canonicalAgreeValues[vote.value.toLowerCase()] || vote.value)
        : vote.value;
      if (!reasonsByOption[groupKey]) reasonsByOption[groupKey] = [];
      reasonsByOption[groupKey].push(vote);
    }
  });

  for (const key of Object.keys(reasonsByOption)) {
    if (reasonsByOption[key].length === 0) delete reasonsByOption[key];
  }

  const hasReasons = Object.keys(reasonsByOption).length > 0;

  const reasonPages: Vote[][] = [];
  for (const votes of Object.values(reasonsByOption)) {
    for (let i = 0; i < votes.length; i += reasonsPerPage) {
      reasonPages.push(votes.slice(i, i + reasonsPerPage));
    }
  }

  const currentPageData = highlightedReason
    ? reasonPages.find((p) => p.some((v) => v.id === highlightedReason.reasonId))
    : null;
  const pageReasons = currentPageData ?? [];
  const activeIds = new Set(currentPageData ? currentPageData.map((v) => v.id) : highlightedReason ? [highlightedReason.reasonId] : []);

  return (
    <div className="flex h-full p-8 gap-8 min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="text-center shrink-0 mb-8 w-full">
          <h2 className="text-3xl font-bold text-[var(--pres-text)]">
            {questionTotal > 1 && (
              <span className="text-[var(--pres-text-secondary)] font-normal mr-2 text-2xl">
                ({questionNumber} of {questionTotal})
              </span>
            )}
            {currentQuestion.text}
          </h2>
          {teamFilter && <p className="text-sm text-[var(--pres-text-secondary)] mt-1">Showing: {teamFilter}</p>}
        </div>

        <div className="w-full max-w-5xl">
          {reasonsPerPage === 1 && highlightedReasonData && (
            <div className="flex justify-center mb-8">
              <div className="bg-[var(--pres-card-bg)] backdrop-blur rounded-lg p-6 max-w-4xl w-full text-center" style={{ borderLeft: `5px solid ${getReasonColor(highlightedReasonData.value)}` }}>
                <p className="text-[var(--pres-text)] text-3xl leading-relaxed">&ldquo;{highlightedReasonData.reason || 'No reason provided'}&rdquo;</p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  {highlightedReasonData.display_name && <span className="text-lg text-[var(--pres-text-secondary)]">— {highlightedReasonData.display_name}</span>}
                  <span className="text-base font-medium px-2.5 py-1 rounded" style={{ backgroundColor: `${getReasonColor(highlightedReasonData.value)}30`, color: 'var(--pres-text)' }}>
                    {highlightedReasonData.value}
                  </span>
                </div>
              </div>
            </div>
          )}

          {reasonsPerPage > 1 && pageReasons.length > 0 && (
            <div className={`mb-8 ${reasonsPerPage === 4 ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-4'}`}>
              {pageReasons.map((vote) => (
                <div key={vote.id} className={`bg-[var(--pres-card-bg)] backdrop-blur rounded-lg ${reasonsPerPage === 4 ? 'p-4' : 'p-5'} text-center`} style={{ borderLeft: `5px solid ${getReasonColor(vote.value)}` }}>
                  <p className={`text-[var(--pres-text)] ${reasonsPerPage === 4 ? 'text-xl' : 'text-2xl'} leading-relaxed`}>&ldquo;{vote.reason}&rdquo;</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {vote.display_name && <span className={`${reasonsPerPage === 4 ? 'text-sm' : 'text-base'} text-[var(--pres-text-secondary)]`}>— {vote.display_name}</span>}
                    <span className={`${reasonsPerPage === 4 ? 'text-sm' : 'text-base'} font-medium px-2 py-0.5 rounded`} style={{ backgroundColor: `${getReasonColor(vote.value)}20`, color: 'var(--pres-text)' }}>
                      {vote.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <BarChart data={chartData} totalVotes={questionVotes.length} size="large" theme={theme} />
        </div>
      </div>

      {hasReasons && (
        <div className="w-80 shrink-0 flex flex-col min-h-0 bg-[var(--pres-card-bg)] backdrop-blur rounded-lg overflow-hidden">
          <div className="px-4 py-3 shrink-0 border-b border-white/10">
            <h4 className="text-sm font-semibold text-[var(--pres-text)]">Reasons</h4>
          </div>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {Object.entries(reasonsByOption).map(([option, votes]) => (
              <div key={option}>
                <div className="text-xs font-semibold mb-2 px-2 py-1 rounded inline-block" style={{ backgroundColor: `${getReasonColor(option)}20`, borderLeft: `3px solid ${getReasonColor(option)}`, color: 'var(--pres-text)' }}>
                  {option}
                </div>
                <div className="space-y-2">
                  {votes.map((vote) => {
                    const isActive = activeIds.has(vote.id);
                    return (
                      <div key={vote.id} data-reason-id={vote.id} className={`p-3 rounded-lg transition-all ${isActive ? 'ring-2 ring-white/40 bg-[var(--pres-card-bg)]' : ''}`} style={{ borderLeft: `4px solid ${getReasonColor(vote.value)}` }}>
                        <p className={`text-sm ${isActive ? 'text-[var(--pres-text)]' : 'text-[var(--pres-text-secondary)]'}`}>{vote.reason}</p>
                        {vote.display_name && <p className="text-xs text-[var(--pres-text-secondary)] mt-1">— {vote.display_name}</p>}
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
  );
}
