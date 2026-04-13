import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Question, Vote } from '../types/database';
import { SlideDisplay } from '../components/SlideDisplay';
import { QROverlay, type QRMode } from '../components/QROverlay';
import { KeyboardShortcutHelp } from '../components/KeyboardShortcutHelp';
import { BatchResultsProjection } from '../components/BatchResultsProjection';
import { BarChart, AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { aggregateVotes, buildConsistentBarData } from '../lib/vote-aggregation';
import { TeamQRGrid } from '../components/TeamQRGrid';
import { usePresentationTheme } from '../context/PresentationThemeContext';

export default function PresentationView() {
  const { adminToken } = useParams();
  const { theme, setTheme } = usePresentationTheme();

  // realSessionId is resolved from adminToken after the initial session fetch.
  // All channel subscriptions and DB queries use this value.
  const [realSessionId, setRealSessionId] = useState<string | null>(null);
  const {
    activeSessionItemId,
    sessionItems,
    batches,
    navigationDirection,
    setSession,
    setQuestions,
    setBatches,
    setLoading,
    setError,
  } = useSessionStore();

  const [showFullscreenHint, setShowFullscreenHint] = useState(true);
  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [linkCopied, setLinkCopied] = useState(false);
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const sessionVotes = useSessionStore((s) => s.votesByQuestion);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [moderatedVoteIds, setModeratedVoteIds] = useState<Set<string>>(new Set());
  const [highlightedReason, setHighlightedReason] = useState<{ questionId: string; reasonId: string } | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [reasonsPerPage, setReasonsPerPage] = useState<1 | 2 | 4>(1);
  const [activeInlineQuestion, setActiveInlineQuestion] = useState<Question | null>(null);
  const [inlineVotingClosed, setInlineVotingClosed] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [batchVotingActive, setBatchVotingActive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const prevConnectionStatus = useRef<ConnectionStatus>('connecting');
  // Refs for CDC filters (read inside useCallback without deps)
  const sessionRowIdRef = useRef<string | null>(null);    // UUID pk for sessions table filter
  const sessionTextIdRef = useRef<string | null>(null);   // session_id text for other tables

  // Load session data on mount
  useEffect(() => {
    if (!adminToken) return;

    let cancelled = false;

    async function loadSessionData() {
      setLoading(true);
      setError(null);

      // Fetch session by admin_token — this is the access gate.
      // No one can load the presentation without the secret admin token.
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
      const sid = sessionData.session_id;
      sessionRowIdRef.current = sessionData.id;
      sessionTextIdRef.current = sid;
      if (!cancelled) setRealSessionId(sid);

      // Fetch batches
      const { data: batchesData } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sid)
        .order('position', { ascending: true });

      if (batchesData && !cancelled) {
        setBatches(batchesData);
      }

      // Fetch questions (for batch display context)
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sid)
        .order('position', { ascending: true });

      if (questionsData && !cancelled) {
        setQuestions(questionsData);
      }

      // Fetch session items
      const { data: itemsData } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', sid)
        .order('position', { ascending: true });

      if (itemsData && !cancelled) {
        useSessionStore.getState().setSessionItems(itemsData);
      }

      // Sync active state from DB using the durable navigation pointer
      if (!cancelled && sessionData.current_session_item_id) {
        const activeItem = itemsData?.find(
          (item: any) => item.id === sessionData.current_session_item_id
        );
        if (activeItem) {
          useSessionStore.getState().setActiveSessionItemId(activeItem.id);
          if (activeItem.item_type === 'batch' && activeItem.batch_id) {
            useSessionStore.getState().setActiveBatchId(activeItem.batch_id);
            setBatchVotingActive(true);
          }
        }
      }

      // Check for active inline question (Go Live quick question)
      if (!cancelled) {
        const { data: activeQ } = await supabase
          .from('questions')
          .select('*')
          .eq('session_id', sid)
          .eq('status', 'active')
          .maybeSingle();

        if (activeQ && !cancelled) {
          setActiveInlineQuestion(activeQ);
          setInlineVotingClosed(false);
        }
      }

      // Load existing votes into the centralized store
      if (!cancelled) {
        const { data: votesData } = await supabase
          .from('votes')
          .select('*')
          .eq('session_id', sid);

        if (votesData) {
          useSessionStore.getState().setAllVotes(votesData);
          // Sync moderated IDs from DB
          const dbModeratedIds = new Set<string>();
          votesData.forEach((vote: Vote) => {
            if (vote.moderated_at) dbModeratedIds.add(vote.id);
          });
          setModeratedVoteIds(dbModeratedIds);
        }
      }

      setLoading(false);
    }

    loadSessionData();

    return () => {
      cancelled = true;
    };
  }, [adminToken, setSession, setQuestions, setBatches, setLoading, setError]);

  // Realtime channel setup
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    // Listen for slide activations
    channel.on('broadcast', { event: 'slide_activated' }, ({ payload }: any) => {
      useSessionStore.getState().setActiveSessionItemId(payload.itemId);
      useSessionStore.getState().setNavigationDirection(payload.direction ?? 'forward');
      setActiveInlineQuestion(null); // Clear any inline question
    });

    // Listen for batch activations (fast hint — CDC on sessions.current_session_item_id
    // is the reliable source of truth; this broadcast just resets transient UI state)
    channel.on('broadcast', { event: 'batch_activated' }, ({ payload }: any) => {
      setRevealedQuestions(new Set());
      setHighlightedReason(null);
      setSelectedQuestionId(null);
      setActiveInlineQuestion(null);
      setBatchVotingActive(true);

      useSessionStore.getState().setActiveBatchId(payload.batchId);
      // Try to resolve the session_item locally — if Go Live just created it,
      // the session_items CDC event will deliver the row shortly.
      const items = useSessionStore.getState().sessionItems;
      const batchItem = items.find(
        (item) => item.item_type === 'batch' && item.batch_id === payload.batchId
      );
      if (batchItem) {
        useSessionStore.getState().setActiveSessionItemId(batchItem.id);
      }
    });

    // Listen for batch closed - voting ended
    channel.on('broadcast', { event: 'batch_closed' }, () => {
      setBatchVotingActive(false);
    });

    // Listen for inline question activation (Go Live quick question)
    channel.on('broadcast', { event: 'question_activated' }, async ({ payload }: any) => {
      const { questionId } = payload;
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (data) {
        setActiveInlineQuestion(data);
        setInlineVotingClosed(false);
      }
    });

    // Listen for voting closed on inline question
    channel.on('broadcast', { event: 'voting_closed' }, () => {
      setInlineVotingClosed(true);
    });

    // Listen for session status changes
    channel.on('broadcast', { event: 'session_active' }, () => {
      const session = useSessionStore.getState().session;
      if (session) {
        useSessionStore.getState().setSession({ ...session, status: 'active' });
      }
    });

    channel.on('broadcast', { event: 'session_ended' }, () => {
      const session = useSessionStore.getState().session;
      if (session) {
        useSessionStore.getState().setSession({ ...session, status: 'ended' });
      }
    });

    // Listen for QR overlay toggle
    channel.on('broadcast', { event: 'presentation_qr_toggle' }, ({ payload }: any) => {
      setQrMode(payload.mode);
    });


    // Listen for black screen toggle
    channel.on('broadcast', { event: 'black_screen_toggle' }, ({ payload }: any) => {
      setBlackScreenActive(payload.active);
    });

    // Listen for result reveal (single question or batched questionIds)
    channel.on('broadcast', { event: 'result_reveal' }, ({ payload }: any) => {
      setRevealedQuestions((prev) => {
        const next = new Set(prev);
        const ids: string[] = payload.questionIds ?? [payload.questionId];
        for (const id of ids) {
          if (payload.revealed) next.add(id); else next.delete(id);
        }
        return next;
      });
      // Batched payload may include selectedQuestionId and reason reset
      if (payload.selectedQuestionId !== undefined) {
        setSelectedQuestionId(payload.selectedQuestionId);
      }
      if (payload.resetHighlight) {
        setHighlightedReason(null);
      }
    });

    // Listen for reason highlight
    channel.on('broadcast', { event: 'reason_highlight' }, ({ payload }: any) => {
      setHighlightedReason(
        payload.reasonId ? { questionId: payload.questionId, reasonId: payload.reasonId } : null
      );
    });

    // Listen for question tab selection (may include reason reset)
    channel.on('broadcast', { event: 'question_selected' }, ({ payload }: any) => {
      setSelectedQuestionId(payload.questionId);
      if (payload.resetHighlight) {
        setHighlightedReason(null);
      }
    });

    // Listen for reasons-per-page setting from admin
    channel.on('broadcast', { event: 'reasons_per_page' }, ({ payload }: any) => {
      setReasonsPerPage(payload.count);
    });

    // Listen for team filter changes from admin
    channel.on('broadcast', { event: 'team_filter_changed' }, ({ payload }: any) => {
      setSelectedTeam(payload.teamId);
    });

    // Listen for presentation theme change from admin controls
    channel.on('broadcast', { event: 'presentation_theme_changed' }, ({ payload }: any) => {
      if (payload?.theme === 'dark' || payload?.theme === 'light') {
        setTheme(payload.theme);
      }
    });

    // Listen for response moderation from admin controls
    channel.on('broadcast', { event: 'response_moderated' }, ({ payload }: { payload: { voteId: string; moderated: boolean } }) => {
      setModeratedVoteIds((prev) => {
        const next = new Set(prev);
        if (payload.moderated) {
          next.add(payload.voteId);
        } else {
          next.delete(payload.voteId);
        }
        return next;
      });
    });

    channelRef.current = channel;

    // ── Postgres Changes (CDC) — reliable source of truth ────────────────
    const rowId = sessionRowIdRef.current;
    const textId = sessionTextIdRef.current;
    if (!textId) return;

    // Navigation: sessions.current_session_item_id changes
    if (rowId) {
      channel.on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${rowId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;

          // Apply navigation pointer
          if (row.current_session_item_id) {
            const items = useSessionStore.getState().sessionItems;
            const item = items.find((i) => i.id === row.current_session_item_id);
            if (item) {
              useSessionStore.getState().setActiveSessionItemId(item.id);
              if (item.item_type === 'batch' && item.batch_id) {
                useSessionStore.getState().setActiveBatchId(item.batch_id);
              }
            }
          }

          // Pick up status transitions
          const currentSession = useSessionStore.getState().session;
          if (currentSession && row.status !== currentSession.status) {
            useSessionStore.getState().setSession({ ...currentSession, status: row.status });
          }
        }
      );
    }

    // Session items — new items from Go Live
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'session_items', filter: `session_id=eq.${textId}` },
      (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          useSessionStore.getState().addSessionItem(payload.new);
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          useSessionStore.getState().removeSessionItem(payload.old.id);
        }
      }
    );

    // Batches — status changes
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'batches', filter: `session_id=eq.${textId}` },
      (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          useSessionStore.getState().addBatch(payload.new);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          useSessionStore.getState().updateBatch(payload.new.id, payload.new);
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          useSessionStore.getState().removeBatch(payload.old.id);
        }
      }
    );

    // Questions — status changes (active → closed → revealed)
    channel.on(
      'postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'questions', filter: `session_id=eq.${textId}` },
      (payload: any) => {
        if (payload.new) {
          useSessionStore.getState().updateQuestion(payload.new.id, payload.new);
        }
      }
    );

    // Votes — replaces 3-second polling
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'votes', filter: `session_id=eq.${textId}` },
      (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old;
          if (old?.id && old?.question_id) {
            useSessionStore.getState().removeVote(old.id, old.question_id);
          }
        } else {
          const vote = payload.new as Vote;
          if (vote) {
            useSessionStore.getState().upsertVote(vote);
            // Track moderated status
            if (vote.moderated_at) {
              setModeratedVoteIds((prev) => new Set(prev).add(vote.id));
            }
          }
        }
      }
    );
  }, [setTheme]);

  const { connectionStatus } = useRealtimeChannel(
    realSessionId ? `session:${realSessionId}` : '',
    setupChannel,
    !!realSessionId
  );

  // Full state resync on reconnect
  useEffect(() => {
    if (
      prevConnectionStatus.current === 'reconnecting' &&
      connectionStatus === 'connected' &&
      realSessionId
    ) {
      (async () => {
        const [sessionRes, itemsRes, batchesRes, questionsRes, votesRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('session_id', realSessionId).single(),
          supabase.from('session_items').select('*').eq('session_id', realSessionId).order('position'),
          supabase.from('batches').select('*').eq('session_id', realSessionId).order('position'),
          supabase.from('questions').select('*').eq('session_id', realSessionId).order('position'),
          supabase.from('votes').select('*').eq('session_id', realSessionId),
        ]);

        if (sessionRes.data) setSession(sessionRes.data);
        if (itemsRes.data) useSessionStore.getState().setSessionItems(itemsRes.data);
        if (batchesRes.data) setBatches(batchesRes.data);
        if (questionsRes.data) setQuestions(questionsRes.data);
        if (votesRes.data) useSessionStore.getState().setAllVotes(votesRes.data);

        // Restore navigation from the durable pointer
        if (sessionRes.data?.current_session_item_id && itemsRes.data) {
          const activeItem = itemsRes.data.find(
            (i) => i.id === sessionRes.data!.current_session_item_id
          );
          if (activeItem) {
            useSessionStore.getState().setActiveSessionItemId(activeItem.id);
            if (activeItem.item_type === 'batch' && activeItem.batch_id) {
              useSessionStore.getState().setActiveBatchId(activeItem.batch_id);
            }
          }
        }

        // Sync moderated IDs
        if (votesRes.data) {
          const modIds = new Set<string>();
          votesRes.data.forEach((v) => { if (v.moderated_at) modIds.add(v.id); });
          setModeratedVoteIds(modIds);
        }
      })();
    }
    prevConnectionStatus.current = connectionStatus;
  }, [connectionStatus, realSessionId, setSession, setBatches, setQuestions]);

  // Subscribe to session from store
  const session = useSessionStore((s) => s.session);

  // CDC drives vote updates via upsertVote (see setupChannel above).
  // Safety-net poll catches anything CDC misses.
  const sessionStatus = useSessionStore((s) => s.session?.status);
  useEffect(() => {
    if (!realSessionId || (sessionStatus !== 'active' && sessionStatus !== 'lobby')) return;

    const poll = async () => {
      const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', realSessionId);

      if (data) {
        useSessionStore.getState().setAllVotes(data);
        // Sync moderated IDs
        const modIds = new Set<string>();
        data.forEach((v: Vote) => { if (v.moderated_at) modIds.add(v.id); });
        setModeratedVoteIds(modIds);
      }
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [realSessionId, sessionStatus]);

  // Set page title + force black background on html/body to hide any scrollbar gutter gap
  useEffect(() => {
    document.title = 'QuickVote Presentation';
    document.documentElement.style.scrollbarGutter = 'auto';
    document.documentElement.style.backgroundColor = 'black';
    document.body.style.backgroundColor = 'black';
    return () => {
      document.documentElement.style.scrollbarGutter = '';
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, []);

  // Hide fullscreen hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFullscreenHint(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        // Toggle fullscreen
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen();
        }
      } else if (event.key === 'Escape') {
        // Exit fullscreen or close shortcut help
        if (showShortcutHelp) {
          setShowShortcutHelp(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } else if (event.key === 'b' || event.key === 'B') {
        // Toggle black screen locally (do NOT broadcast - control view broadcasts)
        setBlackScreenActive((prev) => !prev);
      } else if (event.key === '?') {
        // Toggle keyboard shortcut help
        setShowShortcutHelp((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcutHelp]);

  // Find current active item
  const currentItem = activeSessionItemId
    ? sessionItems.find((item) => item.id === activeSessionItemId)
    : null;

  // When a batch cover matches the previous slide, skip all transitions —
  // the image is already on screen, no visual change needed
  const coverMatchesPrevSlide = (() => {
    if (currentItem?.item_type === 'batch' && currentItem.batch_id) {
      const batch = batches.find((b) => b.id === currentItem.batch_id);
      if (batch?.cover_image_path && revealedQuestions.size === 0) {
        const idx = sessionItems.findIndex((i) => i.id === activeSessionItemId);
        const prevItem = idx > 0 ? sessionItems[idx - 1] : null;
        if (prevItem?.item_type === 'slide' && prevItem.slide_image_path === batch.cover_image_path) {
          return true;
        }
      }
    }
    return false;
  })();
  const displayKey = coverMatchesPrevSlide
    ? sessionItems[sessionItems.findIndex((i) => i.id === activeSessionItemId) - 1].id
    : (activeSessionItemId ?? 'none');

  // Animation variants (unified directional slide transitions)
  const slideVariants = {
    enter: (direction: 'forward' | 'backward' | null) => ({
      x: direction === 'forward' ? '100%' : direction === 'backward' ? '-100%' : 0,
      opacity: direction ? 0 : 1,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: 'forward' | 'backward' | null) => ({
      x: direction === 'forward' ? '-100%' : direction === 'backward' ? '100%' : 0,
      opacity: direction ? 0 : 1,
    }),
  };

  const sessionUrl = realSessionId ? `${window.location.origin}/session/${realSessionId}` : '';

  return (
    <div
      data-presentation-theme={theme}
      className="fixed inset-0 flex items-center justify-center overflow-hidden text-[var(--pres-text)]"
      style={{ backgroundColor: 'var(--pres-bg)' }}
    >
      {/* Main projection content */}
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false} custom={navigationDirection}>
          <motion.div
            key={displayKey}
            custom={navigationDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
            className="w-full h-full absolute inset-0"
          >
          {activeInlineQuestion ? (
            <div className="flex flex-col items-center justify-center h-full px-12">
              <h2 className="text-4xl font-bold mb-8 text-center text-[var(--pres-text)]">
                {activeInlineQuestion.text}
              </h2>
              {inlineVotingClosed && sessionVotes[activeInlineQuestion.id] ? (
                (() => {
                  const votes = sessionVotes[activeInlineQuestion.id] || [];
                  const aggregated = aggregateVotes(votes, selectedTeam);
                  const barData = buildConsistentBarData(activeInlineQuestion, aggregated);
                  const chartData = barData.map((item, index) => {
                    let color: string;
                    if (activeInlineQuestion.type === 'agree_disagree') {
                      const colorMap: Record<string, string> = {
                        Agree: AGREE_DISAGREE_COLORS.agree,
                        Sometimes: AGREE_DISAGREE_COLORS.sometimes,
                        Disagree: AGREE_DISAGREE_COLORS.disagree,
                      };
                      color = colorMap[item.value] || MULTI_CHOICE_COLORS[0];
                    } else {
                      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
                    }
                    return { label: item.value, count: item.count, percentage: item.percentage, color };
                  });
                  return (
                    <div className="w-full max-w-2xl">
                      <BarChart data={chartData} totalVotes={votes.length} size="large" theme={theme} />
                    </div>
                  );
                })()
              ) : (
                <p className="text-xl opacity-50 text-[var(--pres-text-secondary)]">
                  Voting in progress...
                </p>
              )}
            </div>
          ) : currentItem?.item_type === 'slide' && currentItem.slide_image_path ? (
            <SlideDisplay
              imagePath={currentItem.slide_image_path}
              caption={currentItem.slide_caption}
            />
          ) : currentItem?.item_type === 'batch' && currentItem.batch_id ? (
            (() => {
              const currentBatch = batches.find((b) => b.id === currentItem.batch_id);
              const showCover = currentBatch?.cover_image_path && revealedQuestions.size === 0;
              const showVotingScreen = batchVotingActive && revealedQuestions.size === 0 && !showCover;
              return (
                <AnimatePresence mode="wait">
                  {showCover ? (
                    <motion.div
                      key="batch-cover"
                      initial={coverMatchesPrevSlide ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full"
                    >
                      <SlideDisplay imagePath={currentBatch!.cover_image_path!} caption={null} />
                    </motion.div>
                  ) : showVotingScreen ? (
                    <motion.div
                      key="batch-voting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full flex flex-col items-center justify-center text-center px-8"
                    >
                      <h2 className="text-5xl font-bold text-[var(--pres-text)] leading-tight mb-4">
                        {currentBatch?.name ?? 'Untitled Batch'}
                      </h2>
                      <p className="text-2xl text-[var(--pres-text-secondary)] opacity-70">Voting in progress...</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="batch-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full"
                    >
                      <BatchResultsProjection
                        batchId={currentItem.batch_id!}
                        batchName={currentBatch?.name ?? 'Untitled Batch'}
                        questions={useSessionStore.getState().questions}
                        sessionVotes={sessionVotes}
                        revealedQuestions={revealedQuestions}
                        highlightedReason={highlightedReason}
                        selectedQuestionId={selectedQuestionId}
                        moderatedVoteIds={moderatedVoteIds}
                        reasonsPerPage={reasonsPerPage}
                        teamFilter={selectedTeam}
                        theme={theme}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-2xl text-[var(--pres-text-secondary)]">Waiting for presentation to start...</p>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* QR overlay — team grid when fullscreen + teams, otherwise regular overlay */}
      {qrMode === 'fullscreen' && session?.teams && session.teams.length > 0 ? (
        <div className="fixed inset-0 z-[100]">
          <TeamQRGrid
            sessionId={realSessionId!}
            teams={session.teams}
            onClose={() => {}}
            participantUrl={sessionUrl}
            linkCopied={linkCopied}
            onCopyLink={() => {
              navigator.clipboard.writeText(sessionUrl);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
          />
        </div>
      ) : (
        <QROverlay mode={qrMode} sessionUrl={sessionUrl} />
      )}

      {/* Black screen overlay */}
      <AnimatePresence>
        {blackScreenActive && (
          <motion.div
            className="fixed inset-0 bg-black z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Keyboard shortcut help overlay */}
      <KeyboardShortcutHelp
        visible={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />

      {/* Reconnecting indicator */}
      {connectionStatus === 'reconnecting' && (
        <div className="fixed top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm animate-pulse z-50">
          Reconnecting...
        </div>
      )}

      {/* First-time fullscreen hint */}
      <AnimatePresence>
        {showFullscreenHint && (
          <motion.div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 text-[var(--pres-text-secondary)] text-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            Press F for fullscreen
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
