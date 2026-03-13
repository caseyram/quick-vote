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
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
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

      // Sync active state from DB so projection picks up current item on mount
      // (handles case where projection opens after admin already activated something)
      if (!cancelled) {
        // Check for active batch
        const { data: activeBatch } = await supabase
          .from('batches')
          .select('*')
          .eq('session_id', realSessionId!)
          .eq('status', 'active')
          .maybeSingle();

        if (activeBatch && !cancelled) {
          useSessionStore.getState().setActiveBatchId(activeBatch.id);
          setBatchVotingActive(true);
          const batchItem = itemsData?.find(
            (item: any) => item.item_type === 'batch' && item.batch_id === activeBatch.id
          );
          if (batchItem) {
            useSessionStore.getState().setActiveSessionItemId(batchItem.id);
          }
        }

        // Check for active inline question (Go Live quick question)
        if (!activeBatch) {
          const { data: activeQ } = await supabase
            .from('questions')
            .select('*')
            .eq('session_id', realSessionId!)
            .eq('status', 'active')
            .maybeSingle();

          if (activeQ && !cancelled) {
            setActiveInlineQuestion(activeQ);
            setInlineVotingClosed(false);
          }
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

    // Listen for batch activations
    channel.on('broadcast', { event: 'batch_activated' }, async ({ payload }: any) => {
      setRevealedQuestions(new Set());
      setHighlightedReason(null);
      setSelectedQuestionId(null);
      setActiveInlineQuestion(null); // Clear any inline question
      setBatchVotingActive(true);

      useSessionStore.getState().setActiveBatchId(payload.batchId);
      // Find the corresponding session_item for this batch
      const items = useSessionStore.getState().sessionItems;
      let batchItem = items.find(
        (item) => item.item_type === 'batch' && item.batch_id === payload.batchId
      );

      // If session_item not found locally (e.g. Go Live created a new batch),
      // re-fetch session_items, batches, and questions from DB
      if (!batchItem && realSessionId) {
        const [itemsRes, batchesRes, questionsRes] = await Promise.all([
          supabase.from('session_items').select('*').eq('session_id', realSessionId!).order('position', { ascending: true }),
          supabase.from('batches').select('*').eq('session_id', realSessionId!).order('position', { ascending: true }),
          supabase.from('questions').select('*').eq('session_id', realSessionId!).order('position', { ascending: true }),
        ]);
        if (itemsRes.data) useSessionStore.getState().setSessionItems(itemsRes.data);
        if (batchesRes.data) useSessionStore.getState().setBatches(batchesRes.data);
        if (questionsRes.data) useSessionStore.getState().setQuestions(questionsRes.data);

        // Re-search for the session_item
        const freshItems = useSessionStore.getState().sessionItems;
        batchItem = freshItems.find(
          (item) => item.item_type === 'batch' && item.batch_id === payload.batchId
        );
      }

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

    // Listen for result reveal
    channel.on('broadcast', { event: 'result_reveal' }, ({ payload }: any) => {
      setRevealedQuestions((prev) => {
        const next = new Set(prev);
        if (payload.revealed) {
          next.add(payload.questionId);
        } else {
          next.delete(payload.questionId);
        }
        return next;
      });
    });

    // Listen for reason highlight
    channel.on('broadcast', { event: 'reason_highlight' }, ({ payload }: any) => {
      setHighlightedReason(
        payload.reasonId ? { questionId: payload.questionId, reasonId: payload.reasonId } : null
      );
    });

    // Listen for question tab selection from admin
    channel.on('broadcast', { event: 'question_selected' }, ({ payload }: any) => {
      setSelectedQuestionId(payload.questionId);
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
  }, [setTheme]);

  const { connectionStatus } = useRealtimeChannel(
    realSessionId ? `session:${realSessionId}` : '',
    setupChannel,
    !!realSessionId
  );

  // Refetch state on reconnect
  useEffect(() => {
    if (
      prevConnectionStatus.current === 'reconnecting' &&
      connectionStatus === 'connected' &&
      realSessionId
    ) {
      // Re-fetch current session state to ensure sync
      supabase
        .from('sessions')
        .select('*')
        .eq('session_id', realSessionId!)
        .single()
        .then(({ data }) => {
          if (data) {
            setSession(data);
          }
        });
    }
    prevConnectionStatus.current = connectionStatus;
  }, [connectionStatus, realSessionId, setSession]);

  // Subscribe to session status and teams from store
  const sessionStatus = useSessionStore((s) => s.session?.status);
  const session = useSessionStore((s) => s.session);

  // Poll votes every 3 seconds when session is active
  useEffect(() => {
    if (!realSessionId || (sessionStatus !== 'active' && sessionStatus !== 'lobby')) return;

    async function pollVotes() {
      const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', realSessionId!);

      if (data) {
        const votesByQuestion: Record<string, Vote[]> = {};
        data.forEach((vote) => {
          if (!votesByQuestion[vote.question_id]) {
            votesByQuestion[vote.question_id] = [];
          }
          votesByQuestion[vote.question_id].push(vote);
        });
        setSessionVotes(votesByQuestion);

        // Sync moderated IDs from DB (handles page reload case)
        const dbModeratedIds = new Set<string>();
        data.forEach((vote) => {
          if (vote.moderated_at) dbModeratedIds.add(vote.id);
        });
        setModeratedVoteIds((prev) => {
          // Merge: keep broadcast-applied removes, add any DB-sourced moderations
          // Strategy: rebuild from DB truth on each poll (broadcast updates are immediate)
          const next = new Set(prev);
          for (const id of dbModeratedIds) next.add(id);
          return next;
        });
      }
    }

    // Initial poll
    pollVotes();

    // Poll every 3 seconds
    const interval = setInterval(pollVotes, 3000);

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
