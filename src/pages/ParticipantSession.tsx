import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { useCountdown } from '../hooks/use-countdown';
import { ConnectionPill } from '../components/ConnectionPill';
import { CountdownTimer } from '../components/CountdownTimer';
import { ParticipantCount } from '../components/ParticipantCount';
import VoteAgreeDisagree from '../components/VoteAgreeDisagree';
import VoteMultipleChoice from '../components/VoteMultipleChoice';
import { BatchVotingCarousel } from '../components/BatchVotingCarousel';
import { TeamPicker } from '../components/TeamPicker';
import { TeamBadge } from '../components/TeamBadge';
import { fetchTemplates } from '../lib/template-api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Session, Question, SessionStatus } from '../types/database';

type ParticipantView = 'loading' | 'lobby' | 'voting' | 'waiting' | 'results' | 'error' | 'batch-voting';

// Slide transition variants for question changes (AnimatePresence)
const questionSlideVariants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
};

const questionTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

export default function ParticipantSession() {
  const { sessionId } = useParams();
  const { session, setSession, reset, setBatchQuestions, setActiveBatchId, batchQuestions } = useSessionStore();

  const [view, setView] = useState<ParticipantView>('loading');
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState('Waiting for next question...');

  // Team state
  const [participantTeam, setParticipantTeam] = useState<string | null>(null);
  const [teamLocked, setTeamLocked] = useState(false);
  const [showTeamJoinedToast, setShowTeamJoinedToast] = useState(false);

  // Refs for mutable state accessible from Broadcast callbacks (avoid stale closures)
  const viewRef = useRef<ParticipantView>('loading');
  const activeQuestionRef = useRef<Question | null>(null);
  // Keep refs in sync with state
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

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

  // Helper to start countdown from stored expiration time
  const restoreTimerFromExpiration = useCallback((timerExpiresAt: string | null) => {
    if (!timerExpiresAt) {
      stopCountdown();
      return;
    }
    const expiresAt = new Date(timerExpiresAt).getTime();
    const remainingMs = expiresAt - Date.now();
    if (remainingMs > 0) {
      startCountdown(remainingMs);
    } else {
      stopCountdown();
    }
  }, [startCountdown, stopCountdown]);

  // Re-fetch current state from DB (used on initial load and reconnection)
  const refetchState = useCallback(async () => {
    if (!sessionId) return;

    // Fetch session status (include timer_expires_at for countdown restoration)
    const { data: statusData } = await supabase
      .from('sessions')
      .select('id, session_id, title, status, reasons_enabled, test_mode, timer_expires_at, created_at, default_template_id, teams')
      .eq('session_id', sessionId)
      .single();

    if (!statusData) return;

    const sessionForStore: Session = {
      ...statusData,
      admin_token: '',
      created_by: '',
      teams: statusData.teams || [],
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
      // First check for an active batch (participant may have disconnected during batch voting)
      const { data: activeBatch, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (batchError) {
        console.warn('Failed to query active batch:', batchError.message);
      }

      if (activeBatch) {
        // Fetch questions belonging to this batch
        const { data: batchQs } = await supabase
          .from('questions')
          .select('*')
          .eq('batch_id', activeBatch.id)
          .order('position');

        if (batchQs && batchQs.length > 0) {
          setBatchQuestions(batchQs);
          setActiveBatchId(activeBatch.id);
          setView('batch-voting');
          // Restore timer from stored expiration
          restoreTimerFromExpiration(statusData.timer_expires_at);
          return;
        }
      }

      // No active batch, check for active individual question
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (qError) {
        console.warn('Failed to query active question:', qError.message);
      }

      if (qData) {
        setActiveQuestion(qData);
        setView('voting');
        // Restore timer from stored expiration
        restoreTimerFromExpiration(statusData.timer_expires_at);
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
  }, [sessionId, setSession, stopCountdown, setBatchQuestions, setActiveBatchId, restoreTimerFromExpiration]);

  // Handle batch completion - clears batch state and returns to waiting
  const handleBatchComplete = useCallback(() => {
    // Clear batch state
    setBatchQuestions([]);
    setActiveBatchId(null);
    // Transition to waiting screen
    setView('waiting');
    setWaitingMessage('Batch submitted! Waiting for results...');
  }, [setBatchQuestions, setActiveBatchId]);

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

      // 7. batch_activated: admin activated a batch of questions
      channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }) => {
        const { batchId, questionIds, timerSeconds } = payload as { batchId: string; questionIds: string[]; timerSeconds: number | null };

        // Validate non-empty
        if (!questionIds || questionIds.length === 0) {
          console.warn('Batch activated with no questions');
          return;
        }

        // Fetch questions by ID array, ordered by position
        const { data: batchQs } = await supabase
          .from('questions')
          .select('*')
          .in('id', questionIds)
          .order('position');

        if (batchQs && batchQs.length > 0) {
          setBatchQuestions(batchQs);
          setActiveBatchId(batchId);
          setView('batch-voting');

          // Start countdown if timer is set
          if (timerSeconds != null && timerSeconds > 0) {
            startCountdown(timerSeconds * 1000);
          } else {
            stopCountdown();
          }
        }
      });

      // 8. batch_closed: admin closed the active batch
      channel.on('broadcast', { event: 'batch_closed' }, () => {
        setBatchQuestions([]);
        setActiveBatchId(null);
        stopCountdown();
        setView('waiting');
        setWaitingMessage('Batch completed');
      });

      // 9. slide_activated: admin navigated to a content slide
      channel.on('broadcast', { event: 'slide_activated' }, () => {
        // Clear any active voting state
        stopCountdown();
        setActiveQuestion(null);
        // Show waiting state — participants don't see slide images
        setView('waiting');
        setWaitingMessage('Waiting for next question...');
      });
    },
    [sessionId, startCountdown, stopCountdown, setBatchQuestions, setActiveBatchId],
  );

  // Realtime channel -- only enabled when we have a sessionId and we're not in error state
  // Presence is configured here so listeners are registered BEFORE subscribe
  const presenceConfig = participantId ? { userId: participantId, role: 'participant' as const } : undefined;
  const { connectionStatus, participantCount } = useRealtimeChannel(
    sessionId ? `session:${sessionId}` : '',
    setupChannel,
    !!sessionId && view !== 'error',
    presenceConfig,
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

      // Load templates for template-aware rendering
      fetchTemplates().catch(console.error);

      // Fetch session (include teams column)
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, session_id, title, status, reasons_enabled, test_mode, timer_expires_at, created_at, default_template_id, teams')
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
        teams: sessionData.teams || [],
      };
      setSession(sessionForStore);

      // --- Team initialization logic ---
      // 1. Check for auto-assign from URL param
      const searchParams = new URLSearchParams(window.location.search);
      const autoAssignTeam = searchParams.get('team');

      // 2. Check if participant already has votes (team is locked after first vote)
      const { data: existingVotes } = await supabase
        .from('votes')
        .select('team_id')
        .eq('session_id', sessionId)
        .eq('participant_id', uid)
        .limit(1);

      if (!cancelled && existingVotes && existingVotes.length > 0) {
        // Participant has voted - team is locked
        const lockedTeam = existingVotes[0].team_id;
        setParticipantTeam(lockedTeam);
        setTeamLocked(true);
        // Store in sessionStorage
        if (lockedTeam) {
          sessionStorage.setItem(`quickvote-team-${sessionId}`, lockedTeam);
        }
      } else {
        // No votes yet - check for team assignment
        // 3. Check sessionStorage for existing team assignment
        const storedTeam = sessionStorage.getItem(`quickvote-team-${sessionId}`);

        if (autoAssignTeam && sessionForStore.teams.includes(autoAssignTeam)) {
          // Auto-assign from URL param
          setParticipantTeam(autoAssignTeam);
          sessionStorage.setItem(`quickvote-team-${sessionId}`, autoAssignTeam);
          // Show brief toast
          setShowTeamJoinedToast(true);
          setTimeout(() => setShowTeamJoinedToast(false), 2000);
        } else if (storedTeam && sessionForStore.teams.includes(storedTeam)) {
          // Restore from sessionStorage
          setParticipantTeam(storedTeam);
        }
        // else: no team assigned yet - will show picker if session has teams
      }

      // If session is active, check for active batch or question
      let question: Question | null = null;
      let hasBatchActive = false;
      if (sessionData.status === 'active') {
        // First check for active batch
        const { data: activeBatch, error: batchErr } = await supabase
          .from('batches')
          .select('*')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .maybeSingle();

        if (batchErr) {
          console.warn('Failed to query active batch on load:', batchErr.message);
        }

        if (!cancelled && activeBatch) {
          // Fetch questions belonging to this batch
          const { data: batchQs } = await supabase
            .from('questions')
            .select('*')
            .eq('batch_id', activeBatch.id)
            .order('position');

          if (!cancelled && batchQs && batchQs.length > 0) {
            setBatchQuestions(batchQs);
            setActiveBatchId(activeBatch.id);
            hasBatchActive = true;
          }
        }

        // If no active batch, check for active question
        if (!hasBatchActive) {
          const { data: qData, error: qErr } = await supabase
            .from('questions')
            .select('*')
            .eq('session_id', sessionId)
            .eq('status', 'active')
            .maybeSingle();

          if (qErr) {
            console.warn('Failed to query active question on load:', qErr.message);
          }

          if (!cancelled && qData) {
            question = qData;
            setActiveQuestion(qData);
          }
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
        if (hasBatchActive) {
          setView('batch-voting');
          // Restore timer from stored expiration
          restoreTimerFromExpiration(sessionData.timer_expires_at);
        } else {
          const derivedView = deriveView(sessionData.status, question);
          setView(derivedView);
          // Restore timer if viewing active question
          if (derivedView === 'voting') {
            restoreTimerFromExpiration(sessionData.timer_expires_at);
          }
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setSession, setBatchQuestions, setActiveBatchId, restoreTimerFromExpiration]);

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

  // Re-fetch on every connection (including first) to catch missed events
  // and act as a safety net for the initial load
  useEffect(() => {
    if (connectionStatus === 'connected') {
      refetchState();
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

  // Handle team selection
  function handleJoinTeam(teamName: string) {
    if (!sessionId) return;
    setParticipantTeam(teamName);
    sessionStorage.setItem(`quickvote-team-${sessionId}`, teamName);
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

  // Team picker gate - show before any other view if session has teams and participant hasn't joined
  const needsTeamPicker =
    session?.teams &&
    session.teams.length > 0 &&
    !participantTeam &&
    !teamLocked &&
    view !== 'loading' &&
    view !== 'error';

  if (needsTeamPicker) {
    return (
      <>
        <TeamPicker teams={session!.teams} onJoinTeam={handleJoinTeam} />
        {showTeamJoinedToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            Joined {participantTeam}!
          </div>
        )}
      </>
    );
  }

  // Loading state
  if (view === 'loading') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading session...</p>
      </div>
    );
  }

  // Error state
  if (view === 'error') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{errorMessage ?? 'Something went wrong'}</p>
          <p className="text-gray-500 text-sm">Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  // Lobby state
  if (view === 'lobby') {
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col">
        <ConnectionPill status={connectionStatus} />
        {participantTeam && <TeamBadge teamName={participantTeam} />}
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
      <div className="min-h-dvh bg-gray-950 flex flex-col">
        <ConnectionPill status={connectionStatus} />
        {participantTeam && <TeamBadge teamName={participantTeam} />}
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
      <div className="min-h-dvh bg-gray-950 flex flex-col">
        <ConnectionPill status={connectionStatus} />
        {participantTeam && <TeamBadge teamName={participantTeam} />}
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
            <p className="text-center text-gray-500 text-sm pt-4">
              Thank you for participating!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Batch voting state
  if (view === 'batch-voting' && batchQuestions.length > 0 && participantId) {
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col">
        <ConnectionPill status={connectionStatus} />
        {participantTeam && <TeamBadge teamName={participantTeam} />}
        {/* Timer at top when running */}
        {isRunning && (
          <div className="flex justify-center px-4 py-2 shrink-0">
            <CountdownTimer
              remainingSeconds={Math.ceil(remaining / 1000)}
              isRunning={isRunning}
            />
          </div>
        )}
        <div className="flex-1">
          <BatchVotingCarousel
            questions={batchQuestions}
            sessionId={sessionId!}
            participantId={participantId}
            displayName={participantName || null}
            reasonsEnabled={session?.reasons_enabled ?? false}
            onComplete={handleBatchComplete}
            teamId={participantTeam}
          />
        </div>
      </div>
    );
  }

  // Voting state
  if (view === 'voting' && activeQuestion && participantId) {
    // Name prompt overlay for named questions
    if (namePromptVisible) {
      return (
        <div className="h-dvh bg-gray-950 flex items-center justify-center px-4">
          <ConnectionPill status={connectionStatus} />
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

    // Full-screen voting takeover
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col">
        {/* Connection pill - always visible in top-right */}
        <ConnectionPill status={connectionStatus} />
        {participantTeam && <TeamBadge teamName={participantTeam} />}

        {/* Minimal top bar - only timer when active, no header/nav */}
        {isRunning && (
          <div className="flex justify-center px-4 py-2">
            <CountdownTimer
              remainingSeconds={Math.ceil(remaining / 1000)}
              isRunning={isRunning}
            />
          </div>
        )}

        {/* Full-screen voting area */}
        <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:p-8">
          <div className="w-full lg:max-w-2xl lg:rounded-2xl lg:bg-gray-900/50 lg:overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeQuestion.id}
                variants={questionSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={questionTransition}
              >
                {activeQuestion.type === 'agree_disagree' ? (
                  <VoteAgreeDisagree
                    question={activeQuestion}
                    sessionId={sessionId!}
                    participantId={participantId}
                    displayName={participantName || null}
                    reasonsEnabled={session?.reasons_enabled ?? false}
                    onVoteSubmit={() => {
                      setView('waiting');
                      setWaitingMessage('Vote submitted! Waiting for results...');
                    }}
                    teamId={participantTeam}
                  />
                ) : (
                  <VoteMultipleChoice
                    question={activeQuestion}
                    sessionId={sessionId!}
                    participantId={participantId}
                    displayName={participantName || null}
                    reasonsEnabled={session?.reasons_enabled ?? false}
                    onVoteSubmit={() => {
                      setView('waiting');
                      setWaitingMessage('Vote submitted! Waiting for results...');
                    }}
                    teamId={participantTeam}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-lg">Loading...</p>
    </div>
  );
}
