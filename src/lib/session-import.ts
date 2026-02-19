import { z } from 'zod';
import { supabase } from './supabase';
import type { Question, Batch } from '../types/database';

// Schema for template import
const TemplateImportSchema = z.object({
  name: z.string(),
  options: z.array(z.string()),
});

// Schema for question import (votes ignored per CONTEXT.md)
const QuestionImportSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  position: z.number().optional(), // Original position for interleaving with unbatched questions
  template_id: z.string().nullable().optional(), // Template name (optional for old exports)
  // Votes in import file are ignored (structure only import)
  votes: z.array(z.any()).optional(),
});

// Schema for slide import
const SlideImportSchema = z.object({
  type: z.literal('slide'),
  position: z.number(),
  image_path: z.string(),
  caption: z.string().nullable(),
  notes: z.string().nullable().optional(),
});

// Schema for batch import (type field optional for backward compat with v1.2)
const BatchImportSchema = z.object({
  type: z.literal('batch').optional(),
  name: z.string().min(1, 'Batch name is required'),
  position: z.number(),
  questions: z.array(QuestionImportSchema).min(1, 'Each batch must have at least one question'),
});

// Union type for batch/slide entries
const BatchOrSlideSchema = z.union([BatchImportSchema, SlideImportSchema]);

// Top-level import schema
export const ImportSchema = z.object({
  session_name: z.string().optional(),
  created_at: z.string().optional(),
  batches: z.array(BatchOrSlideSchema).min(1, 'At least one batch or slide is required'),
  templates: z.array(TemplateImportSchema).optional(),
  session_template_name: z.string().nullable().optional(),
});

export type ImportData = z.infer<typeof ImportSchema>;

// Schema for simple array format (questions only, no batches)
const SimpleQuestionArraySchema = z.array(z.object({
  text: z.string().min(1),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable().optional(),
  anonymous: z.boolean().optional(),
})).min(1);

export interface ValidationResult {
  success: boolean;
  data?: ImportData;
  error?: string;
}

/**
 * Exports session questions and batches to the import format.
 * Unbatched questions are grouped under a special '_unbatched' batch.
 * If sessionItems provided, interleaves slides with batches in position order.
 */
