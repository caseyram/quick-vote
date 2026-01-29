import type { QuestionTemplate, BatchTemplate } from './question-templates';

/**
 * CSV format:
 * question,type,options,batch,anonymous
 * "What do you think?",agree_disagree,,1,true
 * "Pick one",multiple_choice,"Option A|Option B|Option C",1,false
 * "Another question",,,2,
 */

const CSV_HEADERS = ['question', 'type', 'options', 'batch', 'anonymous'] as const;

export function generateCsvTemplate(): string {
  const header = CSV_HEADERS.join(',');
  const examples = [
    '"Do you agree with the proposal?",,,,',
    '"How would you rate this?",multiple_choice,"Excellent|Good|Fair|Poor",,',
    '"First batch question",,,1,',
    '"Second batch question",,,1,',
    '"Another batch question",,,2,true',
  ];
  return [header, ...examples].join('\n');
}

export function downloadCsvTemplate(): void {
  const csv = generateCsvTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quickvote-questions-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

export interface CsvParseResult {
  questions: QuestionTemplate[];
  batches: BatchTemplate[];
}

export function parseCsv(csvContent: string): CsvParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Parse and validate header
  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(headerLine);

  // Find column indices (flexible ordering)
  const questionIdx = headers.findIndex(h => h === 'question' || h === 'text');
  const typeIdx = headers.findIndex(h => h === 'type');
  const optionsIdx = headers.findIndex(h => h === 'options');
  const batchIdx = headers.findIndex(h => h === 'batch' || h === 'batch_number' || h === 'group');
  const anonymousIdx = headers.findIndex(h => h === 'anonymous');

  if (questionIdx === -1) {
    throw new Error('CSV must have a "question" or "text" column');
  }

  // Track batches by number
  const batchMap = new Map<number, { name: string; questions: QuestionTemplate[] }>();
  const unbatchedQuestions: QuestionTemplate[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const questionText = values[questionIdx]?.trim();
    if (!questionText) {
      continue; // Skip empty rows
    }

    // Parse type (default to agree_disagree)
    let type: 'agree_disagree' | 'multiple_choice' = 'agree_disagree';
    if (typeIdx !== -1) {
      const typeValue = values[typeIdx]?.trim().toLowerCase();
      if (typeValue === 'multiple_choice' || typeValue === 'mc' || typeValue === 'multiple') {
        type = 'multiple_choice';
      }
    }

    // Parse options for multiple choice
    let options: string[] | null = null;
    if (type === 'multiple_choice' && optionsIdx !== -1) {
      const optionsValue = values[optionsIdx]?.trim();
      if (optionsValue) {
        options = optionsValue.split('|').map(o => o.trim()).filter(o => o.length > 0);
        if (options.length < 2) {
          throw new Error(`Row ${i + 1}: Multiple choice questions need at least 2 options separated by |`);
        }
      } else {
        // Default options if none provided
        options = ['Option A', 'Option B', 'Option C'];
      }
    }

    // Parse anonymous (default to true)
    let anonymous = true;
    if (anonymousIdx !== -1) {
      const anonValue = values[anonymousIdx]?.trim().toLowerCase();
      if (anonValue === 'false' || anonValue === 'no' || anonValue === '0') {
        anonymous = false;
      }
    }

    const template: QuestionTemplate = {
      text: questionText,
      type,
      options,
      anonymous,
      position: 0, // Will be set later
    };

    // Parse batch number
    let batchNum: number | null = null;
    if (batchIdx !== -1) {
      const batchValue = values[batchIdx]?.trim();
      if (batchValue) {
        batchNum = parseInt(batchValue, 10);
        if (isNaN(batchNum) || batchNum < 1) {
          throw new Error(`Row ${i + 1}: Invalid batch number "${batchValue}". Use positive integers.`);
        }
      }
    }

    if (batchNum !== null) {
      if (!batchMap.has(batchNum)) {
        batchMap.set(batchNum, {
          name: `Batch ${batchNum}`,
          questions: [],
        });
      }
      batchMap.get(batchNum)!.questions.push(template);
    } else {
      unbatchedQuestions.push(template);
    }
  }

  // Build result with proper positions
  const batches: BatchTemplate[] = [];
  const questions: QuestionTemplate[] = [];
  let position = 0;

  // Sort batches by number and interleave with unbatched questions
  const sortedBatchNums = Array.from(batchMap.keys()).sort((a, b) => a - b);

  // Add unbatched questions first (they appear at top)
  for (const q of unbatchedQuestions) {
    questions.push({ ...q, position: position++ });
  }

  // Add batches with their questions
  for (const batchNum of sortedBatchNums) {
    const batch = batchMap.get(batchNum)!;
    const batchTemplate: BatchTemplate = {
      name: batch.name,
      position: position++,
      questions: batch.questions.map((q, idx) => ({
        ...q,
        position: idx,
      })),
    };
    batches.push(batchTemplate);
  }

  if (questions.length === 0 && batches.length === 0) {
    throw new Error('No valid questions found in CSV');
  }

  return { questions, batches };
}
