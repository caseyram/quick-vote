import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import QuestionForm from '../components/QuestionForm';
import QuestionList from '../components/QuestionList';
import { SessionQRCode } from '../components/QRCode';
import AdminQuestionControl from '../components/AdminQuestionControl';
import SessionResults from '../components/SessionResults';
import type { Question } from '../types/database';

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

  useEffect(() => {
    if (!adminToken) return;

    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

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

      setLoading(false);
    }

    loadSession();

    return () => {
      cancelled = true;
      reset();
    };
  }, [adminToken, setSession, setQuestions, setLoading, setError, reset]);

  // Poll questions every 3 seconds when session is active
  const pollQuestions = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('session_id', session.session_id)
      .order('position');

    if (data) {
      setQuestions(data);
    }
  }, [session, setQuestions]);

  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const interval = setInterval(pollQuestions, 3000);
    return () => clearInterval(interval);
  }, [session, session?.status, pollQuestions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">Session not found</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 underline">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const participantUrl = `${window.location.origin}/session/${session.session_id}`;
  const isDraft = session.status === 'draft';
  const isLobby = session.status === 'lobby';
  const isActive = session.status === 'active';
  const isEnded = session.status === 'ended';
  const isLive = isLobby || isActive;

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
    setTransitioning(true);
    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'lobby' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'lobby' });
      setShowQR(true);
    }
    setTransitioning(false);
  }

  async function handleBeginVoting() {
    setTransitioning(true);
    const { error: err } = await supabase
      .from('sessions')
      .update({ status: 'active' as const })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, status: 'active' });
    }
    setTransitioning(false);
  }

  async function handleEndSession() {
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
    draft: 'bg-gray-700 text-gray-300',
    lobby: 'bg-yellow-700 text-yellow-200',
    active: 'bg-green-700 text-green-200',
    ended: 'bg-red-700 text-red-200',
  };

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className={`mx-auto space-y-6 ${isLive ? 'max-w-4xl' : 'max-w-2xl'}`}>
        {/* Session header */}
        <div className="flex items-center justify-between">
          <h1 className={`font-bold text-white ${isLive ? 'text-4xl' : 'text-3xl'}`}>
            {session.title}
          </h1>
          <div className="flex items-center gap-3">
            {isLive && (
              <button
                onClick={() => setShowQR((prev) => !prev)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showQR ? 'Hide QR' : 'Show QR'}
              </button>
            )}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[session.status] ?? 'bg-gray-700 text-gray-300'
              }`}
            >
              {session.status}
            </span>
          </div>
        </div>

        {/* Session state controls */}
        <div className="bg-gray-900 rounded-lg p-4">
          {isDraft && (
            <div className="flex items-center justify-between">
              <p className="text-gray-300">
                Session is in draft. Add questions, then start when ready.
              </p>
              <button
                onClick={handleStartSession}
                disabled={transitioning}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
              >
                {transitioning ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          )}

          {isLobby && (
            <div className="flex items-center justify-between">
              <p className="text-gray-300">
                Participants can join now. Begin voting when ready.
              </p>
              <button
                onClick={handleBeginVoting}
                disabled={transitioning}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
              >
                {transitioning ? 'Starting...' : 'Begin Voting'}
              </button>
            </div>
          )}

          {isActive && (
            <div className="flex items-center justify-between">
              <p className="text-gray-300">
                Voting is live. Activate questions below.
              </p>
              <button
                onClick={handleEndSession}
                disabled={transitioning}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
              >
                {transitioning ? 'Ending...' : 'End Session'}
              </button>
            </div>
          )}

          {isEnded && (
            <div className="text-center py-2">
              <p className="text-gray-400 text-lg font-medium">Session Ended</p>
            </div>
          )}
        </div>

        {/* Participant link */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-400 font-medium">Share with participants</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={participantUrl}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm"
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
          <div className="bg-gray-900 rounded-lg p-6">
            <SessionResults sessionId={session.session_id} />
          </div>
        )}

        {/* Draft: Question management with anonymous toggle + edit/delete/reorder */}
        {isDraft && (
          <>
            {/* Anonymous/Named voting privacy toggles */}
            {questions.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-400 font-medium mb-3">Voting Privacy</p>
                <div className="space-y-2">
                  {questions.map((q, index) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-gray-300 truncate mr-3">
                        <span className="text-gray-500 font-mono">{index + 1}.</span>{' '}
                        {q.text}
                      </span>
                      <button
                        onClick={() => handleToggleAnonymous(q)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                          q.anonymous
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-amber-900 text-amber-300 hover:bg-amber-800'
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
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Questions</h2>
              <QuestionList
                sessionId={session.session_id}
                onEditQuestion={setEditingQuestion}
              />
            </div>

            {/* Question form - only in draft state */}
            <div className="bg-gray-900 rounded-lg p-6">
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
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Questions</h2>
            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No questions in this session.
              </p>
            ) : (
              <ul className="space-y-4">
                {questions.map((q, index) => (
                  <li
                    key={q.id}
                    className={`border rounded-lg p-5 space-y-3 ${
                      q.status === 'active'
                        ? 'bg-gray-800 border-green-600'
                        : q.status === 'closed' || q.status === 'revealed'
                          ? 'bg-gray-800 border-gray-600'
                          : 'bg-gray-800 border-gray-700'
                    }`}
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
                              q.type === 'agree_disagree'
                                ? 'bg-indigo-900 text-indigo-300'
                                : 'bg-emerald-900 text-emerald-300'
                            }`}
                          >
                            {q.type === 'agree_disagree'
                              ? 'Agree/Disagree'
                              : 'Multiple Choice'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              q.status === 'active'
                                ? 'bg-green-900 text-green-300'
                                : q.status === 'closed' || q.status === 'revealed'
                                  ? 'bg-gray-600 text-gray-300'
                                  : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {q.status}
                          </span>
                        </div>
                        <p className={`font-medium ${q.status === 'active' ? 'text-white text-lg' : 'text-white'}`}>
                          {q.text}
                        </p>
                        {q.type === 'multiple_choice' && q.options && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {q.options.map((opt, optIdx) => (
                              <span
                                key={optIdx}
                                className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
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
  );
}
