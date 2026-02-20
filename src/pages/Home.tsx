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
  const { theme } = useTheme();
  const light = theme === 'light';
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
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-12 ${light ? 'bg-gray-50' : 'bg-gray-950'}`}>
        {/* Theme toggle */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md text-center space-y-8">
          <div>
            <h1 className={`text-5xl font-bold tracking-tight ${light ? 'text-gray-900' : 'text-white'}`}>
              QuickVote
            </h1>
            <p className={`mt-3 text-lg ${light ? 'text-gray-500' : 'text-gray-400'}`}>
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
            <p className={`text-sm ${light ? 'text-gray-500' : 'text-gray-500'}`}>
              Build a session in the template editor
            </p>
          </div>

          {/* Quick Session section */}
          <div className={`border-t pt-6 space-y-4 ${light ? 'border-gray-200' : 'border-gray-800'}`}>
            <p className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>Or start a quick session directly:</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional)"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${light ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400' : 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'}`}
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickSession();
              }}
            />

            <button
              onClick={handleQuickSession}
              disabled={creating}
              className={`w-full py-3 px-6 font-semibold rounded-lg transition-colors disabled:cursor-not-allowed ${light ? 'bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-900' : 'bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 text-white'}`}
            >
              {creating ? 'Creating...' : 'Quick Session'}
            </button>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>

          {/* New from Template section */}
          {templates.length > 0 && (
            <div className={`border-t pt-6 space-y-4 ${light ? 'border-gray-200' : 'border-gray-800'}`}>
              <p className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>New from Template:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.slice(0, 5).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleNewFromTemplate(template.id)}
                    className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${light ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900' : 'bg-gray-900 hover:bg-gray-800 border-gray-700 text-white'}`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>
                      {template.item_count} {template.item_count === 1 ? 'item' : 'items'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <PastSessions theme={theme} />
      </div>
    </AdminPasswordGate>
  );
}
