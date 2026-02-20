import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { bulkInsertQuestions, questionsToTemplates, batchesToTemplates } from '../lib/question-templates';
import { exportSession, downloadJSON, downloadCSV, sessionToCSV, generateExportFilename } from '../lib/session-export';
import { ConfirmDialog } from './ConfirmDialog';
import type { Session, Question, Batch, SessionItem } from '../types/database';

interface SessionRow extends Session {
  question_count: number;
  participant_count: number;
}

export function PastSessions({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const light = theme === 'light';
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('sessions')
        .select('*, questions(count), votes(participant_id)')
        .order('created_at', { ascending: false });

      if (data) {
        const rows: SessionRow[] = data.map((row: any) => ({
          ...row,
          question_count:
            Array.isArray(row.questions) && row.questions.length > 0
              ? row.questions[0].count
              : 0,
          // Count unique participants, excluding the session creator (admin)
          participant_count: new Set(
            (row.votes ?? [])
              .filter((v: { participant_id: string }) => v.participant_id !== row.created_by)
              .map((v: { participant_id: string }) => v.participant_id)
          ).size,
          questions: undefined,
          votes: undefined,
        }));
        setSessions(rows);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredSessions = useMemo(() => {
    if (!debouncedTerm) return sessions;
    return sessions.filter(s =>
      s.title.toLowerCase().includes(debouncedTerm.toLowerCase())
    );
  }, [sessions, debouncedTerm]);

  async function handleUseAsTemplate(session: SessionRow) {
    setActionLoading(session.id);
    try {
      // Fetch questions, batches, and session_items from the source session
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

      const srcQuestions = questionsResult.data as Question[] | null;
      const srcBatches = batchesResult.data as Batch[] | null;
      const srcItems = itemsResult.data as SessionItem[] | null;

      if ((!srcQuestions || srcQuestions.length === 0) && (!srcItems || srcItems.length === 0)) {
        setActionLoading(null);
        return;
      }

      // Create new session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newSessionId = nanoid();
      const { data: newSession, error: insertErr } = await supabase
        .from('sessions')
        .insert({
          session_id: newSessionId,
          title: session.title,
          created_by: user.id,
        })
        .select('admin_token')
        .single();

      if (insertErr || !newSession) return;

      // Bulk-insert copied questions and batches
      const questionTemplates = questionsToTemplates(srcQuestions ?? [], srcBatches ?? []);
      const batchTemplates = batchesToTemplates(srcBatches ?? []);
      const { batches: newBatches } = await bulkInsertQuestions(
        newSessionId, questionTemplates, batchTemplates, 0, 0
      );

      // Build old batch ID → new batch ID mapping (matched by sorted position order)
      const sortedSrcBatches = [...(srcBatches ?? [])].sort((a, b) => a.position - b.position);
      const sortedNewBatches = [...newBatches].sort((a, b) => a.position - b.position);
      const batchIdMap = new Map<string, string>();
      sortedSrcBatches.forEach((srcBatch, idx) => {
        if (idx < sortedNewBatches.length) {
          batchIdMap.set(srcBatch.id, sortedNewBatches[idx].id);
        }
      });

      // Create session_items for the new session (preserving sequence order with slides)
      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map((item) => ({
          session_id: newSessionId,
          item_type: item.item_type,
          position: item.position,
          batch_id: item.batch_id ? (batchIdMap.get(item.batch_id) ?? null) : null,
          slide_image_path: item.slide_image_path,
          slide_caption: item.slide_caption,
        }));

        await supabase.from('session_items').insert(newItems);
      }

      navigate(`/admin/${newSession.admin_token}`);
    } finally {
      setActionLoading(null);
    }
  }

  function handleOpen(session: SessionRow) {
    navigate(`/admin/${session.admin_token}`);
  }

  function handleReview(session: SessionRow) {
    navigate(`/admin/review/${session.session_id}`);
  }

  async function handleExportJSON(session: SessionRow) {
    setExporting(session.session_id);
    try {
      const data = await exportSession(session.session_id);
      downloadJSON(data, generateExportFilename(session.title, 'json'));
    } finally {
      setExporting(null);
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('sessions').delete().eq('id', deleteTarget.id);
      setSessions(s => s.filter(x => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return null;
  if (sessions.length === 0) return null;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    lobby: 'bg-blue-100 text-blue-700',
    active: 'bg-yellow-100 text-yellow-700',
    ended: 'bg-green-100 text-green-700',
  };

  return (
    <>
      <div className="w-full max-w-md space-y-3">
        <h2 className={`text-lg font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>Past Sessions</h2>

        {/* Search */}
        {sessions.length > 3 && (
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sessions..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm ${light ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400' : 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'}`}
          />
        )}

        <div className="space-y-2">
          {filteredSessions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No sessions match your search.
            </p>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg px-4 py-3 space-y-2 border ${light ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium truncate ${light ? 'text-gray-900' : 'text-white'}`}>{s.title}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[s.status] ?? 'bg-gray-200 text-gray-700'}`}
                  >
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {s.question_count} question{s.question_count !== 1 ? 's' : ''}
                    {s.participant_count > 0 && (
                      <>
                        {' \u00b7 '}
                        {s.participant_count} participant{s.participant_count !== 1 ? 's' : ''}
                      </>
                    )}
                    {' \u00b7 '}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`flex flex-wrap gap-1.5 pt-1 border-t ${light ? 'border-gray-200' : 'border-gray-800'}`}>
                  {s.status !== 'ended' ? (
                    <button
                      onClick={() => handleOpen(s)}
                      className="px-2.5 py-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
                    >
                      {s.status === 'draft' ? 'Edit' : 'Resume'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReview(s)}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Review
                    </button>
                  )}
                  <button
                    onClick={() => handleUseAsTemplate(s)}
                    disabled={actionLoading === s.id || s.question_count === 0}
                    className="px-2.5 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === s.id ? 'Creating...' : 'Template'}
                  </button>
                  <button
                    onClick={() => handleExportCSV(s)}
                    disabled={exporting === s.session_id}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
                  >
                    {exporting === s.session_id ? 'Exporting...' : 'CSV'}
                  </button>
                  <button
                    onClick={() => handleExportJSON(s)}
                    disabled={exporting === s.session_id}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
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
