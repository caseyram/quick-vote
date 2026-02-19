import { supabase } from './supabase';
import type { SessionItem } from '../types/database';

/**
 * Ensure session_items exist for all batches in a session (idempotent backfill).
 * If batch-type items already exist, returns all items sorted by position.
 * If no batch-type items exist, creates session_items for all batches.
 * Returns all session_items (batch + slide) sorted by position.
 */
export async function ensureSessionItems(sessionId: string): Promise<SessionItem[]> {
  // Fetch all existing session_items for this session
  const { data: existingItems, error: fetchError } = await supabase
    .from('session_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (fetchError) {
    // SELECT may fail if table doesn't exist yet or RLS blocks read.
    // Return empty and let the caller handle gracefully.
    console.warn('session_items fetch failed:', fetchError.message);
    return [];
  }

  const items = existingItems ?? [];

  // Check if any batch-type items already exist
  const batchItemsExist = items.some((item) => item.item_type === 'batch');

  if (batchItemsExist) {
    // Backfill already done - return all items sorted by position
    return items;
  }

  // No batch items exist - perform backfill
  // Fetch all batches for this session, ordered by position
  const { data: batches, error: batchesError } = await supabase
    .from('batches')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (batchesError) throw batchesError;

  if (!batches || batches.length === 0) {
    // No batches to backfill - return existing items (slides only)
    return items;
  }

  // Create session_item for each batch
  const newBatchItems = batches.map((batch, index) => ({
    session_id: sessionId,
    item_type: 'batch' as const,
    batch_id: batch.id,
    position: index,
    slide_image_path: null,
    slide_caption: null,
  }));

  // Insert all batch items at once
  const { data: insertedItems, error: insertError } = await supabase
    .from('session_items')
    .insert(newBatchItems)
    .select();

  if (insertError) {
    // INSERT may fail if user's anonymous auth identity changed (RLS 403).
    // Fall back to virtual items from batches so the UI still renders.
    console.warn('session_items backfill failed (likely RLS), using client-side items:', insertError.message);
    const virtualItems: SessionItem[] = batches.map((batch, index) => ({
      id: batch.id,
      session_id: sessionId,
      item_type: 'batch' as SessionItem['item_type'],
      position: index,
      batch_id: batch.id,
      slide_image_path: null,
      slide_caption: null,
      slide_notes: null,
      created_at: new Date().toISOString(),
    }));
    return [...virtualItems, ...items].sort((a, b) => a.position - b.position);
  }

  // Return ALL session_items (newly created batch items + existing slide items)
  const allItems = [...(insertedItems ?? []), ...items].sort(
    (a, b) => a.position - b.position
  );

  return allItems;
}

/**
 * Create a session_item for a new batch.
 * Automatically determines the next position.
 */
export async function createBatchSessionItem(
  sessionId: string,
  batchId: string
): Promise<SessionItem> {
  // Determine next position
  const { data: existingItems, error: fetchError } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;

  const nextPosition =
    existingItems && existingItems.length > 0 ? existingItems[0].position + 1 : 0;

  // Insert session_item
  const { data, error } = await supabase
    .from('session_items')
    .insert({
      session_id: sessionId,
      item_type: 'batch',
      batch_id: batchId,
      position: nextPosition,
      slide_image_path: null,
      slide_caption: null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Reorder session items by updating their positions.
 * Updates each item sequentially to avoid race conditions.
 */
export async function reorderSessionItems(
  items: { id: string; position: number }[]
): Promise<void> {
  // Update positions sequentially
  for (const item of items) {
    const { error } = await supabase
      .from('session_items')
      .update({ position: item.position })
      .eq('id', item.id);

    if (error) throw error;
  }
}

/**
 * Fetch all session items for a session, ordered by position.
 * Re-exported from slide-api for convenience.
 */
export { fetchSessionItems } from './slide-api';
