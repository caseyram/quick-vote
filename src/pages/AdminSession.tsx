import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import QuestionForm from '../components/QuestionForm';
import QuestionList from '../components/QuestionList';
import { SessionQRCode } from '../components/QRCode';
import AdminQuestionControl from '../components/AdminQuestionControl';
import SessionResults from '../components/SessionResults';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ParticipantCount } from '../components/ParticipantCount';
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
  const [showQR, setShowQR] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [userId, setUserId] = useState('');
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});

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

      // Default showQR to true when session is in lobby or active
      if (sessionData.status === 'lobby' || sessionData.status === 'active') {
        setShowQR(true);
      }

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
          // A new question was added -- update store
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
            // Check for duplicate (idempotent)
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

  // Realtime channel -- only subscribe when session is live (lobby or active)
  // Presence is configured here so listeners are registered BEFORE subscribe
  const presenceConfig = userId ? { userId, role: 'admin' as const } : undefined;
  const { channelRef, connectionStatus, participantCount } = useRealtimeChannel(
    session?.session_id ? `session:${session.session_id}` : '',
    setupChannel,
    !!isLive && !!session?.session_id,
    presenceConfig
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">Session not found</p>
          <a href="/" className="text-indigo-600 hover:text-indigo-700 underline">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const participantUrl = `${window.location.origin}/session/${session.session_id}`;

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
      setShowQR(true);
      // Broadcast session lobby state
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
      // Broadcast session active state
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

    // Close any active questions
    await supabase
      .from('questions')
      .update({ status: 'closed' as const })
      .eq('session_id', session.session_id)
      .eq('status', 'active');

    // Update closed questions in store
    for (const q of questions) {
      if (q.status === 'active') {
        updateQuestion(q.id, { status: 'closed' });
      }
    }

    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'ended' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'ended' });
      setShowQR(false);
      // Broadcast session ended state
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

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    lobby: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    ended: 'bg-red-100 text-red-800',
  };

  return (
    <>
      <ConnectionBanner status={connectionStatus} />
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className={`mx-auto space-y-6 ${isLive ? 'max-w-4xl' : 'max-w-2xl'}`}>
          {/* Session header */}
          <div className="flex items-center justify-between">
            <h1 className={`font-bold text-gray-900 ${isLive ? 'text-4xl' : 'text-3xl'}`}>
              {session.title}
            </h1>
            <div className="flex items-center gap-3">
              {isLive && (
                <ParticipantCount count={participantCount} />
              )}
              {isLive && (
                <button
                  onClick={() => setShowQR((prev) => !prev)}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {showQR ? 'Hide QR' : 'Show QR'}
                </button>
              )}
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  statusColors[session.status] ?? 'bg-gray-200 text-gray-700'
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>

          {/* Session state controls */}
          <div className="bg-white rounded-lg p-4">
            {isDraft && (
              <div className="flex items-center justify-between">
                <p className="text-gray-700">
                  Session is in draft. Add questions, then start when ready.
                </p>
                <button
                  onClick={handleStartSession}
                  disabled={transitioning}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  {transitioning ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            )}

            {isLobby && (
              <div className="flex items-center justify-between">
                <p className="text-gray-700">
                  Participants can join now. Begin voting when ready.
                </p>
                <button
                  onClick={handleBeginVoting}
                  disabled={transitioning}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  {transitioning ? 'Starting...' : 'Begin Voting'}
                </button>
              </div>
            )}

            {isActive && (
              <div className="flex items-center justify-between">
                <p className="text-gray-700">
                  Voting is live. Activate questions below.
                </p>
                <button
                  onClick={handleEndSession}
                  disabled={transitioning}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  {transitioning ? 'Ending...' : 'End Session'}
                </button>
              </div>
            )}

            {isEnded && (
              <div className="text-center py-2">
                <p className="text-gray-500 text-lg font-medium">Session Ended</p>
              </div>
            )}
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

          {/* Ended: show session results */}
          {isEnded && (
            <div className="bg-white rounded-lg p-6">
              <SessionResults sessionId={session.session_id} />
            </div>
          )}

          {/* Draft: Question management with anonymous toggle + edit/delete/reorder */}
          {isDraft && (
            <>
              {/* Anonymous/Named voting privacy toggles */}
              {questions.length > 0 && (
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-500 font-medium mb-3">Voting Privacy</p>
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
                        <button
                          onClick={() => handleToggleAnonymous(q)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
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
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                          {q.anonymous ? 'Anonymous' : 'Named'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question list with edit/delete/reorder */}
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions</h2>
                <QuestionList
                  onEditQuestion={setEditingQuestion}
                />
              </div>

              {/* Question form - only in draft state */}
              <div className="bg-white rounded-lg p-6">
                <QuestionForm
                  sessionId={session.session_id}
                  editingQuestion={editingQuestion ?? undefined}
                  onSaved={handleSaved}
                  onCancel={editingQuestion ? handleCancelEdit : undefined}
                />
              </div>
            </>
          )}

          {/* Lobby/Active: Question list with activation controls */}
          {isLive && (
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Questions</h2>
              {questions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No questions in this session.
                </p>
              ) : (
                <ul className="space-y-4">
                  {questions.map((q, index) => (
                    <li
                      key={q.id}
                      className={`border rounded-lg p-5 space-y-3 ${
                        q.status === 'active'
                          ? 'bg-gray-100 border-green-500'
                          : q.status === 'closed' || q.status === 'revealed'
                            ? 'bg-gray-100 border-gray-400'
                            : 'bg-gray-100 border-gray-300'
                      }`}
                    >
                      {/* Question header */}
                      <div className="flex items-start gap-3">
                        <span className="text-gray-500 text-sm font-mono mt-0.5">
                          {index + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                q.type === 'agree_disagree'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {q.type === 'agree_disagree'
                                ? 'Agree/Disagree'
                                : 'Multiple Choice'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                q.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : q.status === 'closed' || q.status === 'revealed'
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {q.status}
                            </span>
                          </div>
                          <p className={`font-medium ${q.status === 'active' ? 'text-gray-900 text-lg' : 'text-gray-900'}`}>
                            {q.text}
                          </p>
                          {q.type === 'multiple_choice' && q.options && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {q.options.map((opt, optIdx) => (
                                <span
                                  key={optIdx}
                                  className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs"
                                >
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AdminQuestionControl */}
                      <div className="pl-7">
                        <AdminQuestionControl
                          question={q}
                          sessionId={session.session_id}
                          isActive={q.status === 'active'}
                          isClosed={q.status === 'closed' || q.status === 'revealed'}
                          channelRef={channelRef}
                          votes={sessionVotes[q.id] ?? []}
                          projectionMode
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* QR Code overlay */}
        <SessionQRCode url={participantUrl} visible={showQR} />
      </div>
    </>
  );
}
