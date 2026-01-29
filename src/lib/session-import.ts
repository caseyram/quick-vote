import { z } from 'zod';
import { supabase } from './supabase';
import type { Question, Batch } from '../types/database';

// Schema for question import (votes ignored per CONTEXT.md)
const QuestionImportSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  position: z.number().optional(), // Original position for interleaving with unbatched questions
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
 */
export function exportSessionData(
  questions: Question[],
  batches: Batch[],
  sessionName?: string
): string {
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
  const exportBatches: Array<{
    name: string;
    position: number;
    questions: Array<{
      text: string;
      type: string;
      options: string[] | null;
      anonymous: boolean;
      position: number;
    }>;
  }> = [];

  // Add actual batches with their questions
  const sortedBatches = [...batches].sort((a, b) => a.position - b.position);
  for (const batch of sortedBatches) {
    const batchQuestions = batchedQuestions.get(batch.id) ?? [];
    const sortedQuestions = [...batchQuestions].sort((a, b) => a.position - b.position);

    exportBatches.push({
      name: batch.name,
      position: batch.position,
      questions: sortedQuestions.map(q => ({
        text: q.text,
        type: q.type,
        options: q.options,
        anonymous: q.anonymous,
        position: q.position,
      })),
    });
  }

  // Add unbatched questions under special '_unbatched' pseudo-batch
  // Position is -1 to indicate this is not a real batch (filtered out during import)
  const unbatched = batchedQuestions.get(null) ?? [];
  if (unbatched.length > 0) {
    const sortedUnbatched = [...unbatched].sort((a, b) => a.position - b.position);
    exportBatches.push({
      name: '_unbatched',
      position: -1,
      questions: sortedUnbatched.map(q => ({
        text: q.text,
        type: q.type,
        options: q.options,
        anonymous: q.anonymous,
        position: q.position,
      })),
    });
  }

  const exportData = {
    session_name: sessionName,
    created_at: new Date().toISOString(),
    batches: exportBatches,
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

  // Separate real batches from _unbatched pseudo-batch
  const batchesToInsert = data.batches.filter(b => b.name !== '_unbatched');
  const unbatchedBatch = data.batches.find(b => b.name === '_unbatched');

  // Build ordered question list FIRST by interleaving batches and unbatched questions
  // Strategy: Sort batches by position, then interleave unbatched questions
  // based on their position values (which indicate where they slot in relative to batches)

  const sortedBatches = [...batchesToInsert].sort((a, b) => a.position - b.position);
  const unbatchedQuestions = (unbatchedBatch?.questions ?? []).map((q, idx) => ({
    question: q,
    position: q.position ?? (10000 + idx), // Fallback to end if no position
  }));

  // Build the final ordered list
  // Unbatched question position N means it comes AFTER the batch at position N-1
  // So position 1 = after batch 0, position 4 = after batch 3, etc.
  const allQuestions: Array<{
    originalBatchPosition: number | null; // null for unbatched, used to map to batch
    question: typeof data.batches[0]['questions'][0];
  }> = [];

  let unbatchedIdx = 0;
  // Sort unbatched by position
  unbatchedQuestions.sort((a, b) => a.position - b.position);

  for (let batchIdx = 0; batchIdx < sortedBatches.length; batchIdx++) {
    const batch = sortedBatches[batchIdx];
    const nextBatchPos = sortedBatches[batchIdx + 1]?.position ?? Infinity;

    // Add all questions from this batch (sorted by their relative position)
    const sortedQuestions = [...batch.questions].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    for (const question of sortedQuestions) {
      allQuestions.push({ originalBatchPosition: batch.position, question });
    }

    // Add any unbatched questions that come between this batch and the next
    // Unbatched position X means it comes after batch at position X-1
    // So if current batch is at position 0 and next is at position 2,
    // unbatched questions with positions 1 would go here
    while (
      unbatchedIdx < unbatchedQuestions.length &&
      unbatchedQuestions[unbatchedIdx].position < nextBatchPos
    ) {
      allQuestions.push({
        originalBatchPosition: null,
        question: unbatchedQuestions[unbatchedIdx].question,
      });
      unbatchedIdx++;
    }
  }

  // Add any remaining unbatched questions at the end
  while (unbatchedIdx < unbatchedQuestions.length) {
    allQuestions.push({
      originalBatchPosition: null,
      question: unbatchedQuestions[unbatchedIdx].question,
    });
    unbatchedIdx++;
  }

  // Calculate correct batch positions based on where their first question appears
  // in the interleaved list (this ensures batch position matches question positions)
  const batchNewPositions = new Map<number, number>(); // originalBatchPosition -> newPosition
  for (let i = 0; i < allQuestions.length; i++) {
    const origPos = allQuestions[i].originalBatchPosition;
    if (origPos !== null && !batchNewPositions.has(origPos)) {
      // First question of this batch - batch position = this question's position
      batchNewPositions.set(origPos, questionStartPos + i);
    }
  }

  // Insert batches with corrected positions
  let insertedBatches: Array<{ id: string; name: string; position: number }> = [];
  if (batchesToInsert.length > 0) {
    const batchInserts = batchesToInsert.map((batch) => ({
      session_id: sessionId,
      name: batch.name,
      position: batchNewPositions.get(batch.position) ?? (batchStartPos + batch.position),
      status: 'pending' as const,
    }));

    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .insert(batchInserts)
      .select('id, name, position');

    if (batchError) {
      throw new Error(`Failed to import batches: ${batchError.message}`);
    }
    insertedBatches = batches ?? [];
  }

  // Create batch original position to ID map for question association
  // Using original position as key since batch names can be duplicated
  const batchIdByOriginalPosition = new Map<number, string>();
  for (const batch of batchesToInsert) {
    const insertedBatch = insertedBatches.find(
      ib => ib.position === batchNewPositions.get(batch.position)
    );
    if (insertedBatch) {
      batchIdByOriginalPosition.set(batch.position, insertedBatch.id);
    }
  }

  // Insert questions in the computed order
  const questionInserts = allQuestions.map((item, idx) => ({
    session_id: sessionId,
    batch_id: item.originalBatchPosition === null
      ? null
      : batchIdByOriginalPosition.get(item.originalBatchPosition) ?? null,
    text: item.question.text,
    type: item.question.type,
    options: item.question.options,
    anonymous: item.question.anonymous,
    position: questionStartPos + idx,
    status: 'pending' as const,
  }));

  if (questionInserts.length > 0) {
    const { error: qError } = await supabase
      .from('questions')
      .insert(questionInserts);

    if (qError) {
      throw new Error(`Failed to import questions: ${qError.message}`);
    }
    totalQuestions = questionInserts.length;
  }

  return {
    batchCount: insertedBatches.length,
    questionCount: totalQuestions,
  };
}