export function exportSessionData(
  questions: Question[],
  batches: Batch[],
  sessionName?: string,
  templates?: Array<{ id: string; name: string; options: string[] }>,
  sessionItems?: Array<{ id: string; session_id: string; item_type: 'batch' | 'slide'; position: number; batch_id: string | null; slide_image_path: string | null; slide_caption: string | null; slide_notes: string | null }>,
  sessionTemplateName?: string | null
): string {
  // Build ID-to-name map for templates
  const idToNameMap = new Map<string, string>();
  for (const t of templates ?? []) {
    idToNameMap.set(t.id, t.name);
  }

  // Group questions by batch
  const batchedQuestions = new Map<string | null, Question[]>();

  for (const q of questions) {
    const key = q.batch_id;
    if (!batchedQuestions.has(key)) {
      batchedQuestions.set(key, []);
    }
    batchedQuestions.get(key)!.push(q);
  }

  // Build export data
  const exportEntries: Array<{
    type?: 'batch' | 'slide';
    name?: string;
    position: number;
    questions?: Array<{
      text: string;
      type: string;
      options: string[] | null;
      anonymous: boolean;
      position: number;
      template_id: string | null;
    }>;
    image_path?: string;
    caption?: string | null;
    notes?: string | null;
  }> = [];

  // If session_items provided, use them to interleave batches and slides
  if (sessionItems && sessionItems.length > 0) {
    for (const item of sessionItems) {
      if (item.item_type === 'batch' && item.batch_id) {
        const batch = batches.find(b => b.id === item.batch_id);
        if (batch) {
          const batchQuestions = batchedQuestions.get(batch.id) ?? [];
          const sortedQuestions = [...batchQuestions].sort((a, b) => a.position - b.position);

          exportEntries.push({
            type: 'batch',
            name: batch.name,
            position: item.position,
            questions: sortedQuestions.map(q => ({
              text: q.text,
              type: q.type,
              options: q.options,
              anonymous: q.anonymous,
              position: q.position,
              template_id: q.template_id ? (idToNameMap.get(q.template_id) ?? null) : null,
            })),
          });
        }
      } else if (item.item_type === 'slide' && item.slide_image_path) {
        exportEntries.push({
          type: 'slide',
          position: item.position,
          image_path: item.slide_image_path,
          caption: item.slide_caption,
          notes: item.slide_notes,
        });
      }
    }
  } else {
    // Legacy export without session_items - batch-only export
    const sortedBatches = [...batches].sort((a, b) => a.position - b.position);
    for (const batch of sortedBatches) {
      const batchQuestions = batchedQuestions.get(batch.id) ?? [];
      const sortedQuestions = [...batchQuestions].sort((a, b) => a.position - b.position);

      exportEntries.push({
        type: 'batch',
        name: batch.name,
        position: batch.position,
        questions: sortedQuestions.map(q => ({
          text: q.text,
          type: q.type,
          options: q.options,
          anonymous: q.anonymous,
          position: q.position,
          template_id: q.template_id ? (idToNameMap.get(q.template_id) ?? null) : null,
        })),
      });
    }

    // Add unbatched questions under special '_unbatched' pseudo-batch
    // Position is -1 to indicate this is not a real batch (filtered out during import)
    const unbatched = batchedQuestions.get(null) ?? [];
    if (unbatched.length > 0) {
      const sortedUnbatched = [...unbatched].sort((a, b) => a.position - b.position);
      exportEntries.push({
        type: 'batch',
        name: '_unbatched',
        position: -1,
        questions: sortedUnbatched.map(q => ({
          text: q.text,
          type: q.type,
          options: q.options,
          anonymous: q.anonymous,
          position: q.position,
          template_id: q.template_id ? (idToNameMap.get(q.template_id) ?? null) : null,
        })),
      });
    }
  }

  // Collect unique template IDs referenced by questions
  const referencedTemplateIds = new Set<string>();
  for (const q of questions) {
    if (q.template_id) {
      referencedTemplateIds.add(q.template_id);
    }
  }

  // Filter templates to only those referenced by questions
  const exportTemplates = (templates ?? [])
    .filter(t => referencedTemplateIds.has(t.id))
    .map(t => ({ name: t.name, options: t.options }));

  const exportData = {
    session_name: sessionName,
    created_at: new Date().toISOString(),
    batches: exportEntries,
    templates: exportTemplates,
    session_template_name: sessionTemplateName ?? null,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Validates an import file for proper JSON structure and schema conformance.
 * Checks file extension, size limits, JSON parsing, and Zod schema validation.
 * Supports both full format (with batches) and simple array format (questions only).
 */
export async function validateImportFile(file: File): Promise<ValidationResult> {
  // Check file extension
  if (!file.name.endsWith('.json')) {
    return { success: false, error: 'Only .json files are allowed' };
  }

  // Check file size (5MB max per RESEARCH.md)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File must be less than 5MB' };
  }

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);

    // Try full format first (object with batches)
    const fullResult = ImportSchema.safeParse(parsed);
    if (fullResult.success) {
      return { success: true, data: fullResult.data };
    }

    // Try simple array format (questions only)
    const simpleResult = SimpleQuestionArraySchema.safeParse(parsed);
    if (simpleResult.success) {
      // Convert to full format with _unbatched batch
      const convertedData: ImportData = {
        batches: [{
          name: '_unbatched',
          position: 0,
          questions: simpleResult.data.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options ?? null,
            anonymous: q.anonymous ?? true,
          })),
        }],
      };
      return { success: true, data: convertedData };
    }

    // Neither format matched - show full format error (more informative)
    const issues = fullResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return { success: false, error: `Validation failed:\n${issues.join('\n')}` };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Validates that slide image paths exist in Supabase Storage.
 * Returns list of missing paths.
 */
async function validateSlideImages(
  sessionId: string,
  slidePaths: string[]
): Promise<string[]> {
  if (slidePaths.length === 0) return [];

  const missing: string[] = [];

  for (const path of slidePaths) {
    // List files in storage to check if path exists
    const { data, error } = await supabase
      .storage
      .from('slides')
      .list(sessionId, {
        limit: 1000,
        search: path.split('/').pop(), // Get filename
      });

    if (error || !data) {
      missing.push(path);
      continue;
    }

    // Check if exact file exists in the list
    const filename = path.split('/').pop();
    const exists = data.some(file => file.name === filename);

    if (!exists) {
      missing.push(path);
    }
  }

  return missing;
}

