import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { loadTemplateIntoSession } from '../lib/session-template-api';
import type { SessionTemplate } from '../types/database';

interface CreateFromTemplateDialogProps {
  isOpen: boolean;
  template: SessionTemplate | null;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateFromTemplateDialog({
  isOpen,
  template,
  onClose,
  onCreated,
}: CreateFromTemplateDialogProps) {
  const [sessionName, setSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when template changes
  useEffect(() => {
    if (template && isOpen) {
      setSessionName(template.name);
      setError(null);
      setCreating(false);
      // Focus input after render
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [template, isOpen]);

  if (!isOpen || !template) return null;

  async function handleCreate() {
    const trimmed = sessionName.trim();
    if (!trimmed) {
      setError('Session name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setCreating(false);
        return;
      }

      // Create the session
      const newSessionId = nanoid();
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({
          session_id: newSessionId,
          title: trimmed,
          status: 'lobby',
          created_by: user.id,
        })
        .select('admin_token')
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? 'Failed to create session');
        setCreating(false);
        return;
      }

      // Load the template blueprint into the session
      await loadTemplateIntoSession(newSessionId, template!.blueprint);

      // Close modal and notify parent so sessions list refreshes
      onClose();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div
        className="rounded-xl p-6 w-full max-w-md space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
      >
        <h3 className="text-lg font-semibold">Create Session from Template</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Create a new session pre-loaded with "{template.name}"
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="session-name"
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Session Name
          </label>
          <input
            ref={inputRef}
            id="session-name"
            type="text"
            value={sessionName}
            onChange={(e) => {
              setSessionName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating) handleCreate();
              if (e.key === 'Escape') onClose();
            }}
            disabled={creating}
            className="w-full text-sm rounded-lg px-3 py-2.5 border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-input, var(--bg-primary))',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder="Enter session name..."
          />
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !sessionName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {creating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
