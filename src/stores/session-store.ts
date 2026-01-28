import { create } from 'zustand';
import type { Session, Question, Vote, Batch } from '../types/database';
import type { ConnectionStatus } from '../hooks/use-realtime-channel';

interface SessionState {
  session: Session | null;
  questions: Question[];
  batches: Batch[];
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
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Voting state
  currentVote: Vote | null;
  questionVotes: Vote[];
  submitting: boolean;

  setCurrentVote: (vote: Vote | null) => void;
  setQuestionVotes: (votes: Vote[]) => void;
  setSubmitting: (submitting: boolean) => void;

  // Realtime state
  participantCount: number;
  connectionStatus: ConnectionStatus;
  activeQuestionId: string | null;
  timerEndTime: number | null;
  activeBatchId: string | null;

  setParticipantCount: (count: number) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setActiveQuestionId: (id: string | null) => void;
  setTimerEndTime: (endTime: number | null) => void;
  setActiveBatchId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  questions: [],
  batches: [],
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
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      session: null,
      questions: [],
      batches: [],
      loading: false,
      error: null,
      currentVote: null,
      questionVotes: [],
      submitting: false,
      participantCount: 0,
      connectionStatus: 'connecting',
      activeQuestionId: null,
      timerEndTime: null,
      activeBatchId: null,
    }),

  // Voting state
  currentVote: null,
  questionVotes: [],
  submitting: false,

  setCurrentVote: (vote) => set({ currentVote: vote }),
  setQuestionVotes: (votes) => set({ questionVotes: votes }),
  setSubmitting: (submitting) => set({ submitting }),

  // Realtime state
  participantCount: 0,
  connectionStatus: 'connecting',
  activeQuestionId: null,
  timerEndTime: null,
  activeBatchId: null,

  setParticipantCount: (count) => set({ participantCount: count }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveQuestionId: (id) => set({ activeQuestionId: id }),
  setTimerEndTime: (endTime) => set({ timerEndTime: endTime }),
  setActiveBatchId: (id) => set({ activeBatchId: id }),
}));
