import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { PastSessions } from '../components/PastSessions';
import { ThemeToggle } from '../components/ThemeToggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CreateFromTemplateDialog } from '../components/CreateFromTemplateDialog';
import { useSessionTemplateStore } from '../stores/session-template-store';
import { fetchSessionTemplates, renameSessionTemplate, deleteSessionTemplate, archiveSessionTemplate, unarchiveSessionTemplate } from '../lib/session-template-api';
import type { SessionTemplate } from '../types/database';

export default function Home() {
  const navigate = useNavigate();
  const [error] = useState<string | null>(null);
  const { templates } = useSessionTemplateStore();

  // Template management state
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameTemplateValue, setRenameTemplateValue] = useState('');
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [launchTemplate, setLaunchTemplate] = useState<SessionTemplate | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem('qv-sidebar-width');
    return stored ? parseInt(stored, 10) : 280;
  });
  const resizingRef = useRef(false);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const newWidth = Math.max(200, Math.min(500, e.clientX));
    setSidebarWidth(newWidth);
  }, []);

  const handleResizeUp = useCallback(() => {
    resizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('qv-sidebar-width', String(sidebarWidth));
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
  }, [sidebarWidth, handleResizeMove]);

  const handleResizeDown = useCallback(() => {
    resizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [handleResizeMove, handleResizeUp]);

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
            className="border-r border-[var(--border-primary)] bg-[var(--bg-surface)] relative"
            style={{
              width: sidebarWidth,
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

            {error && <p className="text-red-400 text-xs px-1">{error}</p>}

            {/* Templates list */}
            {templates.length > 0 && (() => {
              const activeTemplates = templates.filter(t => !t.archived);
              const archivedTemplates = templates.filter(t => t.archived);
              return (
              <div className="space-y-1.5 flex-1 overflow-y-auto">
                {activeTemplates.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest px-1">
                      Templates
                    </p>
                    <div className="space-y-0.5">
                      {activeTemplates.map((template) => (
                        <TemplateRow
                          key={template.id}
                          template={template}
                          renamingTemplateId={renamingTemplateId}
                          renameTemplateValue={renameTemplateValue}
                          setRenameTemplateValue={setRenameTemplateValue}
                          onRename={handleRenameTemplate}
                          onCancelRename={() => setRenamingTemplateId(null)}
                          onStartRename={() => {
                            setRenamingTemplateId(template.id);
                            setRenameTemplateValue(template.name);
                          }}
                          onLaunch={() => setLaunchTemplate(template)}
                          onEdit={() => navigate(`/templates/${template.id}/edit?from=template`)}
                          onDelete={() => setDeleteTemplateTarget({ id: template.id, name: template.name })}
                          onArchive={() => archiveSessionTemplate(template.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {archivedTemplates.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest px-1 cursor-pointer select-none hover:text-[var(--text-secondary)] transition-colors">
                      Archived ({archivedTemplates.length})
                    </summary>
                    <div className="space-y-0.5 mt-1">
                      {archivedTemplates.map((template) => (
                        <TemplateRow
                          key={template.id}
                          template={template}
                          renamingTemplateId={renamingTemplateId}
                          renameTemplateValue={renameTemplateValue}
                          setRenameTemplateValue={setRenameTemplateValue}
                          onRename={handleRenameTemplate}
                          onCancelRename={() => setRenamingTemplateId(null)}
                          onStartRename={() => {
                            setRenamingTemplateId(template.id);
                            setRenameTemplateValue(template.name);
                          }}
                          onLaunch={() => setLaunchTemplate(template)}
                          onEdit={() => navigate(`/templates/${template.id}/edit?from=template`)}
                          onDelete={() => setDeleteTemplateTarget({ id: template.id, name: template.name })}
                          onUnarchive={() => unarchiveSessionTemplate(template.id)}
                          archived
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
              );
            })()}
            {/* Resize handle */}
            <div
              onMouseDown={handleResizeDown}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors"
            />
          </aside>

          {/* ── Right panel ─────────────────────────────────────── */}
          <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PastSessions refreshKey={sessionsRefreshKey} />
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
      <CreateFromTemplateDialog
        isOpen={launchTemplate !== null}
        template={launchTemplate}
        onClose={() => setLaunchTemplate(null)}
        onCreated={() => setSessionsRefreshKey((k) => k + 1)}
      />
    </AdminPasswordGate>
  );
}

function TemplateRow({
  template,
  renamingTemplateId,
  renameTemplateValue,
  setRenameTemplateValue,
  onRename,
  onCancelRename,
  onStartRename,
  onLaunch,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  archived,
}: {
  template: SessionTemplate;
  renamingTemplateId: string | null;
  renameTemplateValue: string;
  setRenameTemplateValue: (v: string) => void;
  onRename: (id: string) => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  archived?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 group rounded-lg">
      {renamingTemplateId === template.id ? (
        <input
          autoFocus
          value={renameTemplateValue}
          onChange={(e) => setRenameTemplateValue(e.target.value)}
          onBlur={() => onRename(template.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename(template.id);
            if (e.key === 'Escape') onCancelRename();
          }}
          className="flex-1 text-sm font-medium rounded-lg px-3 py-2 border bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
        />
      ) : (
        <button
          onClick={onLaunch}
          className="flex-1 text-left px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-elevated)] min-w-0"
        >
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {template.name}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {template.item_count}{' '}
            {template.item_count === 1 ? 'item' : 'items'}
          </div>
        </button>
      )}
      {/* Edit template */}
      <button
        onClick={onEdit}
        className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 shrink-0"
        title="Edit template"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      </button>
      {/* Rename */}
      <button
        onClick={onStartRename}
        className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 shrink-0"
        title="Rename template"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      </button>
      {/* Archive / Unarchive */}
      {archived ? (
        <button
          onClick={onUnarchive}
          className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-emerald-500 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 shrink-0"
          title="Unarchive template"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3-3m0 0l3 3m-3-3v12" />
          </svg>
        </button>
      ) : (
        <button
          onClick={onArchive}
          className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 shrink-0"
          title="Archive template"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      )}
      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 shrink-0"
        title="Delete template"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
