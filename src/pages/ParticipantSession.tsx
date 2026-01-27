import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import type { Session } from '../types/database';

type ParticipantSession = Pick<Session, 'id' | 'session_id' | 'title' | 'status' | 'created_at'>;

export default function ParticipantSession() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('id, session_id, title, status, created_at')
        .eq('session_id', sessionId)
        .single();

      if (cancelled) return;

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Session not found');
        setLoading(false);
        return;
      }

      setSession(data);
      setLoading(false);
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">Session not found</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 underline">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-white">{session.title}</h1>
        <p className="text-gray-400 text-lg">Waiting for session to start...</p>
      </div>
    </div>
  );
}
