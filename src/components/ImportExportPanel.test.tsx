import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Question } from '../types/database';

const mockQuestions: Question[] = [
  {
    id: 'q1', session_id: 's1', text: 'First', type: 'agree_disagree',
    options: null, position: 0, anonymous: false, status: 'pending', created_at: new Date().toISOString(),
  },
];

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (s: { questions: Question[] }) => unknown) => selector({ questions: mockQuestions })),
    {
      getState: vi.fn(() => ({ addQuestion: vi.fn() })),
    }
  ),
}));

vi.mock('../lib/question-templates', () => ({
  questionsToTemplates: vi.fn(() => [{ text: 'First', type: 'agree_disagree', options: null, anonymous: false }]),
  templatesToJson: vi.fn(() => '[{"text":"First","type":"agree_disagree","options":null,"anonymous":false}]'),
  jsonToTemplates: vi.fn((json: string) => {
    const parsed = JSON.parse(json);
    return parsed;
  }),
  bulkInsertQuestions: vi.fn().mockResolvedValue([]),
}));

import { ImportExportPanel } from './ImportExportPanel';

describe('ImportExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders Import and Export buttons', () => {
    render(<ImportExportPanel sessionId="s1" />);
    expect(screen.getByText('Import JSON')).toBeDefined();
    expect(screen.getByText('Export JSON')).toBeDefined();
  });

  it('copies JSON to clipboard on export', async () => {
    render(<ImportExportPanel sessionId="s1" />);
    fireEvent.click(screen.getByText('Export JSON'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('opens import modal when Import clicked', () => {
    render(<ImportExportPanel sessionId="s1" />);
    fireEvent.click(screen.getByText('Import JSON'));
    expect(screen.getByText('Import Questions')).toBeDefined();
    expect(screen.getByText('Paste a JSON array of question templates.')).toBeDefined();
  });

  it('closes import modal on Cancel', () => {
    render(<ImportExportPanel sessionId="s1" />);
    fireEvent.click(screen.getByText('Import JSON'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Import Questions')).toBeNull();
  });

  it('disables import button when textarea is empty', () => {
    render(<ImportExportPanel sessionId="s1" />);
    fireEvent.click(screen.getByText('Import JSON'));
    const importBtn = screen.getByText('Import') as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true);
  });

  it('enables import button when text is entered', () => {
    render(<ImportExportPanel sessionId="s1" />);
    fireEvent.click(screen.getByText('Import JSON'));
    const textarea = screen.getByPlaceholderText(/\[/);
    fireEvent.change(textarea, { target: { value: '[{"text":"Q","type":"agree_disagree","options":null,"anonymous":true}]' } });
    const importBtn = screen.getByText('Import') as HTMLButtonElement;
    expect(importBtn.disabled).toBe(false);
  });
});
