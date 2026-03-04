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
 * Find a session template by exact name.
 */
export async function findSessionTemplateByName(name: string): Promise<SessionTemplate | null> {
  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) throw error;

  return data;
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
          notes: item.slide_notes,
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
 * Optimized: bulk inserts replace sequential per-row round trips.
 * Round trips: (1) bulk batches → (2) bulk validate templates →
 *              (3+4 parallel) bulk questions + bulk session_items
 *
 * @param sessionId - Session to load template into
 * @param blueprint - SessionBlueprint to materialize
 * @returns Object with missingTemplateCount for UI warnings
 */
export async function loadTemplateIntoSession(
  sessionId: string,
  blueprint: SessionBlueprint
): Promise<{ missingTemplateCount: number }> {
  const clonedBlueprint = structuredClone(blueprint);
  let missingTemplateCount = 0;

  const batchItems = clonedBlueprint.sessionItems.filter(
    (i) => i.item_type === 'batch' && i.batch
  );
  const slideItems = clonedBlueprint.sessionItems.filter(
    (i) => i.item_type === 'slide' && i.slide
  );

  // ── Phase 1: Bulk insert all batches ─────────────────────────────────────
  // position is unique per session, so we use it as the mapping key.
  const batchIdByPosition = new Map<number, string>();

  if (batchItems.length > 0) {
    const { data: newBatches, error: batchError } = await supabase
      .from('batches')
      .insert(
        batchItems.map((item) => ({
          session_id: sessionId,
          name: item.batch!.name,
          position: item.position,
          status: 'pending',
          cover_image_path: item.batch!.cover_image_path ?? null,
        }))
      )
      .select();

    if (batchError) throw batchError;
    for (const batch of newBatches ?? []) {
      batchIdByPosition.set(batch.position, batch.id);
    }
  }

  // ── Phase 2: Validate all template IDs in one query ──────────────────────
  const allTemplateIds = new Set<string>();
  for (const item of batchItems) {
    for (const q of item.batch!.questions) {
      if (q.template_id) allTemplateIds.add(q.template_id);
    }
  }

  const validTemplateIds = new Set<string>();
  if (allTemplateIds.size > 0) {
    const { data: validTemplates, error: templateError } = await supabase
      .from('response_templates')
      .select('id')
      .in('id', [...allTemplateIds]);

    if (templateError) throw templateError;
    for (const t of validTemplates ?? []) validTemplateIds.add(t.id);
    missingTemplateCount = allTemplateIds.size - validTemplateIds.size;
  }

  // ── Phase 3 + 4 (parallel): bulk questions + bulk session_items ──────────
  const allQuestions = batchItems.flatMap((item) => {
    const batchId = batchIdByPosition.get(item.position);
    if (!batchId) return [];
    return item.batch!.questions.map((q) => ({
      session_id: sessionId,
      text: q.text,
      type: q.type,
      options: q.options,
      anonymous: q.anonymous,
      position: q.position,
      status: 'pending',
      batch_id: batchId,
      template_id: q.template_id && validTemplateIds.has(q.template_id) ? q.template_id : null,
    }));
  });

  const allSessionItems = [
    ...batchItems
      .filter((item) => batchIdByPosition.has(item.position))
      .map((item) => ({
        session_id: sessionId,
        item_type: 'batch' as const,
        position: item.position,
        batch_id: batchIdByPosition.get(item.position)!,
      })),
    ...slideItems.map((item) => ({
      session_id: sessionId,
      item_type: 'slide' as const,
      position: item.position,
      slide_image_path: item.slide!.image_path,
      slide_caption: item.slide!.caption,
      slide_notes: item.slide!.notes,
    })),
  ];

  const [questionsResult, itemsResult] = await Promise.all([
    allQuestions.length > 0
      ? supabase.from('questions').insert(allQuestions)
      : Promise.resolve({ error: null }),
    allSessionItems.length > 0
      ? supabase.from('session_items').insert(allSessionItems)
      : Promise.resolve({ error: null }),
  ]);

  if (questionsResult.error) throw questionsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  return { missingTemplateCount };
}
