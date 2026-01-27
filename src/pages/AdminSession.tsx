import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import QuestionForm from '../components/QuestionForm';
import QuestionList from '../components/QuestionList';
import type { Question } from '../types/database';

export default function AdminSession() {
  const { adminToken } = useParams();
  const { session, setSession, setQuestions, setLoading, setError, loading, error, reset } = useSessionStore();
  const [copied, setCopied] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

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

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-700 text-gray-300',
    lobby: 'bg-yellow-700 text-yellow-200',
    active: 'bg-green-700 text-green-200',
    ended: 'bg-red-700 text-red-200',
  };

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Session header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">{session.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[session.status] ?? 'bg-gray-700 text-gray-300'}`}>
            {session.status}
          </span>
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

        {/* Question list */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Questions</h2>
          <QuestionList
            sessionId={session.session_id}
            onEditQuestion={setEditingQuestion}
          />
        </div>

        {/* Question form */}
        <div className="bg-gray-900 rounded-lg p-6">
          <QuestionForm
            sessionId={session.session_id}
            editingQuestion={editingQuestion ?? undefined}
            onSaved={handleSaved}
            onCancel={editingQuestion ? handleCancelEdit : undefined}
          />
        </div>
      </div>
    </div>
  );
}
