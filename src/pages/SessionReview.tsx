import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { aggregateVotes, buildConsistentBarData, type VoteCount } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { exportSession, downloadJSON, generateExportFilename } from '../lib/session-export';
import { useReadReasons } from '../hooks/use-read-reasons';
import { useKeyboardNavigation } from '../hooks/use-keyboard-navigation';
import type { Session, Batch, Question, Vote } from '../types/database';

interface QuestionWithVotes extends Question {
  votes: Vote[];
  aggregated: VoteCount[];
}

function buildBarData(question: Question, aggregated: VoteCount[]) {
  // Use consistent ordering for stable column positions
  const ordered = buildConsistentBarData(question, aggregated);
  return ordered.map((vc, index) => {
    let color: string;
    if (question.type === 'agree_disagree') {
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

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [questionsByBatch, setQuestionsByBatch] = useState<Map<string | null, QuestionWithVotes[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Refs for scrolling to questions
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!sessionId) return;

      setLoading(true);

      // Fetch session by session_id
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!sessionData) {
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(sessionData);

      // Fetch batches ordered by position
      const { data: batchData } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      setBatches(batchData ?? []);

      // Fetch questions ordered by position
      const { data: questionData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      // Fetch all votes for session
      const { data: voteData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId);

      const questions = questionData ?? [];
      const votes = voteData ?? [];

      // Group questions by batch_id
      const grouped = new Map<string | null, QuestionWithVotes[]>();
      for (const q of questions) {
        const qVotes = votes.filter(v => v.question_id === q.id);
        const entry: QuestionWithVotes = {
          ...q,
          votes: qVotes,
          aggregated: aggregateVotes(qVotes),
        };
        const key = q.batch_id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(entry);
      }

      setQuestionsByBatch(grouped);
      setLoading(false);
    }

    fetchData();
  }, [sessionId]);

  async function handleExport() {
    if (!sessionId || !session) return;
    setExporting(true);
    try {
      const data = await exportSession(sessionId);
      const filename = generateExportFilename(session.title);
      downloadJSON(data, filename);
    } finally {
      setExporting(false);
    }
  }

  // Flatten questions for navigation (batched first, then unbatched)
  const allQuestions = useMemo(() => {
    const result: QuestionWithVotes[] = [];
    // Add batched questions in batch order
    for (const batch of batches) {
      const batchQuestions = questionsByBatch.get(batch.id) ?? [];
      result.push(...batchQuestions);
    }
    // Add unbatched at end
    const unbatched = questionsByBatch.get(null) ?? [];
    result.push(...unbatched);
    return result;
  }, [batches, questionsByBatch]);

  // Navigation and read state hooks
  const { currentIndex, goToNext, goToPrev, canGoNext, canGoPrev } = useKeyboardNavigation(allQuestions.length);
  const { markAsRead, isUnread } = useReadReasons(sessionId ?? '');

  // Scroll to current question when index changes
  useEffect(() => {
    if (allQuestions.length > 0 && questionRefs.current[currentIndex]) {
      questionRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentIndex, allQuestions.length]);

  // Calculate total questions
  const totalQuestions = useMemo(() => {
    let count = 0;
    questionsByBatch.forEach(questions => {
      count += questions.length;
    });
    return count;
  }, [questionsByBatch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-lg">Session not found</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
            </div>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500">No questions in this session.</p>
          </div>
        </div>
      </div>
    );
  }

  // Track global index for question cards
  let globalQuestionIndex = 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating navigation arrows */}
      {allQuestions.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            disabled={!canGoPrev}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous question"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next question"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>

        {/* Question position indicator */}
        {allQuestions.length > 0 && (
          <div className="text-center text-sm text-gray-500 mb-4">
            Question {currentIndex + 1} of {allQuestions.length} (use left/right arrows to navigate)
          </div>
        )}

        {/* Scrollable content */}
        <div className="space-y-6 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
          {/* Render batched questions in order */}
          {batches.map(batch => {
            const questions = questionsByBatch.get(batch.id) ?? [];
            if (questions.length === 0) return null;

            return (
              <div key={batch.id}>
                {/* Batch header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-lg font-semibold text-gray-800">{batch.name}</h2>
                  <span className="text-sm text-gray-500">
                    {questions.length} question{questions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Questions in batch */}
                <div className="space-y-4">
                  {questions.map((q) => {
                    const thisIndex = globalQuestionIndex;
                    globalQuestionIndex++;
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        index={thisIndex + 1}
                        markAsRead={markAsRead}
                        isUnread={isUnread}
                        cardRef={(el) => { questionRefs.current[thisIndex] = el; }}
                        isActive={currentIndex === thisIndex}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Unbatched questions at the end */}
          {questionsByBatch.has(null) && (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-lg font-semibold text-gray-800">Unbatched</h2>
                <span className="text-sm text-gray-500">
                  {questionsByBatch.get(null)!.length} question{questionsByBatch.get(null)!.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-4">
                {questionsByBatch.get(null)!.map((q) => {
                  const thisIndex = globalQuestionIndex;
                  globalQuestionIndex++;
                  return (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={thisIndex + 1}
                      markAsRead={markAsRead}
                      isUnread={isUnread}
                      cardRef={(el) => { questionRefs.current[thisIndex] = el; }}
                      isActive={currentIndex === thisIndex}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: QuestionWithVotes;
  index: number;
  markAsRead: (reasonId: string) => void;
  isUnread: (reasonId: string) => boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  isActive?: boolean;
}

function QuestionCard({ question, index, markAsRead, isUnread, cardRef, isActive }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const barData = buildBarData(question, question.aggregated);

  const reasonsByColumn = useMemo(() => {
    const sortedVotes = [...question.votes].sort((a, b) => a.id.localeCompare(b.id));
    return barData.map((bar) => ({
      label: bar.label,
      color: bar.color,
      reasons: sortedVotes
        .filter((v) => v.value === bar.label && v.reason && v.reason.trim())
        .map((v) => ({ id: v.id, text: v.reason! })),
    }));
  }, [barData, question.votes]);

  const totalReasons = reasonsByColumn.reduce((sum, col) => sum + col.reasons.length, 0);

  return (
    <div
      ref={cardRef}
      className={`bg-white border rounded-lg p-5 space-y-3 transition-all ${
        isActive ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'
      }`}
    >
      {/* Question header */}
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono mt-0.5 text-gray-500">
          {index}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                question.type === 'agree_disagree'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {question.type === 'agree_disagree' ? 'Agree/Disagree' : 'Multiple Choice'}
            </span>
          </div>
          <p className="font-medium text-gray-900">{question.text}</p>
        </div>
      </div>

      {/* Vote results as bar chart */}
      {question.aggregated.length === 0 ? (
        <p className="text-sm pl-7 text-gray-400">No votes recorded</p>
      ) : (
        <div className="pl-7">
          <BarChart
            data={barData}
            totalVotes={question.votes.length}
            theme="light"
          />
        </div>
      )}

      {/* Collapsible reasons section */}
      {totalReasons > 0 && (
        <div className="pl-7">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
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
                        onClick={() => markAsRead(reason.id)}
                        className={`rounded px-2 py-1 text-left cursor-pointer transition-colors ${
                          isUnread(reason.id)
                            ? 'bg-blue-50 hover:bg-blue-100'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        style={{ borderLeft: `2px solid ${col.color}` }}
                      >
                        <span className="text-sm lg:text-base text-gray-700">
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
      )}
    </div>
  );
}
