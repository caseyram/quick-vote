import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { aggregateVotes, type VoteCount } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from './BarChart';
import type { Question, Vote } from '../types/database';

interface SessionResultsProps {
  sessionId: string;
  theme?: 'dark' | 'light';
}

interface QuestionResult {
  question: Question;
  votes: Vote[];
  aggregated: VoteCount[];
}

function buildBarData(result: QuestionResult) {
  return result.aggregated.map((vc, index) => {
    let color: string;
    if (result.question.type === 'agree_disagree') {
      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }
    return {
      label: vc.value,
      count: vc.count,
      percentage: vc.percentage,
      color,
    };
  });
}

export default function SessionResults({ sessionId, theme = 'dark' }: SessionResultsProps) {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);

  const isLight = theme === 'light';

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);

      // Fetch all questions for this session
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      if (!questions || questions.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Fetch votes for each question
      const questionResults: QuestionResult[] = await Promise.all(
        questions.map(async (question: Question) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('*')
            .eq('question_id', question.id);

          const voteList = votes ?? [];
          return {
            question,
            votes: voteList,
            aggregated: aggregateVotes(voteList),
          };
        })
      );

      setResults(questionResults);
      setLoading(false);
    }

    fetchResults();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className={isLight ? 'text-gray-500' : 'text-gray-400'}>Loading results...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No questions found for this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
        Session Results
      </h2>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {results.map((result, index) => (
          <div
            key={result.question.id}
            className={`border rounded-lg p-5 space-y-3 ${
              isLight
                ? 'bg-white border-gray-200'
                : 'bg-gray-900 border-gray-800'
            }`}
          >
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className={`text-sm font-mono mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.question.type === 'agree_disagree'
                        ? isLight
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-indigo-900 text-indigo-300'
                        : isLight
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-900 text-emerald-300'
                    }`}
                  >
                    {result.question.type === 'agree_disagree'
                      ? 'Agree/Disagree'
                      : 'Multiple Choice'}
                  </span>
                </div>
                <p className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {result.question.text}
                </p>
              </div>
            </div>

            {/* Vote results as bar chart */}
            {result.aggregated.length === 0 ? (
              <p className={`text-sm pl-7 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                No votes recorded
              </p>
            ) : (
              <div className="pl-7">
                <BarChart
                  data={buildBarData(result)}
                  totalVotes={result.votes.length}
                  theme={theme}
                />
              </div>
            )}

            {/* Reasons grouped by vote value */}
            <ReasonsSection
              votes={result.votes}
              barData={buildBarData(result)}
              isLight={isLight}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReasonsSection({
  votes,
  barData,
  isLight,
}: {
  votes: Vote[];
  barData: { label: string; color: string }[];
  isLight: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const reasonsByColumn = useMemo(() => {
    // Sort votes by id for stable ordering
    const sortedVotes = [...votes].sort((a, b) => a.id.localeCompare(b.id));
    return barData.map((bar) => ({
      label: bar.label,
      color: bar.color,
      reasons: sortedVotes
        .filter((v) => v.value === bar.label && v.reason && v.reason.trim())
        .map((v) => ({ id: v.id, text: v.reason! })),
    }));
  }, [barData, votes]);

  const totalReasons = reasonsByColumn.reduce((sum, col) => sum + col.reasons.length, 0);

  if (totalReasons === 0) return null;

  return (
    <div className="pl-7">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={`text-sm font-medium transition-colors ${
          isLight
            ? 'text-indigo-600 hover:text-indigo-500'
            : 'text-indigo-400 hover:text-indigo-300'
        }`}
      >
        {expanded ? 'Hide' : 'Show'} Reasons ({totalReasons})
        <span className="ml-1">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="mt-2 max-h-60 overflow-y-auto">
          <div className="flex gap-4">
            {reasonsByColumn.map((col) => (
              <div key={col.label} className="flex-1 min-w-0 space-y-1.5">
                <p
                  className="text-xs lg:text-sm font-semibold text-center"
                  style={{ color: col.color }}
                >
                  {col.label} ({col.reasons.length})
                </p>
                {col.reasons.map((reason) => (
                  <div
                    key={reason.id}
                    className={`rounded px-2 py-1 text-left ${
                      isLight ? 'bg-gray-50' : 'bg-gray-800'
                    }`}
                    style={{ borderLeft: `2px solid ${col.color}` }}
                  >
                    <span className={`text-sm lg:text-base ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                      {reason.text}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
