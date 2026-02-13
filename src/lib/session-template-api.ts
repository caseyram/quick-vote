import { supabase } from './supabase';
import type { SessionTemplate, SessionBlueprint, SessionItem, Batch, Question } from '../types/database';
import { useSessionTemplateStore } from '../stores/session-template-store';

/**
 * Fetch all session templates from Supabase, ordered by updated_at descending.
 * Updates the session template store with the results.
 */
export async function fetchSessionTemplates(): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const templates = data ?? [];
  useSessionTemplateStore.getState().setTemplates(templates);
  return templates;
}

/**
 * Save a new session template.
 * Updates the store on success.
 * Throws user-friendly error if name already exists.
 */
export async function saveSessionTemplate(
  name: string,
  blueprint: SessionBlueprint,
  itemCount: number
): Promise<SessionTemplate> {
  const { data, error } = await supabase
    .from('session_templates')
    .insert({ name, blueprint, item_count: itemCount })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('Template with this name already exists');
    }
    throw error;
  }

  useSessionTemplateStore.getState().addTemplate(data);
  return data;
}

/**
 * Overwrite an existing session template's blueprint and item_count.
 * Updates the store on success.
 */
export async function overwriteSessionTemplate(
  id: string,
  blueprint: SessionBlueprint,
  itemCount: number
): Promise<SessionTemplate> {
  const { data, error } = await supabase
    .from('session_templates')
    .update({ blueprint, item_count: itemCount })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  useSessionTemplateStore.getState().updateTemplate(id, data);
  return data;
}

/**
 * Rename an existing session template.
 * Updates the store on success.
 * Throws user-friendly error if name conflict.
 */
export async function renameSessionTemplate(
  id: string,
  name: string
): Promise<SessionTemplate> {
  const { data, error } = await supabase
    .from('session_templates')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('Template with this name already exists');
    }
    throw error;
  }

  useSessionTemplateStore.getState().updateTemplate(id, data);
  return data;
}

/**
 * Delete a session template.
 * Updates the store on success.
 */
export async function deleteSessionTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('session_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;

  useSessionTemplateStore.getState().removeTemplate(id);
}

/**
 * Check if a template with the given name already exists.
 * Used for overwrite-or-save-as-new prompts.
 */
export async function checkTemplateNameExists(name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('session_templates')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (error) throw error;

  return data !== null;
}

/**
 * Serialize session state into a SessionBlueprint.
 * Pure function - no Supabase calls.
 *
 * @param sessionItems - Array of session items from session store
 * @param batches - Array of batches from session store
 * @param questions - Array of questions from session store
 * @returns SessionBlueprint ready to save
 */
export function serializeSession(
  sessionItems: SessionItem[],
  batches: Batch[],
  questions: Question[]
): SessionBlueprint {
  // Group questions by batch_id
  const questionsByBatch = new Map<string, Question[]>();
  questions.forEach((q) => {
    if (q.batch_id) {
      const existing = questionsByBatch.get(q.batch_id) || [];
      questionsByBatch.set(q.batch_id, [...existing, q]);
    }
  });

  // Sort questions within each batch by position
  questionsByBatch.forEach((batchQuestions) => {
    batchQuestions.sort((a, b) => a.position - b.position);
  });

  // Sort session items by position
  const sortedItems = [...sessionItems].sort((a, b) => a.position - b.position);

  // Map items to blueprint format
  const blueprintItems = sortedItems.map((item) => {
    if (item.item_type === 'batch' && item.batch_id) {
      const batch = batches.find((b) => b.id === item.batch_id);
      const batchQuestions = questionsByBatch.get(item.batch_id) || [];

      return {
        item_type: 'batch' as const,
        position: item.position,
        batch: {
          name: batch?.name || 'Untitled Batch',
          cover_image_path: batch?.cover_image_path ?? null,
          questions: batchQuestions.map((q) => ({
            text: q.text,
            type: q.type,
            options: q.options,
            anonymous: q.anonymous,
            position: q.position,
            template_id: q.template_id,
          })),
        },
      };
    } else {
      // Slide item
      return {
        item_type: 'slide' as const,
        position: item.position,
        slide: {
          image_path: item.slide_image_path || '',
          caption: item.slide_caption,
        },
      };
    }
  });

  return {
    version: 1,
    sessionItems: blueprintItems,
  };
}

/**
 * Load a template blueprint into a session by creating DB records.
 * Creates batches, questions, and session_items from the blueprint.
 * Validates response template references.
 *
 * @param sessionId - Session to load template into
 * @param blueprint - SessionBlueprint to materialize
 * @returns Object with missingTemplateCount for UI warnings
 */
export async function loadTemplateIntoSession(
  sessionId: string,
  blueprint: SessionBlueprint
): Promise<{ missingTemplateCount: number }> {
  // Clone blueprint to prevent mutation
  const clonedBlueprint = structuredClone(blueprint);
  let missingTemplateCount = 0;

  // Process each item in order
  for (const item of clonedBlueprint.sessionItems) {
    if (item.item_type === 'batch' && item.batch) {
      // Create batch
      const { data: newBatch, error: batchError } = await supabase
        .from('batches')
        .insert({
          session_id: sessionId,
          name: item.batch.name,
          position: item.position,
          status: 'pending',
          cover_image_path: item.batch.cover_image_path ?? null,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create questions for this batch
      for (const questionBlueprint of item.batch.questions) {
        let templateId = questionBlueprint.template_id;

        // Validate template_id if set
        if (templateId) {
          const { data: templateExists, error: templateError } = await supabase
            .from('response_templates')
            .select('id')
            .eq('id', templateId)
            .maybeSingle();

          if (templateError) throw templateError;

          if (!templateExists) {
            templateId = null;
            missingTemplateCount++;
          }
        }

        const { error: questionError } = await supabase
          .from('questions')
          .insert({
            session_id: sessionId,
            text: questionBlueprint.text,
            type: questionBlueprint.type,
            options: questionBlueprint.options,
            anonymous: questionBlueprint.anonymous,
            position: questionBlueprint.position,
            status: 'pending',
            batch_id: newBatch.id,
            template_id: templateId,
          })
          .select()
          .single();

        if (questionError) throw questionError;
      }

      // Create session_item for batch
      const { error: itemError } = await supabase
        .from('session_items')
        .insert({
          session_id: sessionId,
          item_type: 'batch',
          position: item.position,
          batch_id: newBatch.id,
        })
        .select()
        .single();

      if (itemError) throw itemError;
    } else if (item.item_type === 'slide' && item.slide) {
      // Create session_item for slide
      const { error: slideError } = await supabase
        .from('session_items')
        .insert({
          session_id: sessionId,
          item_type: 'slide',
          position: item.position,
          slide_image_path: item.slide.image_path,
          slide_caption: item.slide.caption,
        })
        .select()
        .single();

      if (slideError) throw slideError;
    }
  }

  return { missingTemplateCount };
}
