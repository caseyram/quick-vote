import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { useCountdown } from '../hooks/use-countdown';
import { aggregateVotes } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import QuestionForm from '../components/QuestionForm';
import QuestionList from '../components/QuestionList';
import { SessionQRCode } from '../components/QRCode';
import SessionResults from '../components/SessionResults';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ParticipantCount } from '../components/ParticipantCount';
import { CountdownTimer } from '../components/CountdownTimer';
import { AdminControlBar } from '../components/AdminControlBar';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { ImportExportPanel } from '../components/ImportExportPanel';
import { TemplatePanel } from '../components/TemplatePanel';
import type { Question, Vote } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function AdminSession() {
  const { adminToken } = useParams();
  const {
    session,
    questions,
    setSession,
    setQuestions,
    setLoading,
    setError,
    updateQuestion,
    loading,
    error,
    reset,
  } = useSessionStore();
  const [copied, setCopied] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [userId, setUserId] = useState('');
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
  const [quickQuestion, setQuickQuestion] = useState('');
  const [quickQuestionLoading, setQuickQuestionLoading] = useState(false);
  const [lastClosedQuestionId, setLastClosedQuestionId] = useState<string | null>(null);

  // Track session ID in a ref for the channel setup callback
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;

    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

      // Get current user for presence tracking
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        setUserId(authData.user.id);
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('admin_token', adminToken)
        .single();

      if (cancelled) return;

      if (sessionError || !sessionData) {
        setError(sessionError?.message ?? 'Session not found');
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(sessionData);
      sessionIdRef.current = sessionData.session_id;

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionData.session_id)
        .order('position', { ascending: true });

      if (cancelled) return;

      if (questionsError) {
        setError(questionsError.message);
      } else {
        setQuestions(questionsData ?? []);
      }

      // Fetch existing votes for all questions in this session
      if (sessionData.status === 'active' || sessionData.status === 'ended') {
        const { data: votesData } = await supabase
          .from('votes')
          .select('*')
          .eq('session_id', sessionData.session_id);

        if (votesData) {
          const voteMap: Record<string, Vote[]> = {};
          for (const vote of votesData) {
            if (!voteMap[vote.question_id]) {
              voteMap[vote.question_id] = [];
            }
            voteMap[vote.question_id].push(vote);
          }
          setSessionVotes(voteMap);
        }
      }

      setLoading(false);
    }

    loadSession();

    return () => {
      cancelled = true;
      reset();
    };
  }, [adminToken, setSession, setQuestions, setLoading, setError, reset]);

  // Realtime channel setup callback
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Listen for question changes (INSERT/UPDATE) via Postgres Changes
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'questions',
        filter: `session_id=eq.${sid}`,
      },
      (payload: any) => {
        const newRecord = payload.new as Question;
        if (!newRecord) return;

        if (payload.eventType === 'INSERT') {
          const currentQuestions = useSessionStore.getState().questions;
          const exists = currentQuestions.some((q) => q.id === newRecord.id);
          if (!exists) {
            useSessionStore.getState().addQuestion(newRecord);
          }
        } else if (payload.eventType === 'UPDATE') {
          useSessionStore.getState().updateQuestion(newRecord.id, newRecord);
        }
      }
    );

    // Listen for vote changes (INSERT/UPDATE) via Postgres Changes
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'votes',
        filter: `session_id=eq.${sid}`,
      },
      (payload: any) => {
        const newVote = payload.new as Vote;
        if (!newVote) return;

        setSessionVotes((prev) => {
          const qId = newVote.question_id;
          const existing = prev[qId] ?? [];

          if (payload.eventType === 'INSERT') {
            const alreadyExists = existing.some((v) => v.id === newVote.id);
            if (alreadyExists) return prev;
            return { ...prev, [qId]: [...existing, newVote] };
          } else if (payload.eventType === 'UPDATE') {
            return {
              ...prev,
              [qId]: existing.map((v) => (v.id === newVote.id ? newVote : v)),
            };
          }
          return prev;
        });
      }
    );
  }, []);

  const isDraft = session?.status === 'draft';
  const isLobby = session?.status === 'lobby';
  const isActive = session?.status === 'active';
  const isEnded = session?.status === 'ended';
  const isLive = isLobby || isActive;

  // Realtime channel
  const presenceConfig = userId ? { userId, role: 'admin' as const } : undefined;
  const { channelRef, connectionStatus, participantCount } = useRealtimeChannel(
    session?.session_id ? `session:${session.session_id}` : '',
    setupChannel,
    !!isLive && !!session?.session_id,
    presenceConfig
  );

  // Poll votes every 3s while session is active (reliable fallback for Postgres Changes)
  useEffect(() => {
    if (!isActive || !session?.session_id) return;

    const interval = setInterval(async () => {
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', session.session_id);

      if (votesData) {
        const voteMap: Record<string, Vote[]> = {};
        for (const vote of votesData) {
          if (!voteMap[vote.question_id]) {
            voteMap[vote.question_id] = [];
          }
          voteMap[vote.question_id].push(vote);
        }
        setSessionVotes(voteMap);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, session?.session_id]);

  // Page-level countdown for active questions (used in control bar + hero display)
  const handleCountdownComplete = useCallback(async () => {
    const activeQ = questions.find((q) => q.status === 'active');
    if (activeQ) {
      await handleCloseVotingInternal(activeQ.id);
    }
  }, [questions]);

  const {
    remaining: countdownRemaining,
    isRunning: countdownRunning,
    start: startCountdown,
    stop: stopCountdown,
  } = useCountdown(handleCountdownComplete);

  // Derived state
  const activeQuestion = useMemo(
    () => questions.find((q) => q.status === 'active') ?? null,
    [questions]
  );
  const closedQuestions = useMemo(
    () => questions.filter((q) => q.status === 'closed' || q.status === 'revealed'),
    [questions]
  );

  // --- Handler extraction ---

  async function handleActivateQuestion(questionId: string, timerDuration: number | null) {
    if (!session) return;

    // Close any currently active questions
    await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('session_id', session.session_id)
      .eq('status', 'active');

    for (const q of questions) {
      if (q.status === 'active') {
        updateQuestion(q.id, { status: 'closed' });
      }
    }

    stopCountdown();

    // Activate target question
    const { error } = await supabase
      .from('questions')
      .update({ status: 'active' as const })
      .eq('id', questionId);

    if (!error) {
      updateQuestion(questionId, { status: 'active' });
      setLastClosedQuestionId(null);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'question_activated',
        payload: { questionId, timerSeconds: timerDuration },
      });

      if (timerDuration) {
        startCountdown(timerDuration * 1000);
      }
    }
  }

  async function handleCloseVotingInternal(questionId: string) {
    stopCountdown();

    const { error } = await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('id', questionId);

    if (!error) {
      updateQuestion(questionId, { status: 'closed' });
      setLastClosedQuestionId(questionId);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'voting_closed',
        payload: { questionId },
      });

      channelRef.current?.send({
        type: 'broadcast',
        event: 'results_revealed',
        payload: { questionId },
      });
    }
  }

  async function handleQuickQuestion(text: string, timerDuration: number | null) {
    if (!session || !text.trim()) return;
    setQuickQuestionLoading(true);

    // Close any active questions first
    await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('session_id', session.session_id)
      .eq('status', 'active');

    for (const q of questions) {
      if (q.status === 'active') {
        updateQuestion(q.id, { status: 'closed' });
      }
    }
    stopCountdown();

    // Find next position
    const nextPosition = questions.length > 0
      ? Math.max(...questions.map((q) => q.position)) + 1
      : 0;

    // Create and immediately activate the question
    const { data, error: insertError } = await supabase
      .from('questions')
      .insert({
        session_id: session.session_id,
        text: text.trim(),
        type: 'agree_disagree' as const,
        options: null,
        position: nextPosition,
        status: 'active' as const,
      })
      .select()
      .single();

    if (!insertError && data) {
      useSessionStore.getState().addQuestion(data);
      setLastClosedQuestionId(null);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'question_activated',
        payload: { questionId: data.id, timerSeconds: timerDuration },
      });

      if (timerDuration) {
        startCountdown(timerDuration * 1000);
      }

      setQuickQuestion('');
    }

    setQuickQuestionLoading(false);
  }

  const participantUrl = session
    ? `${window.location.origin}/session/${session.session_id}`
    : '';

  function handleCopyLink() {
    navigator.clipboard.writeText(participantUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSaved() {
    setEditingQuestion(null);
  }

  function handleCancelEdit() {
    setEditingQuestion(null);
  }

  async function handleStartSession() {
    if (!session) return;
    setTransitioning(true);
    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'lobby' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'lobby' });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'session_lobby',
        payload: {},
      });
    }
    setTransitioning(false);
  }

  async function handleBeginVoting() {
    if (!session) return;
    setTransitioning(true);
    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'active' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'active' });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'session_active',
        payload: {},
      });
    }
    setTransitioning(false);
  }

  async function handleEndSession() {
    if (!session) return;
    setTransitioning(true);

    await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('session_id', session.session_id)
      .eq('status', 'active');

    for (const q of questions) {
      if (q.status === 'active') {
        updateQuestion(q.id, { status: 'closed' });
      }
    }

    stopCountdown();

    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'ended' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'ended' });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'session_ended',
        payload: {},
      });
    }
    setTransitioning(false);
  }

  async function handleToggleAnonymous(question: Question) {
    const newAnonymous = !question.anonymous;
    const { error: err } = await supabase
      .from('questions')
      .update({ anonymous: newAnonymous })
      .eq('id', question.id);

    if (!err) {
      updateQuestion(question.id, { anonymous: newAnonymous });
    }
  }

  async function handleToggleSessionReasons() {
    if (!session) return;
    const newValue = !(session.reasons_enabled ?? false);
    const { error: err } = await supabase
      .from('sessions')
      .update({ reasons_enabled: newValue })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, reasons_enabled: newValue });
    }
  }

  // --- Loading / error states ---

  if (loading) {
    return (
      <AdminPasswordGate>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500 text-lg">Loading session...</p>
        </div>
      </AdminPasswordGate>
    );
  }

  if (error || !session) {
    return (
      <AdminPasswordGate>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-red-400 text-lg">Session not found</p>
            <a href="/" className="text-indigo-600 hover:text-indigo-700 underline">
              Back to Home
            </a>
          </div>
        </div>
      </AdminPasswordGate>
    );
  }

  // --- View Layouts ---

  return (
    <AdminPasswordGate>
      {!isEnded && <ConnectionBanner status={connectionStatus} />}

      {/* Draft View: preserved admin-focused layout */}
      {isDraft && (
        <div className="min-h-screen bg-gray-50 py-8 px-4 pb-20">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                draft
              </span>
            </div>

            {/* Participant link */}
            <div className="bg-white rounded-lg p-4 space-y-3">
              <p className="text-sm text-gray-500 font-medium">Share with participants</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={participantUrl}
                  className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Session settings */}
            <div className="bg-white rounded-lg p-4 space-y-3">
              <p className="text-sm text-gray-500 font-medium">Session Settings</p>
              <button
                onClick={handleToggleSessionReasons}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  session.reasons_enabled
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {session.reasons_enabled ? 'Reasons Enabled' : 'Reasons Disabled'}
              </button>
            </div>

            {/* Per-question settings */}
            {questions.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-500 font-medium mb-3">Question Settings</p>
                <div className="space-y-2">
                  {questions.map((q, index) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-gray-700 truncate mr-3">
                        <span className="text-gray-400 font-mono">{index + 1}.</span>{' '}
                        {q.text}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleAnonymous(q)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            q.anonymous
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                          title={
                            q.anonymous
                              ? 'Click to make named voting'
                              : 'Click to make anonymous voting'
                          }
                        >
                          {q.anonymous ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                          {q.anonymous ? 'Anonymous' : 'Named'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question list with edit/delete/reorder */}
            <div className="bg-white rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions</h2>
              <QuestionList onEditQuestion={setEditingQuestion} />
              <ImportExportPanel sessionId={session.session_id} />
            </div>

            {/* Templates */}
            <TemplatePanel sessionId={session.session_id} />

            {/* Question form */}
            <div className="bg-white rounded-lg p-6">
              <QuestionForm
                sessionId={session.session_id}
                editingQuestion={editingQuestion ?? undefined}
                onSaved={handleSaved}
                onCancel={editingQuestion ? handleCancelEdit : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Lobby View: large centered QR for projection */}
      {isLobby && (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 pb-20">
          <h1 className="text-5xl font-bold text-gray-900 mb-10 text-center">
            {session.title}
          </h1>

          <SessionQRCode url={participantUrl} visible size={280} mode="centered" />

          <div className="mt-8 text-center space-y-3">
            <p className="text-lg text-gray-500">Scan to join or visit:</p>
            <p className="text-xl font-mono text-indigo-600 break-all">
              {participantUrl}
            </p>
          </div>

          <div className="mt-8">
            <ParticipantCount count={participantCount} size="large" />
          </div>
        </div>
      )}

      {/* Active View: hero question + results for projection */}
      {isActive && (
        <div className="bg-white">
          {/* Top header bar */}
          <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between h-14 shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
            <ParticipantCount count={participantCount} size="default" />
          </div>

          {/* Hero fills viewport minus header (56px) and control bar (56px) */}
          <div className="max-w-6xl mx-auto px-6" style={{ height: 'calc(100dvh - 7rem)' }}>
            {/* Hero active question */}
            {activeQuestion ? (
              <ActiveQuestionHero
                question={activeQuestion}
                questionIndex={questions.findIndex((q) => q.id === activeQuestion.id)}
                totalQuestions={questions.length}
                votes={sessionVotes[activeQuestion.id] ?? []}
                countdownRemaining={countdownRemaining}
                countdownRunning={countdownRunning}
              />
            ) : (
              <div className="h-full flex flex-col">
                {/* Show last closed question results prominently */}
                {lastClosedQuestionId ? (() => {
                  const closedQ = questions.find((q) => q.id === lastClosedQuestionId);
                  if (!closedQ) return null;
                  const votes = sessionVotes[closedQ.id] ?? [];
                  const qIndex = questions.findIndex((q) => q.id === closedQ.id);
                  return (
                    <div className="flex-1 min-h-0">
                      <ActiveQuestionHero
                        question={closedQ}
                        questionIndex={qIndex}
                        totalQuestions={questions.length}
                        votes={votes}
                        countdownRemaining={0}
                        countdownRunning={false}
                      />
                    </div>
                  );
                })() : (
                  /* Quick question input when no results to show */
                  <div className="flex-1 flex items-center justify-center">
                    <div className="max-w-xl w-full space-y-4">
                      <p className="text-xl text-gray-400 text-center">
                        Type a question to go live
                      </p>
                      <textarea
                        value={quickQuestion}
                        onChange={(e) => setQuickQuestion(e.target.value)}
                        placeholder="Enter your question..."
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && quickQuestion.trim()) {
                            e.preventDefault();
                            handleQuickQuestion(quickQuestion, null);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleQuickQuestion(quickQuestion, null)}
                        disabled={!quickQuestion.trim() || quickQuestionLoading}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl transition-colors"
                      >
                        {quickQuestionLoading ? 'Going live...' : 'Go Live'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Previous results grid — scrolls below the fold */}
          {closedQuestions.length > 0 && (
            <div className="max-w-5xl mx-auto px-6 py-8 pb-20">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Previous Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {closedQuestions.map((q) => {
                  const votes = sessionVotes[q.id] ?? [];
                  const aggregated = aggregateVotes(votes);
                  const barData = aggregated.map((vc, index) => {
                    let color: string;
                    if (q.type === 'agree_disagree') {
                      const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
                      color =
                        AGREE_DISAGREE_COLORS[key] ??
                        MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
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

                  const qIndex = questions.findIndex((qn) => qn.id === q.id);

                  return (
                    <div
                      key={q.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2"
                    >
                      <p className="text-sm text-gray-500">Q{qIndex + 1}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {q.text}
                      </p>
                      {aggregated.length > 0 ? (
                        <BarChart
                          data={barData}
                          totalVotes={votes.length}
                          theme="light"
                        />
                      ) : (
                        <p className="text-xs text-gray-400">No votes</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ended View: full results summary */}
      {isEnded && (
        <div className="min-h-screen bg-white pb-20">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <SessionResults sessionId={session.session_id} theme="light" />
            <div className="text-center mt-8">
              <a
                href="/"
                className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
              >
                Start New Session
              </a>
            </div>
          </div>
        </div>
      )}

      {/* QR Code overlay — always visible */}
      <SessionQRCode url={participantUrl} visible />

      {/* Admin Control Bar — always visible */}
      <AdminControlBar
        status={session.status}
        participantCount={participantCount}
        questions={questions}
        activeQuestion={activeQuestion ?? null}
        countdownRemaining={countdownRemaining}
        countdownRunning={countdownRunning}
        transitioning={transitioning}
        onStartSession={handleStartSession}
        onBeginVoting={handleBeginVoting}
        onEndSession={handleEndSession}
        onCopyLink={handleCopyLink}
        copied={copied}
        onActivateQuestion={handleActivateQuestion}
        onCloseVoting={handleCloseVotingInternal}
        onQuickQuestion={handleQuickQuestion}
        quickQuestionLoading={quickQuestionLoading}
      />
    </AdminPasswordGate>
  );
}

// --- Hero component for active question display ---

function ActiveQuestionHero({
  question,
  questionIndex,
  totalQuestions,
  votes,
  countdownRemaining,
  countdownRunning,
}: {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  votes: Vote[];
  countdownRemaining: number;
  countdownRunning: boolean;
}) {
  const [reasonsExpanded, setReasonsExpanded] = useState(false);
  const aggregated = useMemo(() => aggregateVotes(votes), [votes]);
  const barData = useMemo(() => {
    return aggregated.map((vc, index) => {
      let color: string;
      if (question.type === 'agree_disagree') {
        const key = vc.value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
        color =
          AGREE_DISAGREE_COLORS[key] ??
          MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
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
  }, [aggregated, question.type]);

  const isClosed = question.status === 'closed' || question.status === 'revealed';

  // Group reasons by vote value, aligned with barData columns
  const reasonsByColumn = useMemo(() => {
    return barData.map((bar) => ({
      label: bar.label,
      color: bar.color,
      reasons: votes
        .filter((v) => v.value === bar.label && v.reason && v.reason.trim())
        .map((v) => v.reason!),
    }));
  }, [barData, votes]);

  const totalReasons = reasonsByColumn.reduce((sum, col) => sum + col.reasons.length, 0);

  return (
    <div className={`h-full flex flex-col text-center py-4 ${!isClosed ? 'justify-center' : ''}`}>
      <div className="shrink-0">
        <p className="text-2xl text-gray-500">
          Question {questionIndex + 1} of {totalQuestions}
        </p>

        <h2 className="text-5xl font-bold text-gray-900 max-w-4xl mx-auto mt-3 leading-tight">
          &ldquo;{question.text}&rdquo;
        </h2>

        <div className="flex items-center justify-center gap-4 mt-4">
          <span className="text-2xl text-gray-600">
            {votes.length} vote{votes.length !== 1 ? 's' : ''}
          </span>
          <CountdownTimer
            remainingSeconds={Math.ceil(countdownRemaining / 1000)}
            isRunning={countdownRunning}
            size="large"
            theme="light"
          />
        </div>
      </div>

      {/* Bar chart fills remaining space when voting is closed */}
      {isClosed && aggregated.length > 0 && (
        <div className={`mt-4 mx-auto w-full max-w-4xl ${reasonsExpanded ? 'h-48 shrink-0' : 'flex-1 min-h-0'}`}>
          <BarChart data={barData} totalVotes={votes.length} size="fill" theme="light" />
        </div>
      )}

      {/* Expandable reasons panel — grouped under bar columns */}
      {isClosed && totalReasons > 0 && (
        <div className="shrink-0 mt-3">
          <button
            onClick={() => setReasonsExpanded((prev) => !prev)}
            className="text-lg font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            {reasonsExpanded ? 'Hide' : 'Show'} Reasons ({totalReasons})
            <span className="ml-1">{reasonsExpanded ? '\u25B2' : '\u25BC'}</span>
          </button>
          {reasonsExpanded && (
            <div className="mt-3 max-h-[35vh] overflow-y-auto">
              <div className="flex gap-6 justify-center max-w-4xl mx-auto px-2">
                {reasonsByColumn.map((col) => (
                  <div
                    key={col.label}
                    className="flex-1 min-w-0 space-y-2"
                    style={{ maxWidth: 200 }}
                  >
                    <p
                      className="text-base font-semibold text-center"
                      style={{ color: col.color }}
                    >
                      {col.label} ({col.reasons.length})
                    </p>
                    {col.reasons.map((text, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 rounded-lg px-3 py-2 text-left"
                        style={{ borderLeft: `3px solid ${col.color}` }}
                      >
                        <span className="text-lg text-gray-800">{text}</span>
                      </div>
                    ))}
                    {col.reasons.length === 0 && (
                      <p className="text-sm text-gray-300 text-center italic">No reasons</p>
                    )}
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
