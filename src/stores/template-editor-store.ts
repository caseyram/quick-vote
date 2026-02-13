import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { SessionBlueprint, SessionBlueprintItem, VoteType } from '../types/database';

export interface EditorQuestion {
  id: string;
  text: string;
  type: VoteType;
  options: string[] | null;
  timer_duration: number | null;
  template_id: string | null;
}

export interface EditorItem {
  id: string;
  item_type: 'batch' | 'slide';
  batch?: {
    name: string;
    questions: EditorQuestion[];
    timer_duration: number | null;
    template_id: string | null;
  };
  slide?: {
    image_path: string;
    caption: string | null;
  };
}

interface TemplateEditorState {
  templateId: string | null;
  templateName: string;
  globalTemplateId: string | null;
  items: EditorItem[];
  selectedItemId: string | null;
  isDirty: boolean;
  saving: boolean;
  loading: boolean;

  setGlobalTemplateId: (id: string | null) => void;
  setTemplateName: (name: string) => void;
  setItems: (items: EditorItem[]) => void;
  addItem: (item: EditorItem, afterItemId: string | null) => void;
  removeItem: (id: string) => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  selectItem: (id: string | null) => void;
  markClean: () => void;
  markDirty: () => void;
  setSaving: (saving: boolean) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  loadFromBlueprint: (templateId: string | null, name: string, blueprint: SessionBlueprint) => void;
  toBlueprint: () => SessionBlueprint;
}

export const useTemplateEditorStore = create<TemplateEditorState>()((set, get) => ({
  templateId: null,
  templateName: 'Untitled Template',
  globalTemplateId: null,
  items: [],
  selectedItemId: null,
  isDirty: false,
  saving: false,
  loading: false,

  setGlobalTemplateId: (id) =>
    set({ globalTemplateId: id, isDirty: true }),

  setTemplateName: (name) =>
    set({
      templateName: name,
      isDirty: true,
    }),

  setItems: (items) =>
    set({ items }),

  addItem: (item, afterItemId) =>
    set((state) => {
      // Auto-inherit globalTemplateId for new batch items
      const finalItem = item.item_type === 'batch' && item.batch && state.globalTemplateId && !item.batch.template_id
        ? { ...item, batch: { ...item.batch, template_id: state.globalTemplateId } }
        : item;

      let newItems: EditorItem[];

      if (afterItemId === null) {
        // Add at end
        newItems = [...state.items, finalItem];
      } else {
        // Insert after specified item
        const afterIndex = state.items.findIndex((i) => i.id === afterItemId);
        if (afterIndex === -1) {
          // If item not found, add at end
          newItems = [...state.items, finalItem];
        } else {
          newItems = [
            ...state.items.slice(0, afterIndex + 1),
            finalItem,
            ...state.items.slice(afterIndex + 1),
          ];
        }
      }

      return {
        items: newItems,
        selectedItemId: item.id,
        isDirty: true,
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const index = state.items.findIndex((i) => i.id === id);
      if (index === -1) return state;

      const newItems = state.items.filter((i) => i.id !== id);

      // Select adjacent item
      let newSelectedId: string | null = null;
      if (state.selectedItemId === id && newItems.length > 0) {
        // Select next item, or previous if we deleted the last item
        const adjacentIndex = index < newItems.length ? index : index - 1;
        newSelectedId = newItems[adjacentIndex]?.id ?? null;
      } else {
        newSelectedId = state.selectedItemId;
      }

      return {
        items: newItems,
        selectedItemId: newSelectedId,
        isDirty: true,
      };
    }),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const newItems = [...state.items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);

      return {
        items: newItems,
        isDirty: true,
      };
    }),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
      isDirty: true,
    })),

  selectItem: (id) =>
    set({ selectedItemId: id }),

  markClean: () =>
    set({ isDirty: false }),

  markDirty: () =>
    set({ isDirty: true }),

  setSaving: (saving) =>
    set({ saving }),

  setLoading: (loading) =>
    set({ loading }),

  reset: () =>
    set({
      templateId: null,
      templateName: 'Untitled Template',
      globalTemplateId: null,
      items: [],
      selectedItemId: null,
      isDirty: false,
      saving: false,
      loading: false,
    }),

  loadFromBlueprint: (templateId, name, blueprint) => {
    const editorItems: EditorItem[] = blueprint.sessionItems.map((blueprintItem) => {
      const itemId = nanoid();

      if (blueprintItem.item_type === 'batch' && blueprintItem.batch) {
        return {
          id: itemId,
          item_type: 'batch' as const,
          batch: {
            name: blueprintItem.batch.name,
            timer_duration: blueprintItem.batch.timer_duration || null,
            template_id: blueprintItem.batch.template_id ?? null,
            questions: blueprintItem.batch.questions.map((q) => ({
              id: nanoid(),
              text: q.text,
              type: q.type,
              options: q.options,
              timer_duration: null, // Not in blueprint yet
              template_id: q.template_id,
            })),
          },
        };
      } else if (blueprintItem.item_type === 'slide' && blueprintItem.slide) {
        return {
          id: itemId,
          item_type: 'slide' as const,
          slide: {
            image_path: blueprintItem.slide.image_path,
            caption: blueprintItem.slide.caption,
          },
        };
      }

      // Fallback (shouldn't happen)
      return {
        id: itemId,
        item_type: 'batch' as const,
        batch: {
          name: 'Untitled Question Set',
          questions: [],
          timer_duration: null,
          template_id: null,
        },
      };
    });

    set({
      templateId,
      templateName: name,
      globalTemplateId: blueprint.globalTemplateId ?? null,
      items: editorItems,
      selectedItemId: editorItems[0]?.id ?? null,
      isDirty: false,
      loading: false,
    });
  },

  toBlueprint: () => {
    const state = get();

    const blueprintItems: SessionBlueprintItem[] = state.items.map((item, index) => {
      if (item.item_type === 'batch' && item.batch) {
        return {
          item_type: 'batch' as const,
          position: index,
          batch: {
            name: item.batch.name,
            timer_duration: item.batch.timer_duration || null,
            template_id: item.batch.template_id ?? null,
            questions: item.batch.questions.map((q, qIndex) => ({
              text: q.text,
              type: q.type,
              options: q.options,
              anonymous: true,
              position: qIndex,
              template_id: q.template_id,
            })),
          },
        };
      } else if (item.item_type === 'slide' && item.slide) {
        return {
          item_type: 'slide' as const,
          position: index,
          slide: {
            image_path: item.slide.image_path,
            caption: item.slide.caption,
          },
        };
      }

      // Fallback (shouldn't happen)
      return {
        item_type: 'batch' as const,
        position: index,
        batch: {
          name: 'Untitled Question Set',
          timer_duration: null,
          template_id: null,
          questions: [],
        },
      };
    });

    return {
      version: 1 as const,
      globalTemplateId: state.globalTemplateId ?? null,
      sessionItems: blueprintItems,
    };
  },
}));
