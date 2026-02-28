import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';

import { supabase } from '../lib/supabase';
import {
  exportSession,
  downloadCSV,
  sessionToCSV,
  generateExportFilename,
} from '../lib/session-export';
import { saveSessionTemplate } from '../lib/session-template-api';
import { ConfirmDialog } from './ConfirmDialog';
import type { Session, Question, Batch, SessionItem, SessionBlueprint, SessionBlueprintItem } from '../types/database';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionRow extends Session {
  question_count: number;
  participant_count: number;
}

interface MonthGroup {
  monthKey: string; // "2026-02"
  label: string; // "February 2026"
  sessions: SessionRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function groupByMonth(sessions: SessionRow[]): MonthGroup[] {
  const map = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = monthKey(s.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([key, rows]) => ({
    monthKey: key,
    label: monthLabel(rows[0].created_at),
    sessions: rows,
  }));
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
  lobby: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  active: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  ended: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

function primaryActionLabel(status: string): string {
  if (status === 'ended') return 'Review';
  if (status === 'draft') return 'Edit';
  return 'Resume';
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Right-panel component: monthly-grouped session list with search + month jump. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PastSessions(_props?: { theme?: 'dark' | 'light' }) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Data state ─────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [exporting, setExporting] = useState<string | null>(null);

  // ── Load sessions ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('sessions')
        .select('*, questions(count), votes(participant_id)')
        .order('created_at', { ascending: false });

      if (data) {
        const rows: SessionRow[] = data.map(
          (row: Session & { questions?: Array<{ count: number }>; votes?: Array<{ participant_id: string }> }) => ({
            ...row,
            question_count:
              Array.isArray(row.questions) && row.questions.length > 0
                ? row.questions[0].count
                : 0,
            participant_count: new Set(
              (row.votes ?? [])
                .filter((v) => v.participant_id !== row.created_by)
                .map((v) => v.participant_id)
            ).size,
            questions: undefined,
            votes: undefined,
          })
        );
        setSessions(rows);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Derived: filtered + grouped ────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    if (!debouncedTerm) return sessions;
    const lower = debouncedTerm.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(lower));
  }, [sessions, debouncedTerm]);

  const monthGroups = useMemo(() => groupByMonth(filteredSessions), [filteredSessions]);

  // ── Month jump ─────────────────────────────────────────────────────────────
  const jumpToMonth = useCallback((key: string) => {
    const container = scrollRef.current;
    const section = sectionRefs.current.get(key);
    if (!container || !section) return;
    const top =
      section.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top, behavior: 'smooth' });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleOpen(session: SessionRow) {
    navigate(`/admin/${session.admin_token}`);
  }

  function handleReview(session: SessionRow) {
    navigate(`/admin/review/${session.session_id}`);
  }

  function handlePrimaryAction(session: SessionRow) {
    if (session.status === 'ended') handleReview(session);
    else handleOpen(session);
  }

  async function handleSaveAsTemplate(session: SessionRow) {
    setActionLoading(session.id);
    try {
      const [questionsResult, batchesResult, itemsResult] = await Promise.all([
        supabase
          .from('questions')
          .select('*')
          .eq('session_id', session.session_id)
          .order('position', { ascending: true }),
        supabase
          .from('batches')
          .select('*')
          .eq('session_id', session.session_id)
          .order('position', { ascending: true }),
        supabase
          .from('session_items')
          .select('*')
          .eq('session_id', session.session_id)
          .order('position', { ascending: true }),
      ]);

      const srcQuestions = (questionsResult.data ?? []) as Question[];
      const srcBatches = (batchesResult.data ?? []) as Batch[];
      const srcItems = (itemsResult.data ?? []) as SessionItem[];

      if (srcQuestions.length === 0 && srcItems.length === 0) {
        setActionLoading(null);
        return;
      }

      // Build blueprint from session data
      const blueprintItems: SessionBlueprintItem[] = srcItems.map((item, index) => {
        if (item.item_type === 'batch' && item.batch_id) {
          const batch = srcBatches.find((b) => b.id === item.batch_id);
          const batchQuestions = srcQuestions
            .filter((q) => q.batch_id === item.batch_id)
            .sort((a, b) => a.position - b.position);

          return {
            item_type: 'batch' as const,
            position: index,
            batch: {
              name: batch?.name ?? 'Question Set',
              timer_duration: null,
              template_id: null,
              cover_image_path: batch?.cover_image_path ?? null,
              questions: batchQuestions.map((q, qi) => ({
                text: q.text,
                type: q.type as 'agree_disagree' | 'multiple_choice',
                options: q.options as string[] | null,
                anonymous: q.anonymous,
                position: qi,
                template_id: q.template_id ?? null,
              })),
            },
          };
        }

        return {
          item_type: 'slide' as const,
          position: index,
          slide: {
            image_path: item.slide_image_path ?? '',
            caption: item.slide_caption ?? null,
            notes: null,
          },
        };
      });

      const blueprint: SessionBlueprint = {
        version: 1,
        sessionItems: blueprintItems,
      };

      const template = await saveSessionTemplate(
        `${session.title} (Template)`,
        blueprint,
        blueprintItems.length
      );

      navigate(`/templates/${template.id}/edit`);
    } catch (err) {
      console.error('Failed to save as template:', err);
      alert(err instanceof Error ? err.message : 'Failed to save as template');
    } finally {
      setActionLoading(null);
    }
  }



