import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { AdminPasswordGate } from '../components/AdminPasswordGate';
import { PastSessions } from '../components/PastSessions';
import { useSessionTemplateStore } from '../stores/session-template-store';
import { fetchSessionTemplates } from '../lib/session-template-api';

export default function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const { templates } = useSessionTemplateStore();

  // Fetch templates on mount
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

  function handleCreateNew() {
    navigate('/templates/new');
  }

  function handleNewFromTemplate(templateId: string) {
    navigate(`/templates/${templateId}/edit?from=template`);
  }

  return (
    <AdminPasswordGate>
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12 gap-12">
        <div className="w-full max-w-md text-center space-y-8">
          <div>
            <h1 className="text-5xl font-bold text-white tracking-tight">
              QuickVote
            </h1>
            <p className="mt-3 text-gray-400 text-lg">
              Create a live voting session in seconds
            </p>
          </div>

          {/* Main action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleCreateNew}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
            >
              Create New
            </button>
            <p className="text-gray-500 text-sm">
              Build a session in the template editor
            </p>
          </div>

          {/* Quick Session section */}
          <div className="border-t border-gray-800 pt-6 space-y-4">
            <p className="text-gray-400 text-sm">Or start a quick session directly:</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional)"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickSession();
              }}
            />

            <button
              onClick={handleQuickSession}
              disabled={creating}
              className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Quick Session'}
            </button>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>

          {/* New from Template section */}
          {templates.length > 0 && (
            <div className="border-t border-gray-800 pt-6 space-y-4">
              <p className="text-gray-400 text-sm">New from Template:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.slice(0, 5).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleNewFromTemplate(template.id)}
                    className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg text-white transition-colors"
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-400">
                      {template.item_count} {template.item_count === 1 ? 'item' : 'items'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <PastSessions />
      </div>
    </AdminPasswordGate>
  );
}
