import { describe, it, expect, beforeEach } from 'vitest';
import {
  questionsToTemplates,
  batchesToTemplates,
  templatesToJson,
  jsonToTemplates,
  getSavedTemplates,
  saveTemplate,
  deleteTemplate,
} from './question-templates';
import type { Question, Batch } from '../types/database';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: crypto.randomUUID(),
    session_id: 's1',
    text: 'Do you agree?',
    type: 'agree_disagree',
    options: null,
    position: 0,
    anonymous: true,
    status: 'pending',
    created_at: new Date().toISOString(),
    batch_id: null,
    template_id: null,
    ...overrides,
  };
}

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: crypto.randomUUID(),
    session_id: 's1',
    name: 'Test Batch',
    position: 0,
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('questionsToTemplates', () => {
  it('strips runtime fields from questions and preserves position', () => {
    const questions = [
      makeQuestion({ text: 'Q1', type: 'agree_disagree', anonymous: true, position: 0 }),
      makeQuestion({ text: 'Q2', type: 'multiple_choice', options: ['A', 'B'], anonymous: false, position: 2 }),
    ];
    const templates = questionsToTemplates(questions, []);

    expect(templates).toEqual([
      { text: 'Q1', type: 'agree_disagree', options: null, anonymous: true, batchIndex: null, position: 0 },
      { text: 'Q2', type: 'multiple_choice', options: ['A', 'B'], anonymous: false, batchIndex: null, position: 2 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(questionsToTemplates([], [])).toEqual([]);
  });

  it('includes batch index for batched questions', () => {
    const batch = makeBatch({ id: 'batch-1', position: 0 });
    const questions = [
      makeQuestion({ text: 'Q1', batch_id: 'batch-1', position: 1 }),
      makeQuestion({ text: 'Q2', batch_id: null, position: 3 }),
    ];
    const templates = questionsToTemplates(questions, [batch]);

    expect(templates[0].batchIndex).toBe(0);
    expect(templates[0].position).toBe(1);
    expect(templates[1].batchIndex).toBeNull();
    expect(templates[1].position).toBe(3);
  });
});

describe('batchesToTemplates', () => {
  it('converts batches to templates sorted by position', () => {
    const batches = [
      makeBatch({ name: 'B2', position: 1 }),
      makeBatch({ name: 'B1', position: 0 }),
    ];
    const templates = batchesToTemplates(batches);

    expect(templates).toEqual([
      { name: 'B1', position: 0 },
      { name: 'B2', position: 1 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(batchesToTemplates([])).toEqual([]);
  });
});

describe('templatesToJson', () => {
  it('serializes templates to formatted JSON', () => {
    const templates = [{ text: 'Q1', type: 'agree_disagree' as const, options: null, anonymous: true, batchIndex: null, position: 0 }];
    const json = templatesToJson(templates);
    expect(JSON.parse(json)).toEqual(templates);
    // Check it's formatted (indented)
    expect(json).toContain('\n');
  });
});

describe('jsonToTemplates', () => {
  it('parses valid JSON array with position defaulting to index', () => {
    const input = JSON.stringify([
      { text: 'Q1', type: 'agree_disagree' },
      { text: 'Q2', type: 'multiple_choice', options: ['A', 'B'], anonymous: false, batchIndex: 0, position: 5 },
    ]);
    const result = jsonToTemplates(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Q1', type: 'agree_disagree', options: null, anonymous: true, batchIndex: null, position: 0 });
    expect(result[1]).toEqual({ text: 'Q2', type: 'multiple_choice', options: ['A', 'B'], anonymous: false, batchIndex: 0, position: 5 });
  });

  it('defaults anonymous to true and position to index', () => {
    const input = JSON.stringify([{ text: 'Q1', type: 'agree_disagree' }]);
    const result = jsonToTemplates(input);
    expect(result[0].anonymous).toBe(true);
    expect(result[0].position).toBe(0);
  });

  it('respects explicit anonymous: false', () => {
    const input = JSON.stringify([{ text: 'Q1', type: 'agree_disagree', anonymous: false }]);
    const result = jsonToTemplates(input);
    expect(result[0].anonymous).toBe(false);
  });

  it('throws on invalid JSON', () => {
    expect(() => jsonToTemplates('not json')).toThrow('Invalid JSON');
  });

  it('throws when input is not an array', () => {
    expect(() => jsonToTemplates('{"text":"Q1"}')).toThrow('Expected a JSON array');
  });

  it('throws when item is not an object', () => {
    expect(() => jsonToTemplates('["string"]')).toThrow('Item 0 is not an object');
  });

  it('throws when text is missing', () => {
    expect(() => jsonToTemplates('[{"type":"agree_disagree"}]')).toThrow('"text" is required');
  });

  it('throws when text is empty string', () => {
    expect(() => jsonToTemplates('[{"text":"  ","type":"agree_disagree"}]')).toThrow('"text" is required');
  });

  it('throws when type is invalid', () => {
    expect(() => jsonToTemplates('[{"text":"Q1","type":"invalid"}]')).toThrow('"type" must be');
  });

  it('trims whitespace from text', () => {
    const input = JSON.stringify([{ text: '  Q1  ', type: 'agree_disagree' }]);
    expect(jsonToTemplates(input)[0].text).toBe('Q1');
  });

  it('converts options to strings for multiple_choice', () => {
    const input = JSON.stringify([{ text: 'Q1', type: 'multiple_choice', options: [1, 2, 3] }]);
    const result = jsonToTemplates(input);
    expect(result[0].options).toEqual(['1', '2', '3']);
  });

  it('sets options to null for agree_disagree even if provided', () => {
    const input = JSON.stringify([{ text: 'Q1', type: 'agree_disagree', options: ['A'] }]);
    const result = jsonToTemplates(input);
    expect(result[0].options).toBeNull();
  });

  it('sets options to null for multiple_choice when not an array', () => {
    const input = JSON.stringify([{ text: 'Q1', type: 'multiple_choice', options: 'not-array' }]);
    const result = jsonToTemplates(input);
    expect(result[0].options).toBeNull();
  });
});

describe('localStorage template CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getSavedTemplates returns empty array when no data', () => {
    expect(getSavedTemplates()).toEqual([]);
  });

  it('getSavedTemplates returns empty array on corrupted data', () => {
    localStorage.setItem('quickvote_templates', 'not-json');
    expect(getSavedTemplates()).toEqual([]);
  });

  it('saveTemplate persists a template', () => {
    const question = makeQuestion({ text: 'Q1' });
    saveTemplate('My Template', [question], []);
    const saved = getSavedTemplates();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Template');
    expect(saved[0].questions).toHaveLength(1);
    expect(saved[0].batches).toHaveLength(0);
    expect(saved[0].createdAt).toBeDefined();
  });

  it('saveTemplate persists batches with questions', () => {
    const batch = makeBatch({ id: 'batch-1', name: 'Test Batch', position: 0 });
    const question = makeQuestion({ text: 'Q1', batch_id: 'batch-1', template_id: null });
    saveTemplate('With Batch', [question], [batch]);
    const saved = getSavedTemplates();
    expect(saved[0].batches).toHaveLength(1);
    expect(saved[0].batches[0].name).toBe('Test Batch');
    expect(saved[0].questions[0].batchIndex).toBe(0);
  });

  it('saveTemplate appends to existing templates', () => {
    saveTemplate('T1', [makeQuestion()], []);
    saveTemplate('T2', [makeQuestion()], []);
    expect(getSavedTemplates()).toHaveLength(2);
  });

  it('deleteTemplate removes by name', () => {
    saveTemplate('T1', [makeQuestion()], []);
    saveTemplate('T2', [makeQuestion()], []);
    deleteTemplate('T1');
    const saved = getSavedTemplates();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('T2');
  });

  it('deleteTemplate is no-op for nonexistent name', () => {
    saveTemplate('T1', [makeQuestion()], []);
    deleteTemplate('Nonexistent');
    expect(getSavedTemplates()).toHaveLength(1);
  });
});
