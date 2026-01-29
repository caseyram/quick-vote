import { supabase } from './supabase';
import type { Question, Batch, VoteType } from '../types/database';

export interface QuestionTemplate {
  text: string;
  type: VoteType;
  options: string[] | null;
  anonymous: boolean;
  batchIndex: number | null; // Index into batches array, null = unbatched
  position: number; // Original position for ordering
}

export interface BatchTemplate {
  name: string;
  position: number;
}

export interface SavedTemplate {
  name: string;
  questions: QuestionTemplate[];
  batches: BatchTemplate[];
  createdAt: string;
}

const STORAGE_KEY = 'quickvote_templates';

export function questionsToTemplates(questions: Question[], batches: Batch[]): QuestionTemplate[] {
  // Create a map from batch_id to index in the batches array (sorted by position)
  const sortedBatches = [...batches].sort((a, b) => a.position - b.position);
  const batchIdToIndex = new Map<string, number>();
  sortedBatches.forEach((b, idx) => batchIdToIndex.set(b.id, idx));

  return questions.map((q) => ({
    text: q.text,
    type: q.type,
    options: q.options,
    anonymous: q.anonymous,
    batchIndex: q.batch_id ? (batchIdToIndex.get(q.batch_id) ?? null) : null,
    position: q.position,
  }));
}

export function batchesToTemplates(batches: Batch[]): BatchTemplate[] {
  return [...batches]
    .sort((a, b) => a.position - b.position)
    .map((b) => ({
      name: b.name,
      position: b.position,
    }));
}

export function templatesToJson(templates: QuestionTemplate[]): string {
  return JSON.stringify(templates, null, 2);
}

export function jsonToTemplates(json: string): QuestionTemplate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array');
  }

  return parsed.map((item: unknown, index: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item ${index} is not an object`);
    }
    const obj = item as Record<string, unknown>;

    if (typeof obj.text !== 'string' || !obj.text.trim()) {
      throw new Error(`Item ${index}: "text" is required and must be a non-empty string`);
    }
    if (obj.type !== 'agree_disagree' && obj.type !== 'multiple_choice') {
      throw new Error(`Item ${index}: "type" must be "agree_disagree" or "multiple_choice"`);
    }

    const options =
      obj.type === 'multiple_choice'
        ? Array.isArray(obj.options)
          ? (obj.options as unknown[]).map((o) => String(o))
          : null
        : null;

    return {
      text: obj.text.trim(),
      type: obj.type as VoteType,
      options,
      anonymous: typeof obj.anonymous === 'boolean' ? obj.anonymous : true,
      batchIndex: typeof obj.batchIndex === 'number' ? obj.batchIndex : null,
      position: typeof obj.position === 'number' ? obj.position : index,
    };
  });
}

export function getSavedTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTemplate[];
    // Backwards compatibility: add empty batches array if missing, default positions
    return parsed.map((t) => ({
      ...t,
      batches: (t.batches ?? []).map((b, idx) => ({
        ...b,
        position: b.position ?? idx,
      })),
      questions: t.questions.map((q, idx) => ({
        ...q,
        batchIndex: q.batchIndex ?? null,
        position: q.position ?? idx,
      })),
    }));
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, questions: Question[], batches: Batch[]): void {
  const templates = getSavedTemplates();
  templates.push({
    name,
    questions: questionsToTemplates(questions, batches),
    batches: batchesToTemplates(batches),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function deleteTemplate(name: string): void {
  const templates = getSavedTemplates().filter((t) => t.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export async function bulkInsertQuestions(
  sessionId: string,
  questionTemplates: QuestionTemplate[],
  batchTemplates: BatchTemplate[],
  startQuestionPosition: number,
  startBatchPosition: number
): Promise<{ questions: Question[]; batches: Batch[] }> {
  // 1. Create batches first (if any)
  const createdBatches: Batch[] = [];
  if (batchTemplates.length > 0) {
    const batchRows = batchTemplates.map((b) => ({
      session_id: sessionId,
      name: b.name,
      position: startBatchPosition + b.position,
      status: 'pending' as const,
    }));

    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .insert(batchRows)
      .select();

    if (batchError) throw batchError;
    createdBatches.push(...(batchData ?? []));
  }

  // 2. Map batch index to created batch ID (match by sorted order)
  const sortedCreatedBatches = [...createdBatches].sort((a, b) => a.position - b.position);
  const batchIndexToId = new Map<number, string>();
  sortedCreatedBatches.forEach((b, idx) => {
    batchIndexToId.set(idx, b.id);
  });

  // 3. Create questions with batch_id references, preserving original positions
  const questionRows = questionTemplates.map((t) => ({
    session_id: sessionId,
    text: t.text,
    type: t.type,
    options: t.options,
    anonymous: t.anonymous,
    position: startQuestionPosition + t.position,
    status: 'pending' as const,
    batch_id: t.batchIndex !== null ? (batchIndexToId.get(t.batchIndex) ?? null) : null,
  }));

  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .insert(questionRows)
    .select();

  if (questionError) throw questionError;

  return {
    questions: questionData ?? [],
    batches: createdBatches,
  };
}
