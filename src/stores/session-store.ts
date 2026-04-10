import { create } from 'zustand';
import type { Session, Question, Vote, Batch, SessionItem } from '../types/database';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';
import { supabase } from '../lib/supabase';

interface SessionState {
  session: Session | null;
  questions: Question[];
  batches: Batch[];
  sessionItems: SessionItem[];
  loading: boolean;
  error: string | null;

  setSession: (session: Session | null) => void;
  setQuestions: (questions: Question[]) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (orderedIds: string[]) => void;
  setBatches: (batches: Batch[]) => void;
  addBatch: (batch: Batch) => void;
  updateBatch: (id: string, updates: Partial<Batch>) => void;
  removeBatch: (id: string) => void;
  setSessionItems: (items: SessionItem[]) => void;
  addSessionItem: (item: SessionItem) => void;
  removeSessionItem: (id: string) => void;
  updateSessionItemPositions: (updates: { id: string; position: number }[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  setSessionDefaultTemplate: (templateId: string | null) => Promise<void>;

  // Voting state
  currentVote: Vote | null;
  questionVotes: Vote[];
  submitting: boolean;

  setCurrentVote: (vote: Vote | null) => void;
  setQuestionVotes: (votes: Vote[]) => void;
  setSubmitting: (submitting: boolean) => void;

  // Session-wide vote state (single source of truth for admin, presenter, monitor)
  votesByQuestion: Record<string, Vote[]>;
  setAllVotes: (votes: Vote[]) => void;
  upsertVote: (vote: Vote) => void;
  removeVote: (voteId: string, questionId: string) => void;
  clearVotes: () => void;

  // Realtime state
  participantCount: number;
  connectionStatus: ConnectionStatus;
  activeQuestionId: string | null;
  timerEndTime: number | null;
  activeBatchId: string | null;
  batchQuestions: Question[];
  activeSessionItemId: string | null;
  navigationDirection: 'forward' | 'backward' | null;

  setParticipantCount: (count: number) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setActiveQuestionId: (id: string | null) => void;
  setTimerEndTime: (endTime: number | null) => void;
  setActiveBatchId: (id: string | null) => void;
  setBatchQuestions: (questions: Question[]) => void;
  setActiveSessionItemId: (id: string | null) => void;
  setNavigationDirection: (dir: 'forward' | 'backward' | null) => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  questions: [],
  batches: [],
  sessionItems: [],
  loading: false,
  error: null,

  setSession: (session) => set({ session }),
  setQuestions: (questions) =>
    set({ questions: [...questions].sort((a, b) => a.position - b.position) }),
  addQuestion: (question) =>
    set((state) => ({
      questions: [...state.questions, question].sort((a, b) => a.position - b.position),
    })),
  updateQuestion: (id, updates) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    })),
  removeQuestion: (id) =>
    set((state) => ({
      questions: state.questions.filter((q) => q.id !== id),
    })),
  reorderQuestions: (orderedIds) =>
    set((state) => ({
      questions: orderedIds
        .map((id, index) => {
          const q = state.questions.find((question) => question.id === id);
          return q ? { ...q, position: index } : null;
        })
        .filter((q): q is Question => q !== null),
    })),
  setBatches: (batches) =>
    set({ batches: [...batches].sort((a, b) => a.position - b.position) }),
  addBatch: (batch) =>
    set((state) => ({
      batches: [...state.batches, batch].sort((a, b) => a.position - b.position),
    })),
  updateBatch: (id, updates) =>
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),
  removeBatch: (id) =>
    set((state) => ({
      batches: state.batches.filter((b) => b.id !== id),
    })),
  setSessionItems: (items) =>
    set({ sessionItems: [...items].sort((a, b) => a.position - b.position) }),
  addSessionItem: (item) =>
    set((state) => ({
      sessionItems: [...state.sessionItems, item].sort((a, b) => a.position - b.position),
    })),
  removeSessionItem: (id) =>
    set((state) => ({
      sessionItems: state.sessionItems.filter((item) => item.id !== id),
    })),
  updateSessionItemPositions: (updates) =>
    set((state) => ({
      sessionItems: state.sessionItems
        .map((item) => {
          const update = updates.find((u) => u.id === item.id);
          return update ? { ...item, position: update.position } : item;
        })
        .sort((a, b) => a.position - b.position),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      session: null,
      questions: [],
      batches: [],
      sessionItems: [],
      loading: false,
      error: null,
      currentVote: null,
      questionVotes: [],
      submitting: false,
      votesByQuestion: {},
      participantCount: 0,
      connectionStatus: 'connecting',
      activeQuestionId: null,
      timerEndTime: null,
      activeBatchId: null,
      batchQuestions: [],
      activeSessionItemId: null,
      navigationDirection: null,
    }),

  // Voting state
  currentVote: null,
  questionVotes: [],
  submitting: false,

  setCurrentVote: (vote) => set({ currentVote: vote }),
  setQuestionVotes: (votes) => set({ questionVotes: votes }),
  setSubmitting: (submitting) => set({ submitting }),

  // Session-wide vote state
  votesByQuestion: {},
  setAllVotes: (votes) => {
    const map: Record<string, Vote[]> = {};
    for (const vote of votes) {
      if (!map[vote.question_id]) map[vote.question_id] = [];
      map[vote.question_id].push(vote);
    }
    set({ votesByQuestion: map });
  },
  upsertVote: (vote) =>
    set((state) => {
      const qId = vote.question_id;
      const existing = state.votesByQuestion[qId] ?? [];
      const idx = existing.findIndex((v) => v.id === vote.id);
      const updated = idx >= 0
        ? existing.map((v) => (v.id === vote.id ? vote : v))
        : [...existing, vote];
      return { votesByQuestion: { ...state.votesByQuestion, [qId]: updated } };
    }),
  removeVote: (voteId, questionId) =>
    set((state) => {
      const existing = state.votesByQuestion[questionId] ?? [];
      return {
        votesByQuestion: {
          ...state.votesByQuestion,
          [questionId]: existing.filter((v) => v.id !== voteId),
        },
      };
    }),
  clearVotes: () => set({ votesByQuestion: {} }),

  // Realtime state
  participantCount: 0,
  connectionStatus: 'connecting',
  activeQuestionId: null,
  timerEndTime: null,
  activeBatchId: null,
  batchQuestions: [],
  activeSessionItemId: null,
  navigationDirection: null,

  setParticipantCount: (count) => set({ participantCount: count }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveQuestionId: (id) => set({ activeQuestionId: id }),
  setTimerEndTime: (endTime) => set({ timerEndTime: endTime }),
  setActiveBatchId: (id) => set({ activeBatchId: id }),
  setBatchQuestions: (questions) => set({ batchQuestions: questions }),
  setActiveSessionItemId: (id) => set({ activeSessionItemId: id }),
  setNavigationDirection: (dir) => set({ navigationDirection: dir }),

  setSessionDefaultTemplate: async (templateId) => {
    const session = get().session;
    if (!session) return;

    const { data, error } = await supabase
      .from('sessions')
      .update({ default_template_id: templateId })
      .eq('session_id', session.session_id)
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      session: state.session ? { ...state.session, ...data } : null,
    }));
  },
}));