  async function handleExportCSV(session: SessionRow) {
    setExporting(session.session_id);
    try {
      const data = await exportSession(session.session_id);
      const csv = sessionToCSV(data);
      downloadCSV(csv, generateExportFilename(session.title, 'csv'));
    } finally {
      setExporting(null);
    }
  }

  function startRename(session: SessionRow) {
    setRenamingId(session.id);
    setRenameValue(session.title);
  }

  async function handleRename(session: SessionRow) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === session.title) {
      setRenamingId(null);
      return;
    }
    const { error } = await supabase.rpc('rename_session_by_admin_token', {
      p_admin_token: session.admin_token,
      p_title: trimmed,
    });
    if (error) {
      console.error('Failed to rename session:', error);
    } else {
      setSessions((prev) =>
        prev.map((x) => (x.id === session.id ? { ...x, title: trimmed } : x))
      );
    }
    setRenamingId(null);
  }

  async function handleEndSession(session: SessionRow) {
    const { error } = await supabase.rpc('end_session_by_admin_token', {
      p_admin_token: session.admin_token,
    });
    if (error) {
      console.error('Failed to end session:', error);
    } else {
      setSessions(s => s.map(x => x.id === session.id ? { ...x, status: 'ended' } : x));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_session_by_admin_token', {
        p_admin_token: deleteTarget.admin_token,
      });
      if (error) {
        console.error('Failed to delete session:', error);
        alert('Failed to delete session.');
      } else {
        setSessions((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Early returns ──────────────────────────────────────────────────────────
  if (loading) return null;
  if (sessions.length === 0) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        className="bg-[var(--bg-primary)]"
      >
        {/* ── Top bar: search + month jump ──────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-surface)]"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sessions…"
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-placeholder)]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Month jump */}
          {monthGroups.length > 1 && (
            <select
              onChange={(e) => {
                if (e.target.value) jumpToMonth(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)] cursor-pointer"
              aria-label="Jump to month"
            >
              <option value="" disabled>
                Jump to month
              </option>
              {monthGroups.map((g) => (
                <option key={g.monthKey} value={g.monthKey}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Scrollable session list ─────────────────────────────────── */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }} className="px-5 pb-8">
          {monthGroups.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-12">
              No sessions match your search.
            </p>
          ) : (
            monthGroups.map((group) => (
              <div
                key={group.monthKey}
                ref={(el) => {
                  if (el) sectionRefs.current.set(group.monthKey, el);
                  else sectionRefs.current.delete(group.monthKey);
                }}
              >
                {/* ── Sticky month header ──────────────────────────── */}
                <div
                  className="sticky top-0 z-10 flex items-center gap-2 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]"
                >
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {group.label}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    — {group.sessions.length}{' '}
                    {group.sessions.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>

                {/* ── Session cards (grid) ─────────────────────────── */}
                <div className="py-2 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {group.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden flex flex-col h-[120px]"
                    >
                      {/* Card header row */}
                      <div className="flex items-start gap-3 px-3 pt-2.5 pb-1.5 flex-1 min-h-0">
                        <div className="flex-1 min-w-0">
                          {renamingId === s.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => handleRename(s)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(s);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              className="text-xs font-semibold w-full rounded px-1.5 py-0.5 border bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
                            />
                          ) : (
                            <p
                              className="text-xs font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                              onClick={() => startRename(s)}
                              title="Click to rename"
                            >
                              {s.title}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-[var(--text-muted)]">
                              {s.question_count}{' '}
                              {s.question_count === 1 ? 'item' : 'items'}
                            </span>
                            {s.participant_count > 0 && (
                              <>
                                <span className="text-xs text-[var(--text-muted)]">·</span>
                                <span className="text-xs text-[var(--text-muted)]">
                                  {s.participant_count}{' '}
                                  {s.participant_count === 1
                                    ? 'participant'
                                    : 'participants'}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-[var(--text-muted)]">·</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatShortDate(s.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_BADGE[s.status] ?? STATUS_BADGE['draft']}`}
                        >
                          {s.status}
                        </span>
                      </div>

                      {/* Card action row */}
                      <div className="flex items-center gap-1 px-3 pb-2 border-t border-[var(--border-primary)] pt-1.5 mt-auto">
                        {/* Primary action: Resume / Review / Edit */}
                        <button
                          onClick={() => handlePrimaryAction(s)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                            s.status === 'ended'
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {primaryActionLabel(s.status)}
                        </button>

                        {(s.status === 'active' || s.status === 'lobby') && (
                          <button
                            onClick={() => handleEndSession(s)}
                            className="px-2 py-1 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
                          >
                            End
                          </button>
                        )}

                        <button
                          onClick={() => handleExportCSV(s)}
                          disabled={exporting === s.session_id}
                          className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors disabled:opacity-40"
                        >
                          CSV
                        </button>

                        <button
                          onClick={() => handleSaveAsTemplate(s)}
                          disabled={actionLoading === s.id || s.question_count === 0}
                          className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors disabled:opacity-40"
                        >
                          {actionLoading === s.id ? 'Saving…' : 'Template'}
                        </button>

                        <div className="flex-1" />

                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="px-2 py-1 text-xs font-medium text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Session"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will permanently remove the session and all its questions, votes, and batches.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
