import { supabase } from './supabase';

/**
 * Toggle moderation state on a vote response.
 * When `moderate` is true, sets moderated_at to now and moderated_by to 'facilitator'.
 * When `moderate` is false, clears both columns.
 *
 * This is intended to be called in the background after an optimistic UI update.
 */
export async function moderateVote(voteId: string, moderate: boolean): Promise<void> {
  const update = moderate
    ? { moderated_at: new Date().toISOString(), moderated_by: 'facilitator' }
    : { moderated_at: null, moderated_by: null };

  const { error } = await supabase
    .from('votes')
    .update(update)
    .eq('id', voteId);

  if (error) {
    console.error('[vote-api] moderateVote failed:', error.message);
  }
}
