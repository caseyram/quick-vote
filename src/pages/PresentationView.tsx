import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useRealtimeChannel } from '../hooks/use-realtime-channel';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SlideDisplay } from '../components/SlideDisplay';

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
    });

    // Listen for batch activations
    channel.on('broadcast', { event: 'batch_activated' }, ({ payload }: any) => {
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

  // Keyboard shortcuts for fullscreen
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      if (event.key === 'f' || event.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen();
        }
      } else if (event.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Find current active item
  const currentItem = activeSessionItemId
    ? sessionItems.find((item) => item.id === activeSessionItemId)
    : null;

  // Animation variants (matching AdminSession patterns)
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

  const crossfadeVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const isSlideActive = currentItem?.item_type === 'slide';

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
      {/* Reconnecting indicator */}
      {connectionStatus === 'reconnecting' && (
        <div className="fixed top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm animate-pulse z-50">
          Reconnecting...
        </div>
      )}

      {/* Main projection content */}
      <AnimatePresence mode="wait" custom={navigationDirection}>
        <motion.div
          key={activeSessionItemId ?? 'none'}
          custom={navigationDirection}
          variants={isSlideActive ? slideVariants : crossfadeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            isSlideActive
              ? { x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }
              : { duration: 0.35, ease: 'easeInOut' }
          }
          className="w-full h-full"
        >
          {currentItem?.item_type === 'slide' && currentItem.slide_image_path ? (
            <SlideDisplay
              imagePath={currentItem.slide_image_path}
              caption={currentItem.slide_caption}
            />
          ) : currentItem?.item_type === 'batch' && currentItem.batch_id ? (
            (() => {
              const batch = batches.find((b) => b.id === currentItem.batch_id);
              const questions = useSessionStore.getState().questions;
              const questionCount = questions.filter((q) => q.batch_id === currentItem.batch_id)
                .length;

              return (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <p className="text-2xl text-gray-400 mb-4">Batch Voting</p>
                  <h2 className="text-5xl font-bold text-white leading-tight">
                    {batch?.name ?? 'Untitled Batch'}
                  </h2>
                  <p className="text-2xl text-gray-400 mt-4">
                    {questionCount} Question{questionCount !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-2xl text-gray-500">Waiting for presentation to start...</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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
