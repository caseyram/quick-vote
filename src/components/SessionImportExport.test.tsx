import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionImportExport } from './SessionImportExport';

// Mock session store
const mockQuestions = vi.fn((): any[] => []);
const mockBatches = vi.fn((): any[] => []);

vi.mock('../stores/session-store', () => ({
  useSessionStore: (selector: (state: any) => any) => {
    const state = {
      questions: mockQuestions(),
      batches: mockBatches(),
    };
    return selector(state);
  },
}));

// Mock template store
const mockTemplates = vi.fn((): any[] => []);

vi.mock('../stores/template-store', () => ({
  useTemplateStore: (selector: (state: any) => any) => {
    const state = {
      templates: mockTemplates(),
    };
    return selector(state);
  },
}));

// Mock session-import functions
const mockValidateImportFile = vi.fn();
const mockImportSessionData = vi.fn();
const mockExportSessionData = vi.fn();

vi.mock('../lib/session-import', () => ({
  validateImportFile: (...args: unknown[]) => mockValidateImportFile(...args),
  importSessionData: (...args: unknown[]) => mockImportSessionData(...args),
  exportSessionData: (...args: unknown[]) => mockExportSessionData(...args),
}));

// Mock session-export functions
const mockDownloadJSON = vi.fn();
const mockGenerateExportFilename = vi.fn();

vi.mock('../lib/session-export', () => ({
  downloadJSON: (...args: unknown[]) => mockDownloadJSON(...args),
  generateExportFilename: (...args: unknown[]) => mockGenerateExportFilename(...args),
}));

describe('SessionImportExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuestions.mockReturnValue([]);
    mockBatches.mockReturnValue([]);
    mockTemplates.mockReturnValue([]);
    mockExportSessionData.mockReturnValue('{}');
    mockGenerateExportFilename.mockReturnValue('session-export.json');
  });

  it('renders import and export buttons', () => {
    render(<SessionImportExport sessionId="s1" />);

    expect(screen.getByText('Import JSON')).toBeDefined();
    expect(screen.getByText('Export JSON')).toBeDefined();
  });

  it('disables export button when no content', () => {
    mockQuestions.mockReturnValue([]);
    mockBatches.mockReturnValue([]);

    render(<SessionImportExport sessionId="s1" />);

    const exportBtn = screen.getByText('Export JSON');
    expect(exportBtn.hasAttribute('disabled')).toBe(true);
  });

  it('enables export button when questions exist', () => {
    mockQuestions.mockReturnValue([{ id: 'q1', text: 'Test' }]);

    render(<SessionImportExport sessionId="s1" />);

    const exportBtn = screen.getByText('Export JSON');
    expect(exportBtn.hasAttribute('disabled')).toBe(false);
  });

  it('enables export button when batches exist', () => {
    mockBatches.mockReturnValue([{ id: 'b1', name: 'Batch' }]);

    render(<SessionImportExport sessionId="s1" />);

    const exportBtn = screen.getByText('Export JSON');
    expect(exportBtn.hasAttribute('disabled')).toBe(false);
  });

  it('handles export click', async () => {
    mockQuestions.mockReturnValue([{ id: 'q1', text: 'Test' }]);

    render(<SessionImportExport sessionId="s1" sessionName="My Session" />);

    fireEvent.click(screen.getByText('Export JSON'));

    expect(mockExportSessionData).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      'My Session',
      expect.any(Array)
    );
    expect(mockGenerateExportFilename).toHaveBeenCalledWith('My Session');
    expect(mockDownloadJSON).toHaveBeenCalled();

    // Shows "Downloaded!" temporarily
    await waitFor(() => {
      expect(screen.getByText('Downloaded!')).toBeDefined();
    });
  });

  it('shows validation error on invalid file', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: false,
      error: 'Invalid JSON format',
    });

    render(<SessionImportExport sessionId="s1" />);

    // Simulate file selection
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['invalid'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON format')).toBeDefined();
    });
  });

  it('shows preview and import button on valid file', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: true,
      data: {
        batches: [
          { name: 'Batch 1', position: 0, questions: [{ text: 'Q1' }, { text: 'Q2' }] },
        ],
      },
    });

    render(<SessionImportExport sessionId="s1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Ready to import/)).toBeDefined();
      expect(screen.getByText('Import')).toBeDefined();
    });
  });

  it('imports data when clicking Import button', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: true,
      data: {
        batches: [
          { name: 'Batch 1', position: 0, questions: [{ text: 'Q1' }] },
        ],
      },
    });
    mockImportSessionData.mockResolvedValue({ batchCount: 1, questionCount: 1, templateCount: 0 });

    const onComplete = vi.fn();
    render(<SessionImportExport sessionId="s1" onImportComplete={onComplete} />);

    // Select file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(mockImportSessionData).toHaveBeenCalledWith('s1', expect.any(Object));
      expect(onComplete).toHaveBeenCalledWith({ batchCount: 1, questionCount: 1, templateCount: 0 });
    });
  });

  it('shows import error', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: true,
      data: {
        batches: [
          { name: 'Batch 1', position: 0, questions: [{ text: 'Q1' }] },
        ],
      },
    });
    mockImportSessionData.mockRejectedValue(new Error('Database error'));

    render(<SessionImportExport sessionId="s1" />);

    // Select file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeDefined();
    });
  });

  it('cancels import preview', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: true,
      data: {
        batches: [
          { name: 'Batch 1', position: 0, questions: [{ text: 'Q1' }] },
        ],
      },
    });

    render(<SessionImportExport sessionId="s1" />);

    // Select file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Ready to import')).toBeNull();
    });
  });

  it('dismisses validation error', async () => {
    mockValidateImportFile.mockResolvedValue({
      success: false,
      error: 'Invalid file',
    });

    render(<SessionImportExport sessionId="s1" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['invalid'], 'test.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Invalid file')).toBeDefined();
    });

    // Click dismiss button (aria-label="Dismiss")
    fireEvent.click(screen.getByLabelText('Dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('Invalid file')).toBeNull();
    });
  });
});
