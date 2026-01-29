import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { useCountdown } from '../hooks/use-countdown';
import { aggregateVotes } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { BatchList } from '../components/BatchList';
import { SessionQRCode } from '../components/QRCode';
import SessionResults from '../components/SessionResults';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ParticipantCount } from '../components/ParticipantCount';
import { CountdownTimer } from '../components/CountdownTimer';
import { AdminControlBar } from '../components/AdminControlBar';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { SessionImportExport } from '../components/SessionImportExport';
import { TemplatePanel } from '../components/TemplatePanel';
import { ProgressDashboard } from '../components/ProgressDashboard';
import type { Question, Vote, Batch } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function AdminSession() {
  const { adminToken } = useParams();
  const {
    session,
    questions,
    batches,
    setSession,
    setQuestions,
    setBatches,
    setLoading,
    setError,
    updateQuestion,
    loading,
    error,
    reset,
    activeBatchId,
    setActiveBatchId,
  } = useSessionStore();
  const [copied, setCopied] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [userId, setUserId] = useState('');
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
  const [quickQuestionLoading, setQuickQuestionLoading] = useState(false);
  const [lastClosedQuestionId, setLastClosedQuestionId] = useState<string | null>(null);
  const [_addingQuestionToBatchId, _setAddingQuestionToBatchId] = useState<string | null>(null);
  const [pendingBatchId] = useState<string | null>(null);
  const [resultsViewIndex, setResultsViewIndex] = useState(0);

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

      // Fetch batches for this session
      const { data: batchesData, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionData.session_id)
        .order('position', { ascending: true });

      if (cancelled) return;

      if (!batchesError && batchesData) {
        setBatches(batchesData);
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

    // Listen for batch changes (INSERT/UPDATE/DELETE) via Postgres Changes
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'batches',
        filter: `session_id=eq.${sid}`,
      },
      (payload: any) => {
        const newBatch = payload.new as Batch;
        if (payload.eventType === 'INSERT') {
          useSessionStore.getState().addBatch(newBatch);
        } else if (payload.eventType === 'UPDATE') {
          useSessionStore.getState().updateBatch(newBatch.id, newBatch);
        } else if (payload.eventType === 'DELETE') {
          useSessionStore.getState().removeBatch(payload.old.id);
        }
      }
    );
  }, []);

  const isDraft = session?.status === 'draft';
  const isLobby = session?.status === 'lobby';
  const isActive = session?.status === 'active';
  const isEnded = session?.status === 'ended';
  const isLive = isLobby || isActive;

  // Vote counts per question for progress tracking
  const questionVoteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const qId of Object.keys(sessionVotes)) {
      counts[qId] = sessionVotes[qId].length;
    }
    return counts;
  }, [sessionVotes]);

  // Question IDs for the currently active batch
  const activeBatchQuestionIds = useMemo(() => {
    if (!activeBatchId) return [];
    return questions.filter(q => q.batch_id === activeBatchId).map(q => q.id);
  }, [activeBatchId, questions]);

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

  // Sync resultsViewIndex when a question is closed
  useEffect(() => {
    if (lastClosedQuestionId && closedQuestions.length > 0) {
      const idx = closedQuestions.findIndex((q) => q.id === lastClosedQuestionId);
      if (idx !== -1) {
        setResultsViewIndex(idx);
      }
    }
  }, [lastClosedQuestionId, closedQuestions]);

  // Show progress dashboard only during active batch voting
  const showProgressDashboard = activeBatchId !== null;

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

  // --- Batch handlers ---

  async function handleCreateBatch() {
    if (!session) return;
    // Consider both batch positions AND unbatched question positions
    // since they're interleaved in the UI sorted by position
    const maxBatchPos = batches.length > 0
      ? Math.max(...batches.map(b => b.position))
      : -1;
    const unbatchedQuestions = questions.filter(q => q.batch_id === null);
    const maxQuestionPos = unbatchedQuestions.length > 0
      ? Math.max(...unbatchedQuestions.map(q => q.position))
      : -1;
    const nextPosition = Math.max(maxBatchPos, maxQuestionPos) + 1;

    const { data, error: err } = await supabase
      .from('batches')
      .insert({
        session_id: session.session_id,
        name: 'Untitled Batch',
        position: nextPosition,
      })
      .select()
      .single();

    if (!err && data) {
      useSessionStore.getState().addBatch(data);
    }
  }

  async function handleBatchNameChange(batchId: string, name: string) {
    const { error: err } = await supabase
      .from('batches')
      .update({ name })
      .eq('id', batchId);

    if (!err) {
      useSessionStore.getState().updateBatch(batchId, { name });
    }
  }

  async function handleDeleteBatch(batchId: string) {
    if (!window.confirm('Delete this batch? Questions will be moved to unbatched.')) return;
    if (!session) return;

    const { error: err } = await supabase
      .from('batches')
      .delete()
      .eq('id', batchId);

    if (!err) {
      useSessionStore.getState().removeBatch(batchId);
      // Questions automatically become unbatched via ON DELETE SET NULL
      // Refresh questions to get updated batch_id values
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', session.session_id)
        .order('position', { ascending: true });
      if (questionsData) {
        useSessionStore.getState().setQuestions(questionsData);
      }
    }
  }

  async function handleQuestionReorder(_batchId: string, questionIds: string[]) {
    // Update positions in parallel
    const updates = questionIds.map((id, index) =>
      supabase.from('questions').update({ position: index }).eq('id', id)
    );
    await Promise.all(updates);

    // Optimistic update in store - only update positions for these specific questions
    questionIds.forEach((id, index) => {
      updateQuestion(id, { position: index });
    });
  }

  async function handleMoveQuestionToBatch(questionId: string, batchId: string | null) {
    // Update question's batch_id in database
    const { error } = await supabase
      .from('questions')
      .update({ batch_id: batchId })
      .eq('id', questionId);

    if (!error) {
      // Optimistic update in store
      updateQuestion(questionId, { batch_id: batchId });
    }
  }

  async function handleReorderItems(itemIds: string[]) {
    if (!session) return;

    // Update positions sequentially to avoid type issues with PostgrestFilterBuilder
    for (let index = 0; index < itemIds.length; index++) {
      const itemId = itemIds[index];
      if (itemId.startsWith('batch-')) {
        const batchId = itemId.replace('batch-', '');
        await supabase.from('batches').update({ position: index }).eq('id', batchId);
        useSessionStore.getState().updateBatch(batchId, { position: index });
      } else if (itemId.startsWith('question-')) {
        const questionId = itemId.replace('question-', '');
        await supabase.from('questions').update({ position: index }).eq('id', questionId);
        updateQuestion(questionId, { position: index });
      }
    }
  }

  async function handleActivateBatch(batchId: string) {
    if (!session) return;

    // 1. Close any active live questions first
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

    // 2. Update batch status to active in database
    const { error: batchError } = await supabase
      .from('batches')
      .update({ status: 'active' as const })
      .eq('id', batchId);

    if (batchError) {
      console.error('Failed to activate batch:', batchError);
      return;
    }

    // 3. Update local store
    setActiveBatchId(batchId);
    setResultsViewIndex(0);
    useSessionStore.getState().updateBatch(batchId, { status: 'active' });

    // 4. Get question IDs for this batch
    const batchQuestions = questions.filter((q) => q.batch_id === batchId);
    const questionIds = batchQuestions.map((q) => q.id);

    // 5. Broadcast to participants
    channelRef.current?.send({
      type: 'broadcast',
      event: 'batch_activated',
      payload: { batchId, questionIds },
    });
  }

  async function handleCloseBatch(batchId: string) {
    // Capture batch question IDs for post-close display before any state changes
    const batchQuestionIds = questions
      .filter(q => q.batch_id === batchId)
      .map(q => q.id);

    // 1. Update batch status to closed
    const { error } = await supabase
      .from('batches')
      .update({ status: 'closed' as const })
      .eq('id', batchId);

    if (!error) {
      // 2. Close all questions in the batch so they show in results
      if (batchQuestionIds.length > 0) {
        await supabase
          .from('questions')
          .update({ status: 'closed' as const })
          .in('id', batchQuestionIds);

        // Update local store for each question
        for (const qId of batchQuestionIds) {
          updateQuestion(qId, { status: 'closed' });
        }
      }

      // 3. Update local store
      // Set lastClosedQuestionId to first batch question so navigation syncs
      if (batchQuestionIds.length > 0) {
        setLastClosedQuestionId(batchQuestionIds[0]);
      }
      setActiveBatchId(null);
      useSessionStore.getState().updateBatch(batchId, { status: 'closed' });

      // 4. Broadcast to participants
      channelRef.current?.send({
        type: 'broadcast',
        event: 'batch_closed',
        payload: { batchId },
      });
    }
  }

  async function handleDelete(question: Question) {
    if (!window.confirm('Delete this question?')) return;

    const { error: err } = await supabase
      .from('questions')
      .delete()
      .eq('id', question.id);

    if (!err) {
      useSessionStore.getState().removeQuestion(question.id);
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
      {isLive && <ConnectionBanner status={connectionStatus} />}

      {/* Draft View: preserved admin-focused layout */}
      {isDraft && (
        <div className="min-h-screen bg-gray-50 py-8 px-4 pb-20">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                  draft
                </span>
                <button
                  onClick={async () => {
                    if (confirm('Delete this session? This cannot be undone.')) {
                      await supabase.from('sessions').delete().eq('session_id', session.session_id);
                      window.location.href = '/';
                    }
                  }}
                  className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
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

            {/* Question list with edit/delete/reorder */}
            <div className="bg-white rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions & Batches</h2>
              <BatchList
                sessionId={session.session_id}
                batches={batches}
                questions={questions}
                activeBatchId={activeBatchId}
                activeQuestionId={activeQuestion?.id ?? null}
                editingQuestion={editingQuestion}
                showActivateButton={false}
                onEditQuestion={setEditingQuestion}
                onCancelEdit={handleCancelEdit}
                onDeleteQuestion={handleDelete}
                onBatchNameChange={handleBatchNameChange}
                onQuestionReorder={handleQuestionReorder}
                onAddQuestionToBatch={(batchId) => _setAddingQuestionToBatchId(batchId)}
                onCreateBatch={handleCreateBatch}
                onDeleteBatch={handleDeleteBatch}
                onActivateBatch={handleActivateBatch}
                onCloseBatch={handleCloseBatch}
                onMoveQuestionToBatch={handleMoveQuestionToBatch}
                onReorderItems={handleReorderItems}
              />
              <div className="pt-4 border-t border-gray-200">
                <SessionImportExport
                  sessionId={session.session_id}
                  sessionName={session.title}
                  onImportComplete={async () => {
                    // Refetch questions and batches after import
                    const { data: questionsData } = await supabase
                      .from('questions')
                      .select('*')
                      .eq('session_id', session.session_id)
                      .order('position');

                    const { data: batchesData } = await supabase
                      .from('batches')
                      .select('*')
                      .eq('session_id', session.session_id)
                      .order('position');

                    if (questionsData) useSessionStore.getState().setQuestions(questionsData);
                    if (batchesData) useSessionStore.getState().setBatches(batchesData);
                  }}
                />
              </div>
            </div>

            {/* Templates */}
            <TemplatePanel sessionId={session.session_id} />
          </div>
        </div>
      )}

      {/* Lobby View: large centered QR for projection */}
      {isLobby && (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 pb-20">
          {/* Settings toggle in top-right corner */}
          <div className="absolute top-4 right-4">
            <button
              onClick={handleToggleSessionReasons}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                session.reasons_enabled
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={session.reasons_enabled ? 'Reasons enabled - click to disable' : 'Reasons disabled - click to enable'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {session.reasons_enabled ? 'Reasons On' : 'Reasons Off'}
            </button>
          </div>

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
            <div className="flex items-center gap-4">
              <button
                onClick={handleToggleSessionReasons}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  session.reasons_enabled
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={session.reasons_enabled ? 'Reasons enabled - click to disable' : 'Reasons disabled - click to enable'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {session.reasons_enabled ? 'Reasons On' : 'Reasons Off'}
              </button>
              <ParticipantCount count={participantCount} size="default" />
            </div>
          </div>

          {/* Progress Dashboard - only during active batch voting */}
          {showProgressDashboard && (
            <ProgressDashboard
              questionIds={activeBatchQuestionIds}
              participantCount={participantCount}
              voteCounts={questionVoteCounts}
            />
          )}

          {/* Hero fills viewport minus header (56px), control bar (56px), and optional dashboard */}
          <div className="max-w-6xl mx-auto px-6" style={{ height: showProgressDashboard ? 'calc(100dvh - 12rem)' : 'calc(100dvh - 7rem)' }}>
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
            ) : closedQuestions.length > 0 ? (
              /* Show closed question results with navigation through ALL closed questions */
              (() => {
                // Clamp index to valid range
                const safeIndex = Math.max(0, Math.min(resultsViewIndex, closedQuestions.length - 1));
                const currentQuestion = closedQuestions[safeIndex];
                if (!currentQuestion) return null;
                const votes = sessionVotes[currentQuestion.id] ?? [];
                const qIndex = questions.findIndex((q) => q.id === currentQuestion.id);

                // Check if this is a batch question for context display
                const batch = currentQuestion.batch_id
                  ? batches.find((b) => b.id === currentQuestion.batch_id)
                  : null;

                return (
                  <div className="h-full flex flex-col relative">
                    {/* Results navigation header */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">
                          {batch ? `${batch.name} Results` : 'Results'}
                        </span>
                        <span className="text-sm text-gray-400">
                          Question {safeIndex + 1} of {closedQuestions.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResultsViewIndex((i) => Math.max(0, i - 1))}
                          disabled={safeIndex === 0}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Previous question"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setResultsViewIndex((i) => Math.min(closedQuestions.length - 1, i + 1))}
                          disabled={safeIndex === closedQuestions.length - 1}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Next question"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Question results */}
                    <div className="flex-1 min-h-0">
                      <ActiveQuestionHero
                        question={currentQuestion}
                        questionIndex={qIndex}
                        totalQuestions={questions.length}
                        votes={votes}
                        countdownRemaining={0}
                        countdownRunning={false}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Waiting state - prompt to use control bar */
              <div className="h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <p className="text-xl text-gray-400">
                      Ready for questions
                    </p>
                    <p className="text-sm text-gray-300">
                      Use the control bar below to add questions
                    </p>
                  </div>
                </div>
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
            <div className="text-center mt-8 space-y-3">
              <a
                href="/"
                className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
              >
                Start New Session
              </a>
              <div>
                <a
                  href="/"
                  className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                >
                  View All Sessions →
                </a>
              </div>
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
        // Batch props
        pendingBatchId={pendingBatchId}
        onCloseBatch={() => {
          if (activeBatchId) {
            handleCloseBatch(activeBatchId);
          }
        }}
        // Existing batches from draft mode
        batches={batches}
        onActivateBatch={handleActivateBatch}
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
  const [reasonsCollapsed, setReasonsCollapsed] = useState(false);
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
  // Sort by id for stable ordering (prevents reordering while reading aloud)
  const reasonsByColumn = useMemo(() => {
    const sortedVotes = [...votes].sort((a, b) => a.id.localeCompare(b.id));
    return barData.map((bar) => ({
      label: bar.label,
      color: bar.color,
      reasons: sortedVotes
        .filter((v) => v.value === bar.label && v.reason && v.reason.trim())
        .map((v) => ({ id: v.id, text: v.reason! })),
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
        <div className={`mt-4 mx-auto w-full max-w-4xl ${!reasonsCollapsed ? 'h-48 shrink-0' : 'flex-1 min-h-0'}`}>
          <BarChart data={barData} totalVotes={votes.length} size="fill" theme="light" />
        </div>
      )}

      {/* Reasons panel — shown by default when closed, grouped under bar columns */}
      {isClosed && totalReasons > 0 && (
        <div className="shrink-0 mt-3">
          <button
            onClick={() => setReasonsCollapsed((prev) => !prev)}
            className="text-lg font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            {reasonsCollapsed ? 'Show' : 'Hide'} Reasons ({totalReasons})
            <span className="ml-1">{reasonsCollapsed ? '\u25BC' : '\u25B2'}</span>
          </button>
          {!reasonsCollapsed && (
            <div className="mt-3 max-h-[35vh] overflow-y-auto">
              <div className="flex gap-6 justify-center max-w-6xl mx-auto px-4">
                {reasonsByColumn.map((col) => (
                  <div
                    key={col.label}
                    className="flex-1 min-w-0 space-y-2"
                  >
                    <p
                      className="text-base font-semibold text-center"
                      style={{ color: col.color }}
                    >
                      {col.label} ({col.reasons.length})
                    </p>
                    {col.reasons.map((reason) => (
                      <div
                        key={reason.id}
                        className="bg-gray-50 rounded-lg px-3 py-2 text-left"
                        style={{ borderLeft: `3px solid ${col.color}` }}
                      >
                        <span className="text-lg text-gray-800">{reason.text}</span>
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
