import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useTemplateStore } from '../stores/template-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import { useCountdown } from '../hooks/use-countdown';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { BatchCard } from '../components/BatchCard';
import { SequenceManager } from '../components/SequenceManager';
import { SessionQRCode } from '../components/QRCode';
import SessionResults from '../components/SessionResults';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ParticipantCount } from '../components/ParticipantCount';
import { CountdownTimer } from '../components/CountdownTimer';
import { AdminControlBar } from '../components/AdminControlBar';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { SlideDisplay } from '../components/SlideDisplay';
import { DevTestFab } from '../components/DevTestFab';
import { PresentationControls } from '../components/PresentationControls';
import { fetchTemplates } from '../lib/template-api';
import { ensureSessionItems, createBatchSessionItem } from '../lib/sequence-api';
import { deleteSlide } from '../lib/slide-api';
import { updateSessionTeams, validateTeamList } from '../lib/team-api';
import type { Question, Vote, Batch, SessionItem } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function AdminSession() {
  const { adminToken } = useParams();
  const {
    session,
    questions,
    batches,
    sessionItems,
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
    activeSessionItemId,
    navigationDirection,
  } = useSessionStore();
  const { templates } = useTemplateStore();
  const [copied, setCopied] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [userId, setUserId] = useState('');
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
  const [quickQuestionLoading, setQuickQuestionLoading] = useState(false);
  const [lastClosedQuestionId, setLastClosedQuestionId] = useState<string | null>(null);
  const [_addingQuestionToBatchId, _setAddingQuestionToBatchId] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [addingToBatchId, setAddingToBatchId] = useState<string | null>(null);

  // Team configuration state
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [teamInput, setTeamInput] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);

  // Track session ID in a ref for the channel setup callback
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;

    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

      // Load templates for template-aware result ordering
      fetchTemplates().catch(console.error);

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

      // Reclaim session ownership if auth identity changed (browser data cleared).
      // admin_token proves ownership; silently update created_by so RLS passes.
      if (authData?.user?.id && sessionData.created_by !== authData.user.id) {
        await supabase
          .from('sessions')
          .update({ created_by: authData.user.id })
          .eq('admin_token', adminToken);
      }

      setSession(sessionData);
      sessionIdRef.current = sessionData.session_id;

      // Initialize team names from session
      setTeamNames(sessionData.teams || []);

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

      // Backfill and load session items (unified sequence)
      try {
        const sessionItemsData = await ensureSessionItems(sessionData.session_id);
        useSessionStore.getState().setSessionItems(sessionItemsData);
      } catch (err) {
        console.warn('Failed to load session items:', err);
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

  // Poll votes every 10s while session is active (fallback for Postgres Changes).
  // Only updates state when vote count actually changes to avoid unnecessary re-renders.
  const lastVoteCountRef = useRef(0);
  useEffect(() => {
    if (!isActive || !session?.session_id) return;

    const interval = setInterval(async () => {
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', session.session_id);

      if (votesData && votesData.length !== lastVoteCountRef.current) {
        lastVoteCountRef.current = votesData.length;
        const voteMap: Record<string, Vote[]> = {};
        for (const vote of votesData) {
          if (!voteMap[vote.question_id]) {
            voteMap[vote.question_id] = [];
          }
          voteMap[vote.question_id].push(vote);
        }
        setSessionVotes(voteMap);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isActive, session?.session_id]);

  // Page-level countdown - purely visual reminder, does NOT auto-close voting
  const handleCountdownComplete = useCallback(() => {
    // Timer is just a visual reminder for the admin - no auto-close behavior
    // Admin manually closes voting when ready
  }, []);

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

  // Show progress dashboard only during active batch voting
  const showProgressDashboard = activeBatchId !== null;

  // --- Handler extraction ---

  // Helper to set timer_expires_at in database and local state
  async function setTimerExpiration(durationSeconds: number | null) {
    if (!session) return;
    const expiresAt = durationSeconds
      ? new Date(Date.now() + durationSeconds * 1000).toISOString()
      : null;

    await supabase
      .from('sessions')
      .update({ timer_expires_at: expiresAt })
      .eq('session_id', session.session_id);

    setSession({ ...session, timer_expires_at: expiresAt });
  }

  // Helper to clear timer_expires_at
  async function clearTimerExpiration() {
    if (!session) return;
    await supabase
      .from('sessions')
      .update({ timer_expires_at: null })
      .eq('session_id', session.session_id);

    setSession({ ...session, timer_expires_at: null });
  }

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
        await setTimerExpiration(timerDuration);
        startCountdown(timerDuration * 1000);
      } else {
        await clearTimerExpiration();
      }
    }
  }

  async function handleCloseVotingInternal(questionId: string) {
    stopCountdown();
    await clearTimerExpiration();

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

    // Close any active batch or questions first
    if (activeBatchId) {
      await handleCloseBatch(activeBatchId);
    }
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

    const store = useSessionStore.getState();
    const items = store.sessionItems;

    // Determine insert position: right after the current active item
    const activeItemId = store.activeSessionItemId;
    const activeIdx = activeItemId ? items.findIndex((i) => i.id === activeItemId) : -1;
    const insertAfterPos = activeIdx >= 0 ? items[activeIdx].position : -1;

    // Shift all items after the insert point to make room
    const itemsToShift = items.filter((i) => i.position > insertAfterPos);
    if (itemsToShift.length > 0) {
      for (const item of itemsToShift) {
        await supabase
          .from('session_items')
          .update({ position: item.position + 1 })
          .eq('id', item.id);
      }
      // Update local store positions
      const updatedItems = items.map((i) =>
        i.position > insertAfterPos ? { ...i, position: i.position + 1 } : i
      );
      useSessionStore.getState().setSessionItems(updatedItems);
    }

    const newItemPosition = insertAfterPos + 1;

    // Find next batch position
    const maxBatchPos = store.batches.length > 0
      ? Math.max(...store.batches.map((b) => b.position))
      : -1;
    const maxQuestionPos = questions.length > 0
      ? Math.max(...questions.map((q) => q.position))
      : -1;
    const nextBatchPosition = Math.max(maxBatchPos, maxQuestionPos) + 1;

    // 1. Create a batch to wrap the quick question
    const { data: batch, error: batchErr } = await supabase
      .from('batches')
      .insert({
        session_id: session.session_id,
        name: text.trim(),
        position: nextBatchPosition,
      })
      .select()
      .single();

    if (batchErr || !batch) {
      console.error('Failed to create quick question batch:', batchErr);
      setQuickQuestionLoading(false);
      return;
    }

    useSessionStore.getState().addBatch(batch);

    // 2. Create the question inside the batch
    const { data: question, error: qErr } = await supabase
      .from('questions')
      .insert({
        session_id: session.session_id,
        batch_id: batch.id,
        text: text.trim(),
        type: 'agree_disagree' as const,
        options: null,
        position: 0,
        status: 'active' as const,
      })
      .select()
      .single();

    if (qErr || !question) {
      console.error('Failed to create quick question:', qErr);
      setQuickQuestionLoading(false);
      return;
    }

    useSessionStore.getState().addQuestion(question);

    // 3. Create session item directly after current item
    const { data: sessionItem, error: siErr } = await supabase
      .from('session_items')
      .insert({
        session_id: session.session_id,
        item_type: 'batch',
        batch_id: batch.id,
        position: newItemPosition,
        slide_image_path: null,
        slide_caption: null,
      })
      .select()
      .single();

    if (siErr || !sessionItem) {
      console.error('Failed to create session item:', siErr);
      setQuickQuestionLoading(false);
      return;
    }

    useSessionStore.getState().addSessionItem(sessionItem);
    useSessionStore.getState().setActiveSessionItemId(sessionItem.id);

    // 4. Activate the batch (sends broadcast, starts timer)
    await handleActivateBatch(batch.id, timerDuration);
    setLastClosedQuestionId(null);

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

      // Auto-activate first sequence item if any exist
      const sessionItems = useSessionStore.getState().sessionItems;
      if (sessionItems.length > 0) {
        await handleActivateSequenceItem(sessionItems[0], 'forward');
      }
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

  async function handleToggleTestMode() {
    if (!session) return;
    const newValue = !(session.test_mode ?? false);
    const { error: err } = await supabase
      .from('sessions')
      .update({ test_mode: newValue })
      .eq('session_id', session.session_id);

    if (!err) {
      setSession({ ...session, test_mode: newValue });
    }
  }

  // --- Batch handlers ---

  async function handleCreateBatch(): Promise<string | undefined> {
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
      // Create corresponding session_item for the new batch
      const sessionItem = await createBatchSessionItem(session.session_id, data.id);
      useSessionStore.getState().addSessionItem(sessionItem);
      return data.id;
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
      // Re-fetch session items to reflect cascade deletion
      const { data: refreshedItems } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', session.session_id)
        .order('position', { ascending: true });
      if (refreshedItems) {
        useSessionStore.getState().setSessionItems(refreshedItems);
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

  async function handleDeleteSlide(item: SessionItem) {
    if (!window.confirm('Delete this slide? The image will be permanently removed.')) return;
    try {
      await deleteSlide(item.id, item.slide_image_path!);
      useSessionStore.getState().removeSessionItem(item.id);
    } catch (err) {
      console.error('Failed to delete slide:', err);
    }
  }

  async function handleActivateBatch(batchId: string, timerDuration: number | null = null) {
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
    useSessionStore.getState().updateBatch(batchId, { status: 'active' });

    // 4. Get question IDs for this batch (read from store to avoid stale closure)
    const latestQuestions = useSessionStore.getState().questions;
    const batchQuestions = latestQuestions.filter((q) => q.batch_id === batchId);
    const questionIds = batchQuestions.map((q) => q.id);

    // 5. Broadcast to participants (include timer)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'batch_activated',
      payload: { batchId, questionIds, timerSeconds: timerDuration },
    });

    // 6. Start countdown if timer is set
    if (timerDuration) {
      await setTimerExpiration(timerDuration);
      startCountdown(timerDuration * 1000);
    } else {
      await clearTimerExpiration();
    }
  }

  async function handleCloseBatch(batchId: string) {
    stopCountdown();
    await clearTimerExpiration();

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

  async function handleActivateSequenceItem(item: SessionItem, direction: 'forward' | 'backward') {
    // Set active item and direction in store
    useSessionStore.getState().setActiveSessionItemId(item.id);
    useSessionStore.getState().setNavigationDirection(direction);

    if (item.item_type === 'batch' && item.batch_id) {
      // Activate batch (no timer for sequence navigation)
      await handleActivateBatch(item.batch_id, null);
    } else if (item.item_type === 'slide') {
      // Clear any active batch first
      if (activeBatchId) {
        await handleCloseBatch(activeBatchId);
      }

      // Close any active individual question
      await supabase
        .from('questions')
        .update({ status: 'closed' as const })
        .eq('session_id', session!.session_id)
        .eq('status', 'active');

      for (const q of questions) {
        if (q.status === 'active') {
          updateQuestion(q.id, { status: 'closed' });
        }
      }
      stopCountdown();

      // Broadcast slide activation to participants
      channelRef.current?.send({
        type: 'broadcast',
        event: 'slide_activated',
        payload: { itemId: item.id },
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


  // --- Team management handlers ---

  async function handleAddTeam() {
    if (!session) return;
    const trimmed = teamInput.trim();
    if (!trimmed) return;

    const newTeams = [...teamNames, trimmed];
    const validation = validateTeamList(newTeams);

    if (!validation.valid) {
      setTeamError(validation.error || 'Invalid team name');
      return;
    }

    const result = await updateSessionTeams(session.session_id, newTeams);
    if (result.success) {
      setTeamNames(newTeams);
      setTeamInput('');
      setTeamError(null);
      // Update session in store
      setSession({ ...session, teams: newTeams });
    } else {
      setTeamError(result.error || 'Failed to add team');
    }
  }

  async function handleRemoveTeam(teamName: string) {
    if (!session) return;
    const newTeams = teamNames.filter(t => t !== teamName);

    const result = await updateSessionTeams(session.session_id, newTeams);
    if (result.success) {
      setTeamNames(newTeams);
      setTeamError(null);
      // Update session in store
      setSession({ ...session, teams: newTeams });
    } else {
      setTeamError(result.error || 'Failed to remove team');
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
              <button
                onClick={handleToggleTestMode}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  session.test_mode
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
                {session.test_mode ? 'Test Mode On' : 'Test Mode Off'}
              </button>
            </div>

            {/* Team Configuration (draft mode only) */}
            {isDraft && (
              <div className="bg-white rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-500 font-medium">Team Configuration</p>
                <p className="text-xs text-gray-400">
                  Configure team names for team-based voting. Teams are locked once session goes live.
                </p>

                {/* Team input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTeam();
                      }
                    }}
                    placeholder="Team name"
                    maxLength={50}
                    className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddTeam}
                    disabled={!teamInput.trim() || teamNames.length >= 5}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    Add Team
                  </button>
                </div>

                {/* Team count indicator */}
                <p className="text-xs text-gray-500">
                  {teamNames.length} of 5 teams
                </p>

                {/* Error message */}
                {teamError && (
                  <p className="text-sm text-red-600">{teamError}</p>
                )}

                {/* Team list */}
                {teamNames.length > 0 && (
                  <div className="space-y-2">
                    {teamNames.map((team) => (
                      <div
                        key={team}
                        className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 font-medium">{team}</span>
                        <button
                          onClick={() => handleRemoveTeam(team)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {teamNames.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    No teams configured
                  </p>
                )}
              </div>
            )}

            {/* Session Sequence - unified list of batches and slides */}
            <div className="bg-white rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Sequence</h2>
              <SequenceManager
                sessionId={session.session_id}
                onExpandBatch={(batchId) => setExpandedBatchId(batchId)}
                onCreateBatch={handleCreateBatch}
                onDeleteBatch={handleDeleteBatch}
                onDeleteSlide={handleDeleteSlide}
              />

              {/* Expanded batch detail panel */}
              {expandedBatchId && (() => {
                const batch = batches.find(b => b.id === expandedBatchId);
                if (!batch) return null;
                return (
                  <div className="bg-white rounded-lg p-4 border border-blue-200 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-500">Editing Batch</h3>
                      <button onClick={() => setExpandedBatchId(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                        Close
                      </button>
                    </div>
                    <BatchCard
                      sessionId={session.session_id}
                      batch={batch}
                      questions={questions.filter(q => q.batch_id === batch.id)}
                      isExpanded={true}
                      isAddingQuestion={addingToBatchId === batch.id}
                      isActive={false}
                      canActivate={false}
                      showActivateButton={false}
                      onToggle={() => setExpandedBatchId(null)}
                      onNameChange={(name) => handleBatchNameChange(batch.id, name)}
                      onQuestionReorder={(ids) => handleQuestionReorder(batch.id, ids)}
                      onEditQuestion={setEditingQuestion}
                      onDeleteQuestion={handleDelete}
                      onAddQuestion={() => setAddingToBatchId(batch.id)}
                      onAddQuestionDone={() => setAddingToBatchId(null)}
                      onDeleteBatch={() => handleDeleteBatch(batch.id)}
                      onActivate={handleActivateBatch}
                      onClose={handleCloseBatch}
                      editingQuestion={editingQuestion}
                      onCancelEdit={handleCancelEdit}
                    />
                  </div>
                );
              })()}
            </div>
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

      {/* Presentation Controls View */}
      {isActive && (
        <PresentationControls
          sessionId={session.session_id}
          sessionTitle={session.title}
          participantCount={participantCount}
          connectionStatus={connectionStatus}
          channelRef={channelRef}
          sessionVotes={sessionVotes}
          onActivateSequenceItem={handleActivateSequenceItem}
          onEndSession={handleEndSession}
          onQuickQuestion={handleQuickQuestion}
          quickQuestionLoading={quickQuestionLoading}
          countdownRemaining={countdownRemaining}
          countdownRunning={countdownRunning}
          onCloseVoting={handleCloseVotingInternal}
        />
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

      {/* QR Code overlay — always visible (hideable) */}
      <SessionQRCode url={participantUrl} visible />

      {/* Test FAB — visible when test mode enabled */}
      <DevTestFab
        sessionId={session.session_id}
        testMode={session.test_mode ?? false}
        activeQuestion={activeQuestion}
        activeBatchId={activeBatchId}
        batchQuestionIds={activeBatchQuestionIds}
        teams={session.teams}
      />

      {/* Admin Control Bar — hidden during active sessions (PresentationControls has its own controls) */}
      {!isActive && <AdminControlBar
        status={session.status}
        participantCount={participantCount}
        transitioning={transitioning}
        onStartSession={handleStartSession}
        onBeginVoting={handleBeginVoting}
        onCopyLink={handleCopyLink}
        copied={copied}
      />}
    </AdminPasswordGate>
  );
}

// --- Hero component for active question display ---

function ActiveQuestionHero({
  question,
  questionIndex,
  totalQuestions,
  votes,
}: {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  votes: Vote[];
}) {
  const templates = useTemplateStore(state => state.templates);
  const [reasonsCollapsed, setReasonsCollapsed] = useState(false);
  const aggregated = useMemo(() => aggregateVotes(votes), [votes]);
  const barData = useMemo(() => {
    const template = question.template_id ? templates.find(t => t.id === question.template_id) : null;
    const ordered = buildConsistentBarData(question, aggregated, template?.options);
    return ordered.map((vc, index) => {
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
  }, [aggregated, question.type, question.template_id, templates]);

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

        <div className="flex items-center justify-center gap-6 mt-4">
          <span className="text-2xl text-gray-600">
            {votes.length} vote{votes.length !== 1 ? 's' : ''}
          </span>
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
