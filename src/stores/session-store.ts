import { create } from 'zustand';
import type { Session, Question } from '../types/database';

interface SessionState {
  session: Session | null;
  questions: Question[];
  loading: boolean;
  error: string | null;

  setSession: (session: Session | null) => void;
  setQuestions: (questions: Question[]) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (orderedIds: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  questions: [],
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
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ session: null, questions: [], loading: false, error: null }),
}));
