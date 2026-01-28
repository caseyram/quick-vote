import { supabase } from './supabase';
import type { Question, VoteType } from '../types/database';

export interface QuestionTemplate {
  text: string;
  type: VoteType;
  options: string[] | null;
  anonymous: boolean;
}

export interface SavedTemplate {
  name: string;
  questions: QuestionTemplate[];
  createdAt: string;
}

const STORAGE_KEY = 'quickvote_templates';

export function questionsToTemplates(questions: Question[]): QuestionTemplate[] {
  return questions.map((q) => ({
    text: q.text,
    type: q.type,
    options: q.options,
    anonymous: q.anonymous,
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
    };
  });
}

export function getSavedTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, questions: Question[]): void {
  const templates = getSavedTemplates();
  templates.push({
    name,
    questions: questionsToTemplates(questions),
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
  templates: QuestionTemplate[],
  startPosition: number
): Promise<Question[]> {
  const rows = templates.map((t, i) => ({
    session_id: sessionId,
    text: t.text,
    type: t.type,
    options: t.options,
    anonymous: t.anonymous,
    position: startPosition + i,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('questions')
    .insert(rows)
    .select();

  if (error) throw error;
  return data ?? [];
}
