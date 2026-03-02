import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useBlocker } from 'react-router';
import { supabase } from '../lib/supabase';
import { useTemplateEditorStore } from '../stores/template-editor-store';
import type { SessionTemplate } from '../types/database';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorSidebar } from '../components/editor/EditorSidebar';
import { EditorMainArea } from '../components/editor/EditorMainArea';
import { SessionPreviewOverlay } from '../components/editor/SessionPreviewOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { reset, loadFromBlueprint, isDirty } = useTemplateEditorStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);

  const blocker = useBlocker(isDirty);

  // Only load template on mount or when the template ID changes
  // Do NOT depend on searchParams — mode/from changes should not re-trigger loading
  const fromTemplate = searchParams.get('from') === 'template';

  const handleOpenPreview = (startIndex: number) => {
    setPreviewStartIndex(startIndex);
    setPreviewOpen(true);
  };

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

        if (fromTemplate) {
          // Load as a copy (no template ID, so it saves as new)
          loadFromBlueprint(null, template.name, template.blueprint);
          // Clear the from parameter after loading
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          // Load for editing (preserves template ID)
          loadFromBlueprint(template.id, template.name, template.blueprint);
        }
      } catch (err) {
        console.error('Failed to load template:', err);
        reset();
      }
    }

    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    <div className="h-screen flex flex-col bg-gray-50">
      <EditorToolbar onOpenPreview={handleOpenPreview} />
      <div className="flex flex-1 overflow-hidden">
        <EditorSidebar />
        <EditorMainArea />
      </div>
      <SessionPreviewOverlay
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        startIndex={previewStartIndex}
      />
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          isOpen={true}
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
          title="Unsaved Changes"
          message="You have unsaved changes. Leave without saving?"
          confirmLabel="Leave"
          confirmVariant="danger"
        />
      )}
    </div>
  );
}
