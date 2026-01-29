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

  // Track batches by number (just name and count, not questions)
  const batchMap = new Map<number, { name: string; questionCount: number }>();
  // Temporary storage for all questions before assigning batchIndex
  const unbatchedQuestions: Array<{
    text: string;
    type: 'agree_disagree' | 'multiple_choice';
    options: string[] | null;
    anonymous: boolean;
    batchNum: number | null;
    isBatched: boolean;
  }> = [];

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

    // Track batch numbers for later mapping
    if (batchNum !== null) {
      if (!batchMap.has(batchNum)) {
        batchMap.set(batchNum, { name: `Batch ${batchNum}`, questionCount: 0 });
      }
      batchMap.get(batchNum)!.questionCount++;
    }

    // Store question with its batch number for later processing
    const template = {
      text: questionText,
      type,
      options,
      anonymous,
      batchNum, // Temporary field, will be converted to batchIndex
    };

    if (batchNum !== null) {
      // Will be processed after batches are created
      unbatchedQuestions.push({ ...template, isBatched: true });
    } else {
      unbatchedQuestions.push({ ...template, isBatched: false });
    }
  }

  // Build result with proper positions and batchIndex references
  const batches: BatchTemplate[] = [];
  const questions: QuestionTemplate[] = [];

  // Create batch templates and build batchNum -> batchIndex map
  const sortedBatchNums = Array.from(batchMap.keys()).sort((a, b) => a - b);
  const batchNumToIndex = new Map<number, number>();

  for (let i = 0; i < sortedBatchNums.length; i++) {
    const batchNum = sortedBatchNums[i];
    const batch = batchMap.get(batchNum)!;
    batchNumToIndex.set(batchNum, i);
    batches.push({
      name: batch.name,
      position: i, // Will be adjusted by caller with startBatchPosition
    });
  }

  // Process all questions with proper batchIndex
  let questionPosition = 0;
  for (const q of unbatchedQuestions) {
    const batchIndex = q.batchNum !== null ? (batchNumToIndex.get(q.batchNum) ?? null) : null;
    questions.push({
      text: q.text,
      type: q.type,
      options: q.options,
      anonymous: q.anonymous,
      batchIndex,
      position: questionPosition++,
    });
  }

  if (questions.length === 0 && batches.length === 0) {
    throw new Error('No valid questions found in CSV');
  }

  return { questions, batches };
}
