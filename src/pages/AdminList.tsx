import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { exportSession, downloadJSON, generateExportFilename } from '../lib/session-export';
import type { Session } from '../types/database';

interface SessionWithStats extends Session {
  question_count: number;
  participant_count: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  lobby: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-200 text-gray-500',
};

export default function AdminList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Fetch sessions with stats
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
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const rows: SessionWithStats[] = data.map((session: any) => ({
          ...session,
          question_count: Array.isArray(session.questions) && session.questions.length > 0
            ? session.questions[0].count
            : 0,
          participant_count: new Set(
            (session.votes ?? []).map((v: { participant_id: string }) => v.participant_id)
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

  // Create new session
  async function handleNewSession() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newSessionId = nanoid();
      const { data, error } = await supabase.from('sessions').insert({
        session_id: newSessionId,
        title: 'Untitled Session',
        created_by: user.id,
      }).select('admin_token').single();

      if (error || !data) return;
      navigate(`/admin/${data.admin_token}`);
    } finally {
      setCreating(false);
    }
  }

  // Delete session
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

  // Export session
  async function handleExport(session: SessionWithStats) {
    setExporting(session.session_id);
    try {
      const data = await exportSession(session.session_id);
      const filename = generateExportFilename(session.title);
      downloadJSON(data, filename);
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <button
            onClick={handleNewSession}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {creating ? 'Creating...' : 'New Session'}
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sessions..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Session list */}
        <div className="space-y-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {sessions.length === 0
                  ? 'No sessions yet. Create your first session to get started.'
                  : 'No sessions match your search.'}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{session.title}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[session.status] ?? 'bg-gray-200 text-gray-700'}`}
                  >
                    {session.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {session.question_count} question{session.question_count !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {session.participant_count} participant{session.participant_count !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {new Date(session.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/admin/${session.admin_token}`)}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => navigate(`/admin/review/${session.session_id}`)}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => handleExport(session)}
                      disabled={exporting === session.session_id}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-500 disabled:text-gray-400 transition-colors"
                    >
                      {exporting === session.session_id ? 'Exporting...' : 'Export'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(session)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
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
    </div>
  );
}
