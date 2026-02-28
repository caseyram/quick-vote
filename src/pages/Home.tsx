import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { PastSessions } from '../components/PastSessions';
import { ThemeToggle } from '../components/ThemeToggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSessionTemplateStore } from '../stores/session-template-store';
import { fetchSessionTemplates, renameSessionTemplate, deleteSessionTemplate } from '../lib/session-template-api';

export default function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const { templates } = useSessionTemplateStore();

  // Template management state
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameTemplateValue, setRenameTemplateValue] = useState('');
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  async function handleRenameTemplate(templateId: string) {
    const trimmed = renameTemplateValue.trim();
    if (!trimmed) { setRenamingTemplateId(null); return; }
    try {
      await renameSessionTemplate(templateId, trimmed);
    } catch (err) {
      console.error('Failed to rename template:', err);
    }
    setRenamingTemplateId(null);
  }

  async function handleDeleteTemplate() {
    if (!deleteTemplateTarget) return;
    setDeletingTemplate(true);
    try {
      await deleteSessionTemplate(deleteTemplateTarget.id);
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setDeletingTemplate(false);
      setDeleteTemplateTarget(null);
    }
  }

  useEffect(() => {
    fetchSessionTemplates().catch((err) => {
      console.error('Failed to fetch templates:', err);
    });
  }, []);

  async function handleCreateSession() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setCreating(true);
    setError(null);

    try {
      const sessionId = nanoid();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Authentication failed. Please refresh and try again.');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({
          session_id: sessionId,
          title: title.trim() || 'Untitled Session',
          created_by: user.id,
          reasons_enabled: true,
        })
        .select('admin_token')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      navigate(`/admin/${data.admin_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
      submittingRef.current = false;
    }
  }

  return (
    <AdminPasswordGate>
      <div
        className="bg-[var(--bg-primary)] text-[var(--text-primary)]"
        style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-surface)]">
          <h1 className="text-lg font-bold tracking-tight">QuickVote</h1>
          <ThemeToggle />
        </header>

        {/* ── Two-panel body ──────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── Left panel ──────────────────────────────────────── */}
          <aside
            className="border-r border-[var(--border-primary)] bg-[var(--bg-surface)]"
            style={{
              width: 280,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '16px 12px',
              gap: 20,
            }}
          >
            {/* Tagline */}
            <p className="text-xs text-[var(--text-muted)] px-1">
              Create a live voting session in seconds
            </p>

            {/* Primary: New Session via Template Editor */}
            <button
              onClick={() => navigate('/templates/new')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              New Session
            </button>

            {/* Quick Session */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest px-1">
                Quick Session
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Session title (optional)"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-placeholder)]"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSession();
                }}
              />
              <button
                onClick={handleCreateSession}
                disabled={creating}
                className="w-full py-2 px-4 text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed bg-[var(--bg-elevated)] hover:bg-[var(--bg-primary)] disabled:opacity-70 text-[var(--text-primary)] border border-[var(--border-primary)]"
              >
                {creating ? 'Creating...' : 'Create Session'}
              </button>
              {error && <p className="text-red-400 text-xs px-1">{error}</p>}
            </div>

            {/* Templates list */}
            {templates.length > 0 && (
              <div className="space-y-1.5 flex-1">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest px-1">
                  Templates
                </p>
                <div className="space-y-0.5">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-center gap-1 group rounded-lg">
                      {renamingTemplateId === template.id ? (
                        <input
                          autoFocus
                          value={renameTemplateValue}
                          onChange={(e) => setRenameTemplateValue(e.target.value)}
                          onBlur={() => handleRenameTemplate(template.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTemplate(template.id);
                            if (e.key === 'Escape') setRenamingTemplateId(null);
                          }}
                          className="flex-1 text-sm font-medium rounded-lg px-3 py-2 border bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            navigate(`/templates/${template.id}/edit?from=template`)
                          }
                          className="flex-1 text-left px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-elevated)] min-w-0"
                        >
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {template.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {template.item_count}{' '}
                            {template.item_count === 1 ? 'item' : 'items'}
                          </div>
                        </button>
                      )}
                      {/* Rename */}
                      <button
                        onClick={() => {
                          setRenamingTemplateId(template.id);
                          setRenameTemplateValue(template.name);
                        }}
                        className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 shrink-0"
                        title="Rename template"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTemplateTarget({ id: template.id, name: template.name })}
                        className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 shrink-0"
                        title="Delete template"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Right panel ─────────────────────────────────────── */}
          <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PastSessions />
          </main>
        </div>
      </div>
      <ConfirmDialog
        isOpen={deleteTemplateTarget !== null}
        onConfirm={handleDeleteTemplate}
        onCancel={() => setDeleteTemplateTarget(null)}
        title="Delete Template"
        message={`Delete "${deleteTemplateTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingTemplate}
      />
    </AdminPasswordGate>
  );
}
