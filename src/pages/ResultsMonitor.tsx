import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';
import type {
  Session,
  Question,
  Batch,
  Vote,
} from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface BatchGroup {
  batch: Batch;
  questions: Question[];
}

const REASON_COLORS: Record<string, string> = {
  Agree: '#22c55e',
  Sometimes: '#eab308',
  Disagree: '#ef4444',
};
function getReasonColor(value: string, index: number) {
  return REASON_COLORS[value] ?? ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'][index % 5];
}

function QuestionExpandedContent({
  question,
  votes,
  chartData,
  totalVotes,
}: {
  question: Question;
  votes: Vote[];
  chartData: { label: string; count: number; percentage: number; color: string }[];
  totalVotes: number;
}) {
  // Group reasons by option, preserving option order
  const optionOrder = question.type === 'agree_disagree'
    ? ['Agree', 'Sometimes', 'Disagree']
    : (question.options ?? []);
  const canonicalMap: Record<string, string> = { agree: 'Agree', sometimes: 'Sometimes', disagree: 'Disagree' };
  const reasonsByOption: Record<string, Vote[]> = {};
  for (const opt of optionOrder) reasonsByOption[opt] = [];
  for (const v of votes) {
    if (!v.reason?.trim()) continue;
    const key = question.type === 'agree_disagree'
      ? (canonicalMap[v.value.toLowerCase()] ?? v.value)
      : v.value;
    if (!reasonsByOption[key]) reasonsByOption[key] = [];
    reasonsByOption[key].push(v);
  }
  for (const key of Object.keys(reasonsByOption)) {
    if (reasonsByOption[key].length === 0) delete reasonsByOption[key];
  }
  const hasReasons = Object.keys(reasonsByOption).length > 0;

  return (
    <div className="px-4 pb-4">
      {totalVotes === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No votes yet</p>
      ) : (
        <div className={`flex gap-4 ${hasReasons ? 'items-start' : ''}`}>
          {/* Chart */}
          <div className={`${hasReasons ? 'flex-1 min-w-0' : 'w-full'} min-h-48`}>
            <BarChart data={chartData} totalVotes={totalVotes} size="default" theme="light" />
          </div>

          {/* Reasons side panel */}
          {hasReasons && (
            <div className="w-72 shrink-0 border border-gray-200 rounded-lg bg-gray-50 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 shrink-0">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comments</p>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-3">
                {Object.entries(reasonsByOption).map(([option, optVotes], i) => (
                  <div key={option}>
                    <div
                      className="text-xs font-semibold text-gray-600 mb-1.5 px-2 py-0.5 rounded inline-block"
                      style={{
                        backgroundColor: getReasonColor(option, i) + '20',
                        borderLeft: `3px solid ${getReasonColor(option, i)}`,
                      }}
                    >
                      {option}
                    </div>
                    <div className="space-y-1.5">
                      {optVotes.map((v) => (
                        <div key={v.id} className="bg-white rounded-md px-2.5 py-2 border border-gray-100">
                          <p className="text-xs text-gray-800 leading-relaxed">{v.reason}</p>
                          {!question.anonymous && v.display_name && (
                            <p className="text-xs text-gray-400 mt-1">— {v.display_name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsMonitor() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastVoteCountRef = useRef(0);

  // Load initial data
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (cancelled) return;

      if (sessionErr || !sessionData) {
        setError('Session not found');
        setLoading(false);
        return;
      }

      setSession(sessionData);

      const { data: batchesData } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (!cancelled && batchesData) setBatches(batchesData);

      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (!cancelled && questionsData) setQuestions(questionsData);

      // Fetch votes
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId);

      if (!cancelled && votesData) {
        lastVoteCountRef.current = votesData.length;
        const voteMap: Record<string, Vote[]> = {};
        for (const vote of votesData) {
          if (!voteMap[vote.question_id]) voteMap[vote.question_id] = [];
          voteMap[vote.question_id].push(vote);
        }
        setSessionVotes(voteMap);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Poll votes every 3s
  useEffect(() => {
    if (!sessionId || !session) return;

    const interval = setInterval(async () => {
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId);

      if (votesData && votesData.length !== lastVoteCountRef.current) {
        lastVoteCountRef.current = votesData.length;
        const voteMap: Record<string, Vote[]> = {};
        for (const vote of votesData) {
          if (!voteMap[vote.question_id]) voteMap[vote.question_id] = [];
          voteMap[vote.question_id].push(vote);
        }
        setSessionVotes(voteMap);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, session]);

  // Realtime channel for presence
  const setupChannel = useCallback((_channel: RealtimeChannel) => {
    // Read-only view — no additional listeners needed
  }, []);

  const presenceConfig = undefined;
  const { connectionStatus, participantCount } = useRealtimeChannel(
    sessionId ? `session:${sessionId}` : '',
    setupChannel,
    !!sessionId && !!session,
    presenceConfig,
  );

  // Group questions by batch
  const batchGroups: BatchGroup[] = batches.map((batch) => ({
    batch,
    questions: questions.filter((q) => q.batch_id === batch.id),
  }));

  const unbatchedQuestions = questions.filter((q) => !q.batch_id);

  function toggleQuestion(questionId: string) {
    setExpandedQuestion((prev) => (prev === questionId ? null : questionId));
  }

  function buildChartData(question: Question) {
    const votes = sessionVotes[question.id] ?? [];
    const aggregated = aggregateVotes(votes, null);
    const barData = buildConsistentBarData(question, aggregated);
    return {
      chartData: barData.map((item, index) => {
        let color: string;
        if (question.type === 'agree_disagree') {
          const colorMap: Record<string, string> = {
            Agree: AGREE_DISAGREE_COLORS.agree,
            Sometimes: AGREE_DISAGREE_COLORS.sometimes,
            Disagree: AGREE_DISAGREE_COLORS.disagree,
          };
          color = colorMap[item.value] ?? MULTI_CHOICE_COLORS[0];
        } else {
          color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
        }
        return { label: item.value, count: item.count, percentage: item.percentage, color };
      }),
      totalVotes: votes.length,
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading results...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error ?? 'Session not found'}</p>
          <a href="/" className="text-indigo-600 hover:text-indigo-700 underline">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    lobby: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    ended: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Results Monitor</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[session.status] ?? 'bg-gray-200 text-gray-700'}`}>
              {session.status}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'disconnected' ? 'bg-red-500' :
                'bg-gray-400 animate-pulse'
              }`} />
              {participantCount} connected
            </div>
          </div>
        </div>

        {/* Batch groups */}
        {batchGroups.map(({ batch, questions: batchQuestions }) => (
          <div key={batch.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">{batch.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  batch.status === 'active' ? 'bg-green-100 text-green-700' :
                  batch.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {batch.status}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {batchQuestions.map((question) => {
                const isExpanded = expandedQuestion === question.id;
                const voteCount = (sessionVotes[question.id] ?? []).length;
                return (
                  <div key={question.id}>
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-800 truncate">{question.text}</span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {isExpanded && (
                      <QuestionExpandedContent
                        question={question}
                        votes={sessionVotes[question.id] ?? []}
                        chartData={buildChartData(question).chartData}
                        totalVotes={buildChartData(question).totalVotes}
                      />
                    )}
                  </div>
                );
              })}
              {batchQuestions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No questions in this batch</p>
              )}
            </div>
          </div>
        ))}

        {/* Unbatched questions */}
        {unbatchedQuestions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">Other Questions</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {unbatchedQuestions.map((question) => {
                const isExpanded = expandedQuestion === question.id;
                const voteCount = (sessionVotes[question.id] ?? []).length;
                return (
                  <div key={question.id}>
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-800 truncate">{question.text}</span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {isExpanded && (
                      <QuestionExpandedContent
                        question={question}
                        votes={sessionVotes[question.id] ?? []}
                        chartData={buildChartData(question).chartData}
                        totalVotes={buildChartData(question).totalVotes}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {batchGroups.length === 0 && unbatchedQuestions.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-400">No questions in this session yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
