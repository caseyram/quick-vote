import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { aggregateVotes, type VoteCount } from '../lib/vote-aggregation';
import type { Question, Vote } from '../types/database';

interface SessionResultsProps {
  sessionId: string;
}

interface QuestionResult {
  question: Question;
  votes: Vote[];
  aggregated: VoteCount[];
}

export default function SessionResults({ sessionId }: SessionResultsProps) {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);

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
        <p className="text-gray-400">Loading results...</p>
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
      <h2 className="text-2xl font-bold text-white">Session Results</h2>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {results.map((result, index) => (
          <div
            key={result.question.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3"
          >
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className="text-gray-400 text-sm font-mono mt-0.5">
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.question.type === 'agree_disagree'
                        ? 'bg-indigo-900 text-indigo-300'
                        : 'bg-emerald-900 text-emerald-300'
                    }`}
                  >
                    {result.question.type === 'agree_disagree'
                      ? 'Agree/Disagree'
                      : 'Multiple Choice'}
                  </span>
                </div>
                <p className="text-white font-medium">{result.question.text}</p>
              </div>
            </div>

            {/* Vote results */}
            {result.aggregated.length === 0 ? (
              <p className="text-gray-500 text-sm pl-7">No votes recorded</p>
            ) : (
              <div className="space-y-2 pl-7">
                {result.aggregated.map((vc) => (
                  <div key={vc.value} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{vc.value}</span>
                      <span className="text-gray-400">
                        {vc.count} ({vc.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-indigo-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${vc.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-1">
                  Total: {result.votes.length} vote
                  {result.votes.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
