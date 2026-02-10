import { z } from 'zod';
import { supabase } from './supabase';

// ============================================================================
// Export Schemas (full fidelity with votes and participant_id)
// ============================================================================

// Template in export
const TemplateExportSchema = z.object({
  name: z.string(),
  options: z.array(z.string()),
});

// Vote in export (includes participant_id for full fidelity per CONTEXT.md)
const VoteExportSchema = z.object({
  participant_id: z.string(),
  value: z.string(),
  reason: z.string().nullable(),
});

// Question in export
const QuestionExportSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  template_id: z.string().nullable(),
  votes: z.array(VoteExportSchema),
});

// Batch in export
const BatchExportSchema = z.object({
  name: z.string(),
  position: z.number(),
  questions: z.array(QuestionExportSchema),
});

// Full session export schema
export const SessionExportSchema = z.object({
  session_name: z.string(),
  created_at: z.string(),
  batches: z.array(BatchExportSchema),
  templates: z.array(TemplateExportSchema).optional(),
});

export type SessionExport = z.infer<typeof SessionExportSchema>;

// ============================================================================
// Import Schemas (structure only, votes ignored per CONTEXT.md)
// ============================================================================

const QuestionImportSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['agree_disagree', 'multiple_choice']),
  options: z.array(z.string()).nullable(),
  anonymous: z.boolean(),
  // votes field ignored during import - just validate it exists if present
  votes: z.array(z.any()).optional(),
});

const BatchImportSchema = z.object({
  name: z.string(),
  position: z.number(),
  questions: z.array(QuestionImportSchema),
});

export const ImportSchema = z.object({
  session_name: z.string().optional(),
  created_at: z.string().optional(),
  batches: z.array(BatchImportSchema),
});

export type SessionImport = z.infer<typeof ImportSchema>;

// ============================================================================
// Export Function
// ============================================================================

/**
 * Exports a session's complete data including all questions grouped by batch,
 * and all votes with participant_id and reasons for full data fidelity.
 *
 * Questions without a batch are grouped into a special '_unbatched' pseudo-batch.
 */
export async function exportSession(sessionId: string): Promise<SessionExport> {
  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found');
  }

  // Fetch batches ordered by position
  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .eq('session_id', sessionId)
    .order('position');

  // Fetch all questions ordered by position
  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('position');

  // Fetch all votes
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('session_id', sessionId);

  // Build export structure - questions grouped by batch
  const batchList = batches ?? [];
  const questionList = questions ?? [];
  const voteList = votes ?? [];

  // Collect unique template IDs from questions
  const templateIds = new Set<string>();
  for (const q of questionList) {
    if (q.template_id) {
      templateIds.add(q.template_id);
    }
  }

  // Fetch templates referenced by questions
  let templateData: Array<{ id: string; name: string; options: string[] }> = [];
  if (templateIds.size > 0) {
    const { data } = await supabase
      .from('response_templates')
      .select('id, name, options')
      .in('id', Array.from(templateIds));
    templateData = data ?? [];
  }

  // Build ID-to-name map for questions
  const idToNameMap = new Map<string, string>();
  for (const t of templateData) {
    idToNameMap.set(t.id, t.name);
  }

  // Group questions by batch
  const batchedExport = batchList.map(batch => ({
    name: batch.name,
    position: batch.position,
    questions: questionList
      .filter(q => q.batch_id === batch.id)
      .map(q => ({
        text: q.text,
        type: q.type as 'agree_disagree' | 'multiple_choice',
        options: q.options,
        anonymous: q.anonymous,
        template_id: q.template_id ? (idToNameMap.get(q.template_id) ?? null) : null,
        votes: voteList
          .filter(v => v.question_id === q.id)
          .map(v => ({
            participant_id: v.participant_id,
            value: v.value,
            reason: v.reason,
          })),
      })),
  }));

  // Handle unbatched questions (null batch_id) - create pseudo-batch at the end
  const unbatchedQuestions = questionList.filter(q => !q.batch_id);
  if (unbatchedQuestions.length > 0) {
    batchedExport.push({
      name: '_unbatched',
      position: batchList.length,
      questions: unbatchedQuestions.map(q => ({
        text: q.text,
        type: q.type as 'agree_disagree' | 'multiple_choice',
        options: q.options,
        anonymous: q.anonymous,
        template_id: q.template_id ? (idToNameMap.get(q.template_id) ?? null) : null,
        votes: voteList
          .filter(v => v.question_id === q.id)
          .map(v => ({
            participant_id: v.participant_id,
            value: v.value,
            reason: v.reason,
          })),
      })),
    });
  }

  return {
    session_name: session.title,
    created_at: session.created_at,
    batches: batchedExport,
    templates: templateData.map(t => ({ name: t.name, options: t.options })),
  };
}

// ============================================================================
// Download Utilities
// ============================================================================

/**
 * Downloads data as a JSON file using Blob URL.
 * Properly cleans up the Blob URL after download to prevent memory leaks.
 */
export function downloadJSON(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up to prevent memory leak
}

/**
 * Generates a safe filename for session export.
 * Removes special characters and adds date stamp.
 *
 * Example: "My Test Session!" -> "My-Test-Session-2026-01-28.json"
 */
export function generateExportFilename(sessionName: string): string {
  const safeName = sessionName
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  const date = new Date().toISOString().split('T')[0];
  return `${safeName || 'session'}-${date}.json`;
}
