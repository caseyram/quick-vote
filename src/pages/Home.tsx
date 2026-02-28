import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { PastSessions } from '../components/PastSessions';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useSessionTemplateStore } from '../stores/session-template-store';
import { fetchSessionTemplates } from '../lib/session-template-api';

export default function Home() {
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const { templates } = useSessionTemplateStore();

  useEffect(() => {
    fetchSessionTemplates().catch((err) => {
      console.error('Failed to fetch templates:', err);
    });
  }, []);

  async function handleQuickSession() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setCreating(true);
    setError(null);

    try {
      const sessionId = nanoid();
      const { data: { user } } = await supabase.auth.getUser();

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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-12 bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md text-center space-y-8">
          <div>
            <h1 className="text-5xl font-bold tracking-tight">QuickVote</h1>
            <p className="mt-3 text-lg text-[var(--text-secondary)]">
              Create a live voting session in seconds
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/templates/new')}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-[var(--text-primary)] font-semibold rounded-lg transition-colors"
            >
              Create New
            </button>
            <p className="text-sm text-[var(--text-muted)]">
              Build a session in the template editor
            </p>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-6 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Or start a quick session directly:</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional)"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-placeholder)]"
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickSession();
              }}
            />

            <button
              onClick={handleQuickSession}
              disabled={creating}
              className="w-full py-3 px-6 font-semibold rounded-lg transition-colors disabled:cursor-not-allowed bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] disabled:opacity-70 text-[var(--text-primary)]"
            >
              {creating ? 'Creating...' : 'Quick Session'}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          {templates.length > 0 && (
            <div className="border-t border-[var(--border-primary)] pt-6 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">New from Template:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.slice(0, 5).map((template) => (
                  <div key={template.id} className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/templates/${template.id}/edit?from=template`)}
                      className="flex-1 text-left px-4 py-3 border rounded-lg transition-colors bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-primary)] text-[var(--text-primary)]"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {template.item_count} {template.item_count === 1 ? 'item' : 'items'}
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(`/templates/${template.id}/edit`)}
                      className="p-2 rounded-lg border transition-colors bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Edit template"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <PastSessions theme={resolvedTheme} />
      </div>
    </AdminPasswordGate>
  );
}
