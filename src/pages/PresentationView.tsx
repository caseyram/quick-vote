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
import { getTextColor } from '../lib/color-contrast';

export default function PresentationView() {
  const { sessionId } = useParams();
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
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [sessionVotes, setSessionVotes] = useState<Record<string, Vote[]>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [highlightedReason, setHighlightedReason] = useState<{ questionId: string; reasonId: string } | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [activeInlineQuestion, setActiveInlineQuestion] = useState<Question | null>(null);
  const [inlineVotingClosed, setInlineVotingClosed] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const prevConnectionStatus = useRef<ConnectionStatus>('connecting');

  // Load session data on mount
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadSessionData() {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (cancelled) return;

      if (sessionError || !sessionData) {
        setError(sessionError?.message ?? 'Session not found');
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(sessionData);

      // Fetch batches
      const { data: batchesData } = await supabase
        .from('batches')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (batchesData && !cancelled) {
        setBatches(batchesData);
      }

      // Fetch questions (for batch display context)
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (questionsData && !cancelled) {
        setQuestions(questionsData);
      }

      // Fetch session items
      const { data: itemsData } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', sessionId)
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
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .maybeSingle();

        if (activeBatch && !cancelled) {
          useSessionStore.getState().setActiveBatchId(activeBatch.id);
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
            .eq('session_id', sessionId)
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
  }, [sessionId, setSession, setQuestions, setBatches, setLoading, setError]);

  // Realtime channel setup
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    // Listen for slide activations
    channel.on('broadcast', { event: 'slide_activated' }, ({ payload }: any) => {
      useSessionStore.getState().setActiveSessionItemId(payload.itemId);
      useSessionStore.getState().setNavigationDirection(payload.direction ?? 'forward');
      setActiveInlineQuestion(null); // Clear any inline question
    });

    // Listen for batch activations - also reset reveal state
    channel.on('broadcast', { event: 'batch_activated' }, ({ payload }: any) => {
      setRevealedQuestions(new Set());
      setHighlightedReason(null);
      setSelectedQuestionId(null);
      setActiveInlineQuestion(null); // Clear any inline question

      useSessionStore.getState().setActiveBatchId(payload.batchId);
      // Find the corresponding session_item for this batch
      const items = useSessionStore.getState().sessionItems;
      const batchItem = items.find(
        (item) => item.item_type === 'batch' && item.batch_id === payload.batchId
      );
      if (batchItem) {
        useSessionStore.getState().setActiveSessionItemId(batchItem.id);
      }
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

    channelRef.current = channel;
  }, []);

  const { connectionStatus } = useRealtimeChannel(
    sessionId ? `session:${sessionId}` : '',
    setupChannel,
    !!sessionId
  );

  // Refetch state on reconnect
  useEffect(() => {
    if (
      prevConnectionStatus.current === 'reconnecting' &&
      connectionStatus === 'connected' &&
      sessionId
    ) {
      // Re-fetch current session state to ensure sync
      supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSession(data);
          }
        });
    }
    prevConnectionStatus.current = connectionStatus;
  }, [connectionStatus, sessionId, setSession]);

  // Subscribe to session status from store for vote polling dependency
  const sessionStatus = useSessionStore((s) => s.session?.status);

  // Poll votes every 3 seconds when session is active
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'active') return;

    async function pollVotes() {
      const { data } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId);

      if (data) {
        const votesByQuestion: Record<string, Vote[]> = {};
        data.forEach((vote) => {
          if (!votesByQuestion[vote.question_id]) {
            votesByQuestion[vote.question_id] = [];
          }
          votesByQuestion[vote.question_id].push(vote);
        });
        setSessionVotes(votesByQuestion);
      }
    }

    // Initial poll
    pollVotes();

    // Poll every 3 seconds
    const interval = setInterval(pollVotes, 3000);

    return () => clearInterval(interval);
  }, [sessionId, sessionStatus]);

  // Set page title
  useEffect(() => {
    document.title = 'QuickVote Presentation';
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

  // Background color and text color
  const backgroundColor = '#1a1a2e'; // TODO: Load from session template
  const textMode = getTextColor(backgroundColor);
  const textColorClass = textMode === 'light' ? 'text-white' : 'text-gray-900';

  const sessionUrl = sessionId ? `${window.location.origin}/session/${sessionId}` : '';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center overflow-hidden ${textColorClass}`}
      style={{ backgroundColor }}
    >
      {/* Main projection content */}
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false} custom={navigationDirection}>
          <motion.div
            key={activeSessionItemId ?? 'none'}
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
              <h2 className={`text-4xl font-bold mb-8 text-center ${textColorClass}`}>
                {activeInlineQuestion.text}
              </h2>
              {inlineVotingClosed && sessionVotes[activeInlineQuestion.id] ? (
                (() => {
                  const votes = sessionVotes[activeInlineQuestion.id] || [];
                  const aggregated = aggregateVotes(votes);
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
                      <BarChart data={chartData} totalVotes={votes.length} size="large" backgroundColor={backgroundColor} />
                    </div>
                  );
                })()
              ) : (
                <p className={`text-xl opacity-50 ${textColorClass}`}>
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
              return (
                <AnimatePresence mode="wait">
                  {showCover ? (
                    <motion.div
                      key="batch-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-full"
                    >
                      <SlideDisplay imagePath={currentBatch!.cover_image_path!} caption={null} />
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
                        backgroundColor="#1a1a2e"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-2xl text-gray-500">Waiting for presentation to start...</p>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* QR overlay */}
      <QROverlay mode={qrMode} sessionUrl={sessionUrl} />

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
            className="fixed bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm z-40"
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
