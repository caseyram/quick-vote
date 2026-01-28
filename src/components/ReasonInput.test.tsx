import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock supabase before importing component
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: (...args: unknown[]) => {
        const result = mockUpdate(...args);
        return result;
      },
    }),
  },
}));

import { ReasonInput } from './ReasonInput';

describe('ReasonInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and save button', () => {
    render(<ReasonInput voteId="v1" existingReason={null} />);
    expect(screen.getByPlaceholderText('Share your perspective...')).toBeDefined();
    expect(screen.getByText('Save Reason')).toBeDefined();
  });

  it('pre-fills with existing reason', () => {
    render(<ReasonInput voteId="v1" existingReason="My reason" />);
    const textarea = screen.getByPlaceholderText('Share your perspective...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('My reason');
  });

  it('shows Reason Saved for existing reason', () => {
    render(<ReasonInput voteId="v1" existingReason="My reason" />);
    expect(screen.getByText('Reason Saved')).toBeDefined();
  });

  it('disables save button when textarea is empty', () => {
    render(<ReasonInput voteId="v1" existingReason={null} />);
    const button = screen.getByText('Save Reason') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables save button when text is entered', () => {
    render(<ReasonInput voteId="v1" existingReason={null} />);
    const textarea = screen.getByPlaceholderText('Share your perspective...');
    fireEvent.change(textarea, { target: { value: 'New reason' } });
    const button = screen.getByText('Save Reason') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('resets saved state on edit', () => {
    render(<ReasonInput voteId="v1" existingReason="Old reason" />);
    expect(screen.getByText('Reason Saved')).toBeDefined();

    const textarea = screen.getByPlaceholderText('Share your perspective...');
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    expect(screen.getByText('Save Reason')).toBeDefined();
  });

  it('calls supabase update on save', async () => {
    render(<ReasonInput voteId="v1" existingReason={null} />);
    const textarea = screen.getByPlaceholderText('Share your perspective...');
    fireEvent.change(textarea, { target: { value: 'My thought' } });
    fireEvent.click(screen.getByText('Save Reason'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ reason: 'My thought' });
    });
  });
});
