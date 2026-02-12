import { useEffect } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useTemplateEditorStore } from '../stores/template-editor-store';
import type { SessionTemplate } from '../types/database';

// Import editor components (will be created in Task 2)
const EditorToolbar = () => <div className="bg-white border-b border-gray-200 px-4 py-2 h-14">Toolbar</div>;
const EditorSidebar = () => <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-3">Sidebar</div>;
const EditorMainArea = () => <div className="flex-1 overflow-y-auto p-6 bg-gray-50">Main Area</div>;

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { reset, loadFromBlueprint, isDirty } = useTemplateEditorStore();

  useEffect(() => {
    async function loadTemplate() {
      if (!id || id === 'new') {
        // New template - reset to defaults
        reset();
        return;
      }

      // Load existing template
      useTemplateEditorStore.getState().setLoading(true);

      try {
        const { data, error } = await supabase
          .from('session_templates')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        const template = data as SessionTemplate;
        loadFromBlueprint(template.id, template.name, template.blueprint);
      } catch (err) {
        console.error('Failed to load template:', err);
        // TODO: Show error UI
        reset();
      }
    }

    loadTemplate();
  }, [id, reset, loadFromBlueprint]);

  // Warn before unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <EditorToolbar />
      <div className="flex flex-1 overflow-hidden">
        <EditorSidebar />
        <EditorMainArea />
      </div>
    </div>
  );
}
