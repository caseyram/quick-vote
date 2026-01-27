import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import Lobby from '../components/Lobby';
import VoteAgreeDisagree from '../components/VoteAgreeDisagree';
import VoteMultipleChoice from '../components/VoteMultipleChoice';
import type { Session, Question, SessionStatus } from '../types/database';

type ParticipantView = 'loading' | 'lobby' | 'voting' | 'waiting' | 'results' | 'error';
type SafeSession = Pick<Session, 'id' | 'session_id' | 'title' | 'status' | 'created_at'>;

const POLL_INTERVAL_MS = 4000;

export default function ParticipantSession() {
  const { sessionId } = useParams();
  const { session, setSession, reset } = useSessionStore();

  const [view, setView] = useState<ParticipantView>('loading');
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ref to track latest session status for polling logic
  const sessionStatusRef = useRef<SessionStatus | null>(null);

  // Restore display name from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('quickvote-display-name');
    if (stored) {
      setParticipantName(stored);
    }
  }, []);

  // Derive view from session + activeQuestion state
  const deriveView = useCallback(
    (status: SessionStatus | undefined, question: Question | null): ParticipantView => {
      if (!status) return 'loading';
      if (status === 'ended') return 'results';
      if (status === 'draft' || status === 'lobby') return 'lobby';
      if (status === 'active') {
        return question ? 'voting' : 'waiting';
      }
      return 'loading';
    },
    [],
  );

  // Initial load effect
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadInitial() {
      // Get participant ID from auth
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      const uid = user?.id ?? null;
      setParticipantId(uid);

      if (!uid) {
        setErrorMessage('Authentication failed. Please refresh the page.');
        setView('error');
        return;
      }

      // Fetch session (explicit columns, NO admin_token)
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, session_id, title, status, created_at')
        .eq('session_id', sessionId)
        .single();

      if (cancelled) return;

      if (sessionError || !sessionData) {
        setErrorMessage(sessionError?.message ?? 'Session not found');
        setView('error');
        return;
      }

      // Cast to Session for store (admin_token and created_by will be empty but store accepts it)
      const sessionForStore: Session = {
        ...sessionData,
        admin_token: '',
        created_by: '',
      };
      setSession(sessionForStore);
      sessionStatusRef.current = sessionData.status;

      // If session is active, fetch active question
      let question: Question | null = null;
      if (sessionData.status === 'active') {
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .maybeSingle();

        if (!cancelled && qData) {
          question = qData;
          setActiveQuestion(qData);
        }
      }

      // If session is ended, fetch all questions for results
      if (sessionData.status === 'ended') {
        const { data: qsData } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', sessionId)
          .order('position');

        if (!cancelled && qsData) {
          setAllQuestions(qsData);
        }
      }

      if (!cancelled) {
        setView(deriveView(sessionData.status, question));
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setSession, deriveView]);

  // Polling bridge effect
  useEffect(() => {
    if (!sessionId) return;
    // Only poll when in an active view state
    if (view !== 'lobby' && view !== 'voting' && view !== 'waiting') return;

    let cancelled = false;

    const intervalId = setInterval(async () => {
      if (cancelled) return;

      // Fetch session status
      const { data: statusData } = await supabase
        .from('sessions')
        .select('id, session_id, title, status, created_at')
        .eq('session_id', sessionId)
        .single();

      if (cancelled || !statusData) return;

      const newStatus = statusData.status;
      const statusChanged = newStatus !== sessionStatusRef.current;

      if (statusChanged) {
        sessionStatusRef.current = newStatus;
        const sessionForStore: Session = {
          ...statusData,
          admin_token: '',
          created_by: '',
        };
        setSession(sessionForStore);
      }

      // If session ended, fetch all questions and transition
      if (newStatus === 'ended') {
        const { data: qsData } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', sessionId)
          .order('position');

        if (!cancelled && qsData) {
          setAllQuestions(qsData);
        }
        if (!cancelled) {
          setActiveQuestion(null);
          setView('results');
        }
        return;
      }

      // If active, check for active question
      if (newStatus === 'active') {
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .maybeSingle();

        if (cancelled) return;

        const newQuestion = qData ?? null;
        const questionChanged =
          newQuestion?.id !== activeQuestion?.id;

        if (questionChanged) {
          setActiveQuestion(newQuestion);
        }

        setView(newQuestion ? 'voting' : 'waiting');
        return;
      }

      // draft or lobby
      if (newStatus === 'draft' || newStatus === 'lobby') {
        if (!cancelled) {
          setActiveQuestion(null);
          setView('lobby');
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId, view, activeQuestion?.id, setSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Handle name prompt submission
  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setParticipantName(trimmed);
    sessionStorage.setItem('quickvote-display-name', trimmed);
    setNamePromptVisible(false);
  }

  // Check if name prompt should show before voting on named questions
  const shouldPromptName =
    view === 'voting' &&
    activeQuestion &&
    !activeQuestion.anonymous &&
    !participantName;

  // Show name prompt if needed
  useEffect(() => {
    if (shouldPromptName) {
      setNamePromptVisible(true);
    } else {
      setNamePromptVisible(false);
    }
  }, [shouldPromptName]);

  // ---------- RENDER ----------

  // Loading state
  if (view === 'loading') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex items-center justify-center"
        style={{ minHeight: '100dvh' }}
      >
        <p className="text-gray-400 text-lg">Loading session...</p>
      </div>
    );
  }

  // Error state
  if (view === 'error') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex items-center justify-center"
        style={{ minHeight: '100dvh' }}
      >
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{errorMessage ?? 'Something went wrong'}</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 underline">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Lobby state
  if (view === 'lobby') {
    return <Lobby title={session?.title ?? 'Session'} />;
  }

  // Waiting between questions
  if (view === 'waiting') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
        style={{ minHeight: '100dvh' }}
      >
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">{session?.title ?? 'Session'}</h1>
          <p className="text-gray-400 text-lg">Waiting for next question...</p>
        </div>
      </div>
    );
  }

  // Results state (basic placeholder -- Plan 03-03 builds full SessionResults)
  if (view === 'results') {
    return (
      <div
        className="min-h-screen bg-gray-950 py-8 px-4"
        style={{ minHeight: '100dvh' }}
      >
        <div className="max-w-lg mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-white text-center">
            {session?.title ?? 'Session'} - Results
          </h1>
          <p className="text-gray-400 text-center">Session has ended. Thank you for participating!</p>
          <div className="space-y-3">
            {allQuestions.map((q, i) => (
              <div key={q.id} className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Question {i + 1}</p>
                <p className="text-white font-medium">{q.text}</p>
                <p className="text-gray-500 text-sm mt-1 capitalize">{q.type.replace('_', '/')}</p>
              </div>
            ))}
          </div>
          <div className="text-center pt-4">
            <a href="/" className="text-indigo-400 hover:text-indigo-300 underline">
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Voting state
  if (view === 'voting' && activeQuestion && participantId) {
    // Name prompt overlay for named questions
    if (namePromptVisible) {
      return (
        <div
          className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
          style={{ minHeight: '100dvh' }}
        >
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
            <p className="text-gray-300 text-sm font-medium text-center">
              This question shows voter names
            </p>
            <form onSubmit={handleNameSubmit} className="space-y-3">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Render voting component based on question type
    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col"
        style={{ minHeight: '100dvh' }}
      >
        {activeQuestion.type === 'agree_disagree' ? (
          <VoteAgreeDisagree
            question={activeQuestion}
            sessionId={sessionId!}
            participantId={participantId}
            displayName={participantName || null}
          />
        ) : (
          <VoteMultipleChoice
            question={activeQuestion}
            sessionId={sessionId!}
            participantId={participantId}
            displayName={participantName || null}
          />
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div
      className="min-h-screen bg-gray-950 flex items-center justify-center"
      style={{ minHeight: '100dvh' }}
    >
      <p className="text-gray-400 text-lg">Loading...</p>
    </div>
  );
}
