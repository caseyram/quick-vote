import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { usePresence } from '../hooks/use-presence';
import { useCountdown } from '../hooks/use-countdown';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { CountdownTimer } from '../components/CountdownTimer';
import { ParticipantCount } from '../components/ParticipantCount';
import VoteAgreeDisagree from '../components/VoteAgreeDisagree';
import VoteMultipleChoice from '../components/VoteMultipleChoice';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Session, Question, SessionStatus } from '../types/database';

type ParticipantView = 'loading' | 'lobby' | 'voting' | 'waiting' | 'results' | 'error';
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
  const [waitingMessage, setWaitingMessage] = useState('Waiting for next question...');

  // Crossfade state
  const [contentVisible, setContentVisible] = useState(true);
  const [displayedQuestion, setDisplayedQuestion] = useState<Question | null>(null);

  // Refs for mutable state accessible from Broadcast callbacks (avoid stale closures)
  const viewRef = useRef<ParticipantView>('loading');
  const activeQuestionRef = useRef<Question | null>(null);
  const hasConnectedOnce = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  // Crossfade: when activeQuestion changes, fade out then swap content
  useEffect(() => {
    if (activeQuestion?.id !== displayedQuestion?.id) {
      if (displayedQuestion !== null && activeQuestion !== null) {
        // Crossfade: fade out, swap, fade in
        setContentVisible(false);
        const timer = setTimeout(() => {
          setDisplayedQuestion(activeQuestion);
          setContentVisible(true);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        // No fade for initial question or clearing
        setDisplayedQuestion(activeQuestion);
        setContentVisible(true);
      }
    }
  }, [activeQuestion, displayedQuestion]);

  // Restore display name from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('quickvote-display-name');
    if (stored) {
      setParticipantName(stored);
    }
  }, []);

  // Countdown timer -- purely cosmetic for participants.
  // The actual close comes from admin's voting_closed broadcast.
  const handleTimerComplete = useCallback(() => {
    // No-op: the real view transition happens when voting_closed broadcast arrives.
    // The timer just stops displaying.
  }, []);

  const { remaining, isRunning, start: startCountdown, stop: stopCountdown } = useCountdown(handleTimerComplete);

  // Re-fetch current state from DB (used on initial load and reconnection)
  const refetchState = useCallback(async () => {
    if (!sessionId) return;

    // Fetch session status
    const { data: statusData } = await supabase
      .from('sessions')
      .select('id, session_id, title, status, created_at')
      .eq('session_id', sessionId)
      .single();

    if (!statusData) return;

    const sessionForStore: Session = {
      ...statusData,
      admin_token: '',
      created_by: '',
    };
    setSession(sessionForStore);

    // Handle based on current status
    if (statusData.status === 'ended') {
      const { data: qsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position');

      if (qsData) setAllQuestions(qsData);
      setActiveQuestion(null);
      stopCountdown();
      setView('results');
      return;
    }

    if (statusData.status === 'active') {
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (qData) {
        setActiveQuestion(qData);
        setView('voting');
      } else {
        setActiveQuestion(null);
        setView('waiting');
        setWaitingMessage('Waiting for next question...');
      }
      return;
    }

    // draft or lobby
    setActiveQuestion(null);
    stopCountdown();
    setView('lobby');
  }, [sessionId, setSession, stopCountdown]);

  // Channel setup callback -- registers all Broadcast listeners
  const setupChannel = useCallback(
    (channel: RealtimeChannel) => {
      // 1. question_activated: admin activated a new question
      channel.on('broadcast', { event: 'question_activated' }, async ({ payload }) => {
        const { questionId, timerSeconds } = payload as { questionId: string; timerSeconds: number | null };

        // Fetch full question from DB
        const { data } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (data) {
          setActiveQuestion(data);
          setView('voting');
          setWaitingMessage('Waiting for next question...');

          if (timerSeconds != null && timerSeconds > 0) {
            startCountdown(timerSeconds * 1000);
          } else {
            stopCountdown();
          }
        }
      });

      // 2. voting_closed: admin closed voting on a question
      channel.on('broadcast', { event: 'voting_closed' }, ({ payload }) => {
        const { questionId } = payload as { questionId: string };
        if (activeQuestionRef.current?.id === questionId || true) {
          stopCountdown();
          setView('waiting');
          setWaitingMessage('The host is reviewing results...');
        }
      });

      // 3. results_revealed: admin revealed results for a question
      channel.on('broadcast', { event: 'results_revealed' }, ({ payload }) => {
        const { questionId: _questionId } = payload as { questionId: string };
        // Participants don't see charts per CONTEXT.md -- stay on waiting
        setView('waiting');
        setWaitingMessage('Results are being shown on the main screen');
      });

      // 4. session_active: session transitioned from lobby to active
      channel.on('broadcast', { event: 'session_active' }, () => {
        setView('waiting');
        setWaitingMessage('Waiting for next question...');
      });

      // 5. session_ended: admin ended the session
      channel.on('broadcast', { event: 'session_ended' }, async () => {
        stopCountdown();
        setActiveQuestion(null);

        // Fetch all questions for results list
        if (sessionId) {
          const { data: qsData } = await supabase
            .from('questions')
            .select('*')
            .eq('session_id', sessionId)
            .order('position');

          if (qsData) setAllQuestions(qsData);
        }

        setView('results');
      });

      // 6. session_lobby: session went to lobby state
      channel.on('broadcast', { event: 'session_lobby' }, () => {
        setActiveQuestion(null);
        stopCountdown();
        setView('lobby');
      });
    },
    [sessionId, startCountdown, stopCountdown],
  );

  // Realtime channel -- only enabled when we have a sessionId and we're not in error state
  const { channelRef, connectionStatus } = useRealtimeChannel(
    sessionId ? `session:${sessionId}` : '',
    setupChannel,
    !!sessionId && view !== 'error',
  );

  // Presence tracking -- only after auth
  const { participantCount } = usePresence(
    channelRef.current,
    participantId ?? '',
    'participant',
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
        const derivedView = deriveView(sessionData.status, question);
        setView(derivedView);
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setSession]);

  // Derive view from session + activeQuestion state (used only for initial load)
  function deriveView(status: SessionStatus | undefined, question: Question | null): ParticipantView {
    if (!status) return 'loading';
    if (status === 'ended') return 'results';
    if (status === 'draft' || status === 'lobby') return 'lobby';
    if (status === 'active') {
      return question ? 'voting' : 'waiting';
    }
    return 'loading';
  }

  // Re-fetch on reconnection to catch missed events (Pitfall 6 from RESEARCH.md)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      if (hasConnectedOnce.current) {
        // This is a reconnection -- re-fetch state to catch missed events
        refetchState();
      } else {
        hasConnectedOnce.current = true;
      }
    }
  }, [connectionStatus, refetchState]);

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
    return (
      <div style={{ minHeight: '100dvh' }} className="min-h-screen bg-gray-950 flex flex-col">
        <ConnectionBanner status={connectionStatus} />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">
            {session?.title ?? 'Session'}
          </h1>
          <p className="text-gray-400 text-lg mb-6">Waiting for host to start...</p>
          <ParticipantCount count={participantCount} />
        </div>
      </div>
    );
  }

  // Waiting between questions / results being shown
  if (view === 'waiting') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col"
        style={{ minHeight: '100dvh' }}
      >
        <ConnectionBanner status={connectionStatus} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">{session?.title ?? 'Session'}</h1>
            <p className="text-gray-400 text-lg">{waitingMessage}</p>
            <ParticipantCount count={participantCount} />
          </div>
        </div>
      </div>
    );
  }

  // Results state (session complete)
  if (view === 'results') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col"
        style={{ minHeight: '100dvh' }}
      >
        <ConnectionBanner status={connectionStatus} />
        <div className="flex-1 py-8 px-4">
          <div className="max-w-lg mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-white text-center">
              {session?.title ?? 'Session'} - Complete
            </h1>
            <p className="text-gray-400 text-center">Session has ended. Thank you for participating!</p>
            {participantCount > 0 && (
              <div className="flex justify-center">
                <ParticipantCount count={participantCount} />
              </div>
            )}
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
      </div>
    );
  }

  // Voting state
  if (view === 'voting' && displayedQuestion && participantId) {
    // Name prompt overlay for named questions
    if (namePromptVisible) {
      return (
        <div
          className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
          style={{ minHeight: '100dvh' }}
        >
          <ConnectionBanner status={connectionStatus} />
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

    // Render voting component based on question type with crossfade
    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col"
        style={{ minHeight: '100dvh' }}
      >
        <ConnectionBanner status={connectionStatus} />
        {/* Top bar with participant count and countdown timer */}
        <div className="flex items-center justify-between px-4 py-2">
          <ParticipantCount count={participantCount} />
          <CountdownTimer
            remainingSeconds={Math.ceil(remaining / 1000)}
            isRunning={isRunning}
          />
        </div>
        {/* Voting content with crossfade */}
        <div
          className="flex-1 flex flex-col transition-opacity duration-300"
          style={{ opacity: contentVisible ? 1 : 0 }}
        >
          {displayedQuestion.type === 'agree_disagree' ? (
            <VoteAgreeDisagree
              question={displayedQuestion}
              sessionId={sessionId!}
              participantId={participantId}
              displayName={participantName || null}
            />
          ) : (
            <VoteMultipleChoice
              question={displayedQuestion}
              sessionId={sessionId!}
              participantId={participantId}
              displayName={participantName || null}
            />
          )}
        </div>
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