/**
 * Upserts templates during import with name-based deduplication.
 *
 * For each template:
 * - If name exists with same options: reuse existing template
 * - If name exists with different options: update existing template
 * - If name doesn't exist: insert new template
 *
 * Returns a map of template name -> database UUID for question linking.
 */
async function upsertTemplates(
  templates: Array<{ name: string; options: string[] }>
): Promise<Map<string, string>> {
  const nameToIdMap = new Map<string, string>();

  for (const tmpl of templates) {
    // Check for existing template with same name
    const { data: existing } = await supabase
      .from('response_templates')
      .select('id, options')
      .eq('name', tmpl.name)
      .maybeSingle();

    if (existing) {
      // Template with this name exists
      const optionsMatch = JSON.stringify(existing.options) === JSON.stringify(tmpl.options);

      if (optionsMatch) {
        // Same name, same options - reuse
        nameToIdMap.set(tmpl.name, existing.id);
      } else {
        // Same name, different options - overwrite per 14-CONTEXT.md
        const { data: updated, error } = await supabase
          .from('response_templates')
          .update({ options: tmpl.options })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) throw error;
        nameToIdMap.set(tmpl.name, updated.id);
      }
    } else {
      // New template - insert
      const { data: created, error } = await supabase
        .from('response_templates')
        .insert({ name: tmpl.name, options: tmpl.options })
        .select('id')
        .single();

      if (error) {
        // Handle unique constraint race condition
        if (error.code === '23505') {
          // Another process inserted it - retry fetch
          const { data: retry } = await supabase
            .from('response_templates')
            .select('id')
            .eq('name', tmpl.name)
            .single();

          if (retry) {
            nameToIdMap.set(tmpl.name, retry.id);
          } else {
            // Shouldn't happen - throw original error
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        nameToIdMap.set(tmpl.name, created.id);
      }
    }
  }

  return nameToIdMap;
}

/**
 * Imports validated session data into the database.
 * Creates batches, questions, and session_items (for both batches and slides).
 * Handles slides with Storage validation.
 * Votes in import data are ignored (structure-only import).
 *
 * Note: Import is NOT transactional at database level.
 * If question insert fails after batch insert, batches remain.
 */
export async function importSessionData(
  sessionId: string,
  data: ImportData,
  onMissingSlides?: (missingPaths: string[]) => Promise<boolean>
): Promise<{ batchCount: number; questionCount: number; templateCount: number; slideCount: number; missingSlideCount: number }> {
  // Import templates FIRST (before questions, due to FK constraint)
  const templateMap = await upsertTemplates(data.templates ?? []);

  // Separate slides and batches
  const slideEntries = data.batches.filter((entry): entry is z.infer<typeof SlideImportSchema> =>
    'type' in entry && entry.type === 'slide'
  );
  const batchEntries = data.batches.filter((entry): entry is z.infer<typeof BatchImportSchema> =>
    !('type' in entry && entry.type === 'slide')
  );

  // Validate slide images if any exist
  const slidePaths = slideEntries.map(s => s.image_path);
  let missingSlides: string[] = [];
  let slideCount = 0;

  if (slidePaths.length > 0) {
    missingSlides = await validateSlideImages(sessionId, slidePaths);

    if (missingSlides.length > 0) {
      // Prompt user confirmation
      if (onMissingSlides) {
        const confirmed = await onMissingSlides(missingSlides);
        if (!confirmed) {
          throw new Error('Import cancelled: some slide images are missing');
        }
      } else {
        // No callback provided - fail
        throw new Error(`Import failed: ${missingSlides.length} slide image(s) not found in Storage`);
      }
    }
  }

  // Get existing session_items position to append after
  const { data: existingItems } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  const itemStartPos = (existingItems?.[0]?.position ?? -1) + 1;

  // Filter out _unbatched pseudo-batch
  const realBatches = batchEntries.filter(b => b.name !== '_unbatched');
  const unbatchedBatch = batchEntries.find(b => b.name === '_unbatched');

  // Sort all entries by position to maintain import order
  const sortedEntries = [...data.batches].sort((a, b) => a.position - b.position);

  // Track inserted batches with their original positions
  const insertedBatches: Array<{ id: string; name: string; originalPosition: number }> = [];
  const insertedSessionItems: Array<{ item_type: 'batch' | 'slide'; position: number; batch_id?: string; slide_image_path?: string; slide_caption?: string | null; slide_notes?: string | null }> = [];

  let currentItemPosition = itemStartPos;

  // Process entries in position order
  for (const entry of sortedEntries) {
    if ('type' in entry && entry.type === 'slide') {
      // Skip slides with missing images
      if (missingSlides.includes(entry.image_path)) {
        continue;
      }

      // Create session_item for slide
      insertedSessionItems.push({
        item_type: 'slide',
        position: currentItemPosition++,
        slide_image_path: entry.image_path,
        slide_caption: entry.caption,
        slide_notes: entry.notes,
      });
      slideCount++;
    } else if ('questions' in entry && entry.name !== '_unbatched') {
      // Insert batch first to get ID
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          session_id: sessionId,
          name: entry.name,
          position: currentItemPosition, // Batch position matches session_item position
          status: 'pending' as const,
        })
        .select('id, name')
        .single();

      if (batchError) {
        throw new Error(`Failed to import batch "${entry.name}": ${batchError.message}`);
      }

      insertedBatches.push({
        id: batch.id,
        name: batch.name,
        originalPosition: entry.position,
      });

      // Create session_item for batch
      insertedSessionItems.push({
        item_type: 'batch',
        position: currentItemPosition++,
        batch_id: batch.id,
      });

      // Insert questions for this batch
      const questionInserts = entry.questions.map((q, idx) => ({
        session_id: sessionId,
        batch_id: batch.id,
        text: q.text,
        type: q.type,
        options: q.options,
        anonymous: q.anonymous,
        position: idx,
        status: 'pending' as const,
        template_id: q.template_id ? (templateMap.get(q.template_id) ?? null) : null,
      }));

      const { error: qError } = await supabase
        .from('questions')
        .insert(questionInserts);

      if (qError) {
        throw new Error(`Failed to import questions for batch "${entry.name}": ${qError.message}`);
      }
    }
  }

  // Handle unbatched questions (create questions without batch, no session_item)
  let unbatchedQuestionCount = 0;
  if (unbatchedBatch) {
    const unbatchedInserts = unbatchedBatch.questions.map((q, idx) => ({
      session_id: sessionId,
      batch_id: null,
      text: q.text,
      type: q.type,
      options: q.options,
      anonymous: q.anonymous,
      position: currentItemPosition + idx,
      status: 'pending' as const,
      template_id: q.template_id ? (templateMap.get(q.template_id) ?? null) : null,
    }));

    if (unbatchedInserts.length > 0) {
      const { error: qError } = await supabase
        .from('questions')
        .insert(unbatchedInserts);

      if (qError) {
        throw new Error(`Failed to import unbatched questions: ${qError.message}`);
      }
      unbatchedQuestionCount = unbatchedInserts.length;
    }
  }

  // Insert all session_items
  if (insertedSessionItems.length > 0) {
    const sessionItemInserts = insertedSessionItems.map(item => ({
      session_id: sessionId,
      item_type: item.item_type,
      position: item.position,
      batch_id: item.batch_id ?? null,
      slide_image_path: item.slide_image_path ?? null,
      slide_caption: item.slide_caption ?? null,
      slide_notes: item.slide_notes ?? null,
    }));

    const { error: itemError } = await supabase
      .from('session_items')
      .insert(sessionItemInserts);

    if (itemError) {
      throw new Error(`Failed to create session items: ${itemError.message}`);
    }
  }

  // Calculate total question count
  const totalQuestions = insertedBatches.reduce((sum, batch) => {
    const entry = realBatches.find(b => b.name === batch.name);
    return sum + (entry?.questions.length ?? 0);
  }, 0) + unbatchedQuestionCount;

  return {
    batchCount: insertedBatches.length,
    questionCount: totalQuestions,
    templateCount: templateMap.size,
    slideCount,
    missingSlideCount: missingSlides.length,
  };
}
