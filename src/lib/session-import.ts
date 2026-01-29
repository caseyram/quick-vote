import { z } from 'zod';
import { supabase } from './supabase';

// Schema for question import (votes ignored per CONTEXT.md)
const QuestionImportSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  // Votes in import file are ignored (structure only import)
  votes: z.array(z.any()).optional(),
});

// Schema for batch import
const BatchImportSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  position: z.number(),
  questions: z.array(QuestionImportSchema).min(1, 'Each batch must have at least one question'),
});

// Top-level import schema
export const ImportSchema = z.object({
  session_name: z.string().optional(),
  created_at: z.string().optional(),
  batches: z.array(BatchImportSchema).min(1, 'At least one batch is required'),
});

export type ImportData = z.infer<typeof ImportSchema>;

export interface ValidationResult {
  success: boolean;
  data?: ImportData;
  error?: string;
}

/**
 * Validates an import file for proper JSON structure and schema conformance.
 * Checks file extension, size limits, JSON parsing, and Zod schema validation.
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
    const result = ImportSchema.safeParse(parsed);

    if (!result.success) {
      // Format Zod error for user readability
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return { success: false, error: `Validation failed:\n${issues.join('\n')}` };
    }

    return { success: true, data: result.data };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Imports validated session data into the database.
 * Creates batches and questions, preserving batch groupings.
 * Votes in import data are ignored (structure-only import).
 *
 * Note: Import is NOT transactional at database level.
 * If question insert fails after batch insert, batches remain.
 */
export async function importSessionData(
  sessionId: string,
  data: ImportData
): Promise<{ batchCount: number; questionCount: number }> {
  // Get existing batch positions to append after
  const { data: existingBatches } = await supabase
    .from('batches')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  // Get existing question positions to append after
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1);

  const batchStartPos = (existingBatches?.[0]?.position ?? -1) + 1;
  const questionStartPos = (existingQuestions?.[0]?.position ?? -1) + 1;

  let totalQuestions = 0;

  // Filter out _unbatched pseudo-batch (used in export for unbatched questions)
  const batchesToInsert = data.batches.filter(b => b.name !== '_unbatched');

  // Insert batches
  let insertedBatches: Array<{ id: string; name: string }> = [];
  if (batchesToInsert.length > 0) {
    const batchInserts = batchesToInsert.map((batch, idx) => ({
      session_id: sessionId,
      name: batch.name,
      position: batchStartPos + idx,
      status: 'pending' as const,
    }));

    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .insert(batchInserts)
      .select('id, name');

    if (batchError) {
      throw new Error(`Failed to import batches: ${batchError.message}`);
    }
    insertedBatches = batches ?? [];
  }

  // Create batch name to ID map for question association
  const batchIdMap = new Map(insertedBatches.map(b => [b.name, b.id]));

  // Insert questions for each batch
  let questionPos = questionStartPos;
  for (const batch of data.batches) {
    // _unbatched questions have null batch_id
    const batchId = batch.name === '_unbatched' ? null : batchIdMap.get(batch.name) ?? null;

    const questionInserts = batch.questions.map(q => ({
      session_id: sessionId,
      batch_id: batchId,
      text: q.text,
      type: q.type,
      options: q.options,
      anonymous: q.anonymous,
      position: questionPos++,
      status: 'pending' as const,
    }));

    if (questionInserts.length > 0) {
      const { error: qError } = await supabase
        .from('questions')
        .insert(questionInserts);

      if (qError) {
        throw new Error(`Failed to import questions: ${qError.message}`);
      }
      totalQuestions += questionInserts.length;
    }
  }

  return {
    batchCount: insertedBatches.length,
    questionCount: totalQuestions,
  };
}
