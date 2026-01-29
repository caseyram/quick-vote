import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { bulkInsertQuestions, questionsToTemplates, batchesToTemplates } from '../lib/question-templates';
import { exportSession, downloadJSON, generateExportFilename } from '../lib/session-export';
import { ConfirmDialog } from './ConfirmDialog';
import type { Session, Question, Batch } from '../types/database';

interface SessionRow extends Session {
  question_count: number;
  participant_count: number;
}

export function PastSessions() {
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
      // Fetch questions and batches from the source session
      const [questionsResult, batchesResult] = await Promise.all([
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
      ]);

      const srcQuestions = questionsResult.data as Question[] | null;
      const srcBatches = batchesResult.data as Batch[] | null;

      if (!srcQuestions || srcQuestions.length === 0) {
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
      const questionTemplates = questionsToTemplates(srcQuestions, srcBatches ?? []);
      const batchTemplates = batchesToTemplates(srcBatches ?? []);
      await bulkInsertQuestions(newSessionId, questionTemplates, batchTemplates, 0, 0);

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

  async function handleExport(session: SessionRow) {
    setExporting(session.session_id);
    try {
      const data = await exportSession(session.session_id);
      const filename = generateExportFilename(session.title);
      downloadJSON(data, filename);
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
        <h2 className="text-lg font-semibold text-white">Past Sessions</h2>

        {/* Search */}
        {sessions.length > 3 && (
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sessions..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
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
                className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{s.title}</p>
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
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-800">
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
                    onClick={() => handleExport(s)}
                    disabled={exporting === s.session_id}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
                  >
                    {exporting === s.session_id ? 'Exporting...' : 'Export'}
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
