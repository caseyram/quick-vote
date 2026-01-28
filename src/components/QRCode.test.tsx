import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionQRCode } from './QRCode';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string; size: number }) => (
    <svg data-testid="qr-svg" data-value={props.value} data-size={props.size} />
  ),
}));

describe('SessionQRCode', () => {
  it('returns null when not visible', () => {
    const { container } = render(<SessionQRCode url="https://example.com" visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders QR code when visible in overlay mode', () => {
    render(<SessionQRCode url="https://example.com" visible={true} />);
    expect(screen.getByTestId('qr-svg')).toBeDefined();
    expect(screen.getByText('Scan to join')).toBeDefined();
  });

  it('renders in centered mode without scan text', () => {
    const { container } = render(
      <SessionQRCode url="https://example.com" visible={true} mode="centered" />
    );
    expect(screen.getByTestId('qr-svg')).toBeDefined();
    expect(container.innerHTML).toContain('inline-block');
    expect(screen.queryByText('Scan to join')).toBeNull();
  });

  it('passes url and size to QRCodeSVG', () => {
    render(<SessionQRCode url="https://test.com/session/abc" visible={true} size={200} />);
    const svg = screen.getByTestId('qr-svg');
    expect(svg.getAttribute('data-value')).toBe('https://test.com/session/abc');
    expect(svg.getAttribute('data-size')).toBe('200');
  });

  it('uses default size of 120', () => {
    render(<SessionQRCode url="https://test.com" visible={true} />);
    const svg = screen.getByTestId('qr-svg');
    expect(svg.getAttribute('data-size')).toBe('120');
  });

  it('uses fixed positioning in overlay mode', () => {
    const { container } = render(
      <SessionQRCode url="https://example.com" visible={true} mode="overlay" />
    );
    expect(container.innerHTML).toContain('fixed');
  });
});
