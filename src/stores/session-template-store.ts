import { create } from 'zustand';
import type { SessionTemplate } from '../types/database';

interface SessionTemplateState {
  templates: SessionTemplate[];
  loading: boolean;
  error: string | null;

  setTemplates: (templates: SessionTemplate[]) => void;
  addTemplate: (template: SessionTemplate) => void;
  updateTemplate: (id: string, updates: Partial<SessionTemplate>) => void;
  removeTemplate: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionTemplateStore = create<SessionTemplateState>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  setTemplates: (templates) =>
    set({
      templates: [...templates].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    }),
  addTemplate: (template) =>
    set((state) => ({
      templates: [template, ...state.templates].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    })),
  updateTemplate: (id, updates) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
