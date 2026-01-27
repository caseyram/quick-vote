import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { bulkInsertQuestions, questionsToTemplates } from '../lib/question-templates';
import type { Session, Question } from '../types/database';

interface SessionRow extends Session {
  question_count: number;
}

export function PastSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('sessions')
        .select('*, questions(count)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const rows: SessionRow[] = data.map((row: any) => ({
          ...row,
          question_count:
            Array.isArray(row.questions) && row.questions.length > 0
              ? row.questions[0].count
              : 0,
          questions: undefined,
        }));
        setSessions(rows);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleUseAsTemplate(session: SessionRow) {
    setActionLoading(session.id);
    try {
      // Fetch questions from the source session
      const { data: srcQuestions } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', session.session_id)
        .order('position', { ascending: true });

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

      // Bulk-insert copied questions
      const templates = questionsToTemplates(srcQuestions as Question[]);
      await bulkInsertQuestions(newSessionId, templates, 0);

      navigate(`/admin/${newSession.admin_token}`);
    } finally {
      setActionLoading(null);
    }
  }

  function handleResume(session: SessionRow) {
    navigate(`/admin/${session.admin_token}`);
  }

  if (loading) return null;
  if (sessions.length === 0) return null;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    lobby: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    ended: 'bg-gray-200 text-gray-500',
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <h2 className="text-lg font-semibold text-white">Past Sessions</h2>
      <div className="space-y-2">
        {sessions.map((s) => (
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
                {' \u00b7 '}
                {new Date(s.created_at).toLocaleDateString()}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleUseAsTemplate(s)}
                  disabled={actionLoading === s.id}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {actionLoading === s.id ? 'Creating...' : 'Use as Template'}
                </button>
                {s.status !== 'ended' && (
                  <button
                    onClick={() => handleResume(s)}
                    className="px-2.5 py-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
