import { create } from 'zustand';
import type { ResponseTemplate } from '../types/database';

interface TemplateState {
  templates: ResponseTemplate[];
  loading: boolean;
  error: string | null;

  setTemplates: (templates: ResponseTemplate[]) => void;
  addTemplate: (template: ResponseTemplate) => void;
  updateTemplate: (id: string, updates: Partial<ResponseTemplate>) => void;
  removeTemplate: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  setTemplates: (templates) =>
    set({ templates: [...templates].sort((a, b) => a.name.localeCompare(b.name)) }),
  addTemplate: (template) =>
    set((state) => ({
      templates: [...state.templates, template].sort((a, b) =>
        a.name.localeCompare(b.name)
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
