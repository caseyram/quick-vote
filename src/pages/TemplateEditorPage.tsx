import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useTemplateEditorStore } from '../stores/template-editor-store';
import type { SessionTemplate } from '../types/database';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorSidebar } from '../components/editor/EditorSidebar';
import { EditorMainArea } from '../components/editor/EditorMainArea';
import { PreviewMode } from '../components/editor/PreviewMode';

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { reset, loadFromBlueprint, isDirty } = useTemplateEditorStore();

  // Read mode from URL search params
  const mode = searchParams.get('mode') || 'edit';

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

        // Check if loading from template (copy mode)
        const isFromTemplate = searchParams.get('from') === 'template';

        if (isFromTemplate) {
          // Load as a copy (no template ID, so it saves as new)
          loadFromBlueprint(null, `${template.name} (Copy)`, template.blueprint);
          // Clear the from parameter after loading
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('from');
          window.history.replaceState({}, '', `${window.location.pathname}?${newParams}`);
        } else {
          // Load for editing (preserves template ID)
          loadFromBlueprint(template.id, template.name, template.blueprint);
        }
      } catch (err) {
        console.error('Failed to load template:', err);
        // TODO: Show error UI
        reset();
      }
    }

    loadTemplate();
  }, [id, reset, loadFromBlueprint, searchParams]);

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
        {mode === 'preview' ? (
          <PreviewMode />
        ) : (
          <>
            <EditorSidebar />
            <EditorMainArea />
          </>
        )}
      </div>
    </div>
  );
}
