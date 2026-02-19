import { supabase } from './supabase';
import type { SessionItem } from '../types/database';

/**
 * Fetch all session items for a session, ordered by position.
 * Returns both batch and slide items in display order.
 */
export async function fetchSessionItems(sessionId: string): Promise<SessionItem[]> {
  const { data, error } = await supabase
    .from('session_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (error) throw error;

  return data ?? [];
}

/**
 * Create a new slide item in the session.
 * Automatically determines next position.
 */
export async function createSlide(
  sessionId: string,
  imagePath: string,
  caption: string | null
): Promise<SessionItem> {
  // Determine next position
  const { data: existingItems, error: fetchError } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;

  const nextPosition = existingItems && existingItems.length > 0
    ? existingItems[0].position + 1
    : 0;

  // Insert new slide item
  const { data, error } = await supabase
    .from('session_items')
    .insert({
      session_id: sessionId,
      item_type: 'slide',
      position: nextPosition,
      slide_image_path: imagePath,
      slide_caption: caption,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Update the caption of an existing slide.
 */
export async function updateSlideCaption(
  itemId: string,
  caption: string | null
): Promise<void> {
  const { error } = await supabase
    .from('session_items')
    .update({ slide_caption: caption })
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Update the notes of an existing slide.
 */
export async function updateSlideNotes(
  itemId: string,
  notes: string | null
): Promise<void> {
  const { error } = await supabase
    .from('session_items')
    .update({ slide_notes: notes })
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Delete a slide item and its associated Storage image.
 * Storage deletion happens first to prevent orphaned files.
 */
export async function deleteSlide(itemId: string, imagePath: string): Promise<void> {
  // First, delete the Storage object
  const { error: storageError } = await supabase.storage
    .from('session-images')
    .remove([imagePath]);

  if (storageError) {
    console.warn('Failed to delete Storage object:', storageError);
    // Continue to DB delete even if Storage fails (file may not exist)
  }

  // Then delete the database row
  const { error: dbError } = await supabase
    .from('session_items')
    .delete()
    .eq('id', itemId);

  if (dbError) throw dbError;
}

/**
 * Get the public URL for a slide image.
 * This is a synchronous operation (constructs URL without network call).
 */
export function getSlideImageUrl(imagePath: string): string {
  const { data } = supabase.storage
    .from('session-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}

/**
 * Upload an image file to Storage.
 * Returns the relative path (NOT the full URL).
 * Path format: {sessionId}/{uuid}.{ext}
 */
export async function uploadSlideImage(sessionId: string, file: File): Promise<string> {
  // Extract file extension
  const extension = getFileExtension(file);

  // Generate unique filename
  const filename = `${sessionId}/${crypto.randomUUID()}.${extension}`;

  // Upload to Storage
  const { data, error } = await supabase.storage
    .from('session-images')
    .upload(filename, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  return data.path;
}

/**
 * Extract file extension from File object.
 * Derives from file.name or file.type as fallback.
 */
function getFileExtension(file: File): string {
  // Try to extract from filename first
  const nameParts = file.name.split('.');
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1].toLowerCase();
  }

  // Fallback to MIME type mapping
  const mimeTypeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return mimeTypeMap[file.type] || 'jpg';
}
