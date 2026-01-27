import { useState, useEffect } from 'react';
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
      const key = vc.value.toLowerCase() as 'agree' | 'disagree';
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
          </div>
        ))}
      </div>
    </div>
  );
}
