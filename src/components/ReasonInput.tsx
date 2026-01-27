import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReasonInputProps {
  voteId: string;
  existingReason: string | null;
}

export function ReasonInput({ voteId, existingReason }: ReasonInputProps) {
  const [reason, setReason] = useState(existingReason ?? '');
  const [saved, setSaved] = useState(!!existingReason);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setSaving(true);
    const { error } = await supabase
      .from('votes')
      .update({ reason: trimmed })
      .eq('id', voteId);

    if (!error) {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-gray-400 text-sm font-medium">Add a reason (optional)</p>
      <textarea
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setSaved(false);
        }}
        placeholder="Share your perspective..."
        rows={2}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
      />
      <button
        onClick={handleSave}
        disabled={!reason.trim() || saving || saved}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white'
        }`}
      >
        {saving ? 'Saving...' : saved ? 'Reason Saved' : 'Save Reason'}
      </button>
    </div>
  );
}
