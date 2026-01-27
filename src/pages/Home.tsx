import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';

export default function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);

  async function handleCreateSession() {
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold text-white tracking-tight">
            QuickVote
          </h1>
          <p className="mt-3 text-gray-400 text-lg">
            Create a live voting session in seconds
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title (optional)"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSession();
            }}
          />

          <button
            onClick={handleCreateSession}
            disabled={creating}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {creating ? 'Creating...' : 'Create Session'}
          </button>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
