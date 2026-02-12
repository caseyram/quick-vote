import { describe, it, expect } from 'vitest';
import { exportSessionData, ImportSchema } from './session-import';
import type { Question, Batch } from '../types/database';

describe('session-import', () => {
  describe('exportSessionData', () => {
    it('exports questions grouped by batch', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
        {
          id: 'q2', session_id: 's1', batch_id: 'b1', text: 'Q2', type: 'multiple_choice',
          template_id: null,
          options: ['A', 'B'], position: 1, anonymous: false, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches, 'Test Session');
      const parsed = JSON.parse(result);

      expect(parsed.session_name).toBe('Test Session');
      expect(parsed.batches).toHaveLength(1);
      expect(parsed.batches[0].name).toBe('Batch 1');
      expect(parsed.batches[0].questions).toHaveLength(2);
      expect(parsed.batches[0].questions[0].text).toBe('Q1');
      expect(parsed.batches[0].questions[1].text).toBe('Q2');
    });

    it('exports unbatched questions in _unbatched pseudo-batch', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: null, text: 'Standalone Q', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const result = exportSessionData(questions, [], 'Test');
      const parsed = JSON.parse(result);

      expect(parsed.batches).toHaveLength(1);
      expect(parsed.batches[0].name).toBe('_unbatched');
      expect(parsed.batches[0].position).toBe(-1);
      expect(parsed.batches[0].questions[0].text).toBe('Standalone Q');
    });

    it('exports mixed batched and unbatched questions', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Batched Q', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
        {
          id: 'q2', session_id: 's1', batch_id: null, text: 'Unbatched Q', type: 'agree_disagree',
          template_id: null,
          options: null, position: 1, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches);
      const parsed = JSON.parse(result);

      expect(parsed.batches).toHaveLength(2);
      expect(parsed.batches[0].name).toBe('Batch 1');
      expect(parsed.batches[1].name).toBe('_unbatched');
    });

    it('sorts batches and questions by position', () => {
      const questions: Question[] = [
        {
          id: 'q2', session_id: 's1', batch_id: 'b1', text: 'Q2', type: 'agree_disagree',
          template_id: null,
          options: null, position: 1, anonymous: true, status: 'pending', created_at: '',
        },
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches);
      const parsed = JSON.parse(result);

      // Questions should be sorted by position
      expect(parsed.batches[0].questions[0].text).toBe('Q1');
      expect(parsed.batches[0].questions[1].text).toBe('Q2');
    });

    it('sorts multiple batches by position', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b2', text: 'B2 Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
        {
          id: 'q2', session_id: 's1', batch_id: 'b1', text: 'B1 Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b2', session_id: 's1', name: 'Batch 2', position: 1, status: 'pending', created_at: '' },
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches);
      const parsed = JSON.parse(result);

      // Batches should be sorted by position
      expect(parsed.batches[0].name).toBe('Batch 1');
      expect(parsed.batches[1].name).toBe('Batch 2');
    });

    it('handles empty questions and batches', () => {
      const result = exportSessionData([], []);
      const parsed = JSON.parse(result);

      expect(parsed.batches).toHaveLength(0);
    });

    it('includes created_at timestamp', () => {
      const result = exportSessionData([], [], 'Test');
      const parsed = JSON.parse(result);

      expect(parsed.created_at).toBeDefined();
      expect(new Date(parsed.created_at).getTime()).toBeGreaterThan(0);
    });

    it('preserves question options for multiple choice', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'MC Q', type: 'multiple_choice',
          template_id: null,
          options: ['Option A', 'Option B', 'Option C'], position: 0, anonymous: false, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches);
      const parsed = JSON.parse(result);

      expect(parsed.batches[0].questions[0].options).toEqual(['Option A', 'Option B', 'Option C']);
    });

    it('preserves anonymous flag', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: null, text: 'Anon Q', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
        {
          id: 'q2', session_id: 's1', batch_id: null, text: 'Named Q', type: 'agree_disagree',
          template_id: null,
          options: null, position: 1, anonymous: false, status: 'pending', created_at: '',
        },
      ];

      const result = exportSessionData(questions, []);
      const parsed = JSON.parse(result);

      expect(parsed.batches[0].questions[0].anonymous).toBe(true);
      expect(parsed.batches[0].questions[1].anonymous).toBe(false);
    });

    it('includes template_id on questions when templates provided', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'multiple_choice',
          template_id: 't1',
          options: ['Yes', 'No'], position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const templates = [
        { id: 't1', name: 'Yes/No', options: ['Yes', 'No'] },
      ];

      const result = exportSessionData(questions, batches, 'Test', templates);
      const parsed = JSON.parse(result);

      expect(parsed.batches[0].questions[0].template_id).toBe('Yes/No');
      expect(parsed.templates).toHaveLength(1);
      expect(parsed.templates[0].name).toBe('Yes/No');
      expect(parsed.templates[0].options).toEqual(['Yes', 'No']);
    });

    it('exports template_id as null for questions without templates', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches, 'Test', []);
      const parsed = JSON.parse(result);

      expect(parsed.batches[0].questions[0].template_id).toBe(null);
      expect(parsed.templates).toEqual([]);
    });

    it('exports without templates when no templates parameter provided', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'agree_disagree',
          template_id: null,
          options: null, position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const result = exportSessionData(questions, batches, 'Test');
      const parsed = JSON.parse(result);

      expect(parsed.templates).toEqual([]);
    });

    it('only includes templates referenced by questions', () => {
      const questions: Question[] = [
        {
          id: 'q1', session_id: 's1', batch_id: 'b1', text: 'Q1', type: 'multiple_choice',
          template_id: 't1',
          options: ['Yes', 'No'], position: 0, anonymous: true, status: 'pending', created_at: '',
        },
      ];

      const batches: Batch[] = [
        { id: 'b1', session_id: 's1', name: 'Batch 1', position: 0, status: 'pending', created_at: '' },
      ];

      const templates = [
        { id: 't1', name: 'Yes/No', options: ['Yes', 'No'] },
        { id: 't2', name: 'Agree/Disagree', options: ['Strongly Agree', 'Agree', 'Disagree', 'Strongly Disagree'] },
      ];

      const result = exportSessionData(questions, batches, 'Test', templates);
      const parsed = JSON.parse(result);

      // Only t1 should be in the templates array (t2 is not referenced by any question)
      expect(parsed.templates).toHaveLength(1);
      expect(parsed.templates[0].name).toBe('Yes/No');
    });
  });

  describe('ImportSchema', () => {
    it('validates correct full format', () => {
      const data = {
        session_name: 'Test',
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'agree_disagree', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects empty batches array', () => {
      const data = {
        batches: [],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects batch with empty questions', () => {
      const data = {
        batches: [
          { name: 'Batch 1', position: 0, questions: [] },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects missing batch name', () => {
      const data = {
        batches: [
          { position: 0, questions: [{ text: 'Q1', type: 'agree_disagree', options: null, anonymous: true }] },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects invalid question type', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'invalid_type', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts optional session_name', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'agree_disagree', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts multiple choice with options', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'multiple_choice', options: ['A', 'B', 'C'], anonymous: false },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects empty question text', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: '', type: 'agree_disagree', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts data with templates field', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'multiple_choice', options: ['Yes', 'No'], anonymous: false, template_id: 'Yes/No' },
            ],
          },
        ],
        templates: [
          { name: 'Yes/No', options: ['Yes', 'No'] },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templates).toHaveLength(1);
        expect(result.data.templates![0].name).toBe('Yes/No');
      }
    });

    it('accepts data without templates field (backward compat)', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'agree_disagree', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templates).toBeUndefined();
      }
    });

    it('accepts questions with template_id field', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'multiple_choice', options: ['A', 'B'], anonymous: false, template_id: 'Custom Template' },
            ],
          },
        ],
        templates: [
          { name: 'Custom Template', options: ['A', 'B'] },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        const batch = result.data.batches[0];
        expect('questions' in batch && batch.questions[0].template_id).toBe('Custom Template');
      }
    });

    it('accepts questions without template_id field (backward compat)', () => {
      const data = {
        batches: [
          {
            name: 'Batch 1',
            position: 0,
            questions: [
              { text: 'Q1', type: 'agree_disagree', options: null, anonymous: true },
            ],
          },
        ],
      };

      const result = ImportSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        // template_id is optional, so it should be undefined when not present
        const batch = result.data.batches[0];
        expect('questions' in batch && batch.questions[0].template_id).toBeUndefined();
      }
    });
  });
});
