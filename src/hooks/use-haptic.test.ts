import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHaptic } from './use-haptic';

describe('useHaptic', () => {
  beforeEach(() => {
    // Reset navigator.vibrate mock
    if ('vibrate' in navigator) {
      vi.restoreAllMocks();
    }
  });

  it('returns tap and confirm functions', () => {
    const { result } = renderHook(() => useHaptic());
    expect(typeof result.current.tap).toBe('function');
    expect(typeof result.current.confirm).toBe('function');
  });

  it('tap calls navigator.vibrate with 30ms when supported', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useHaptic());
    result.current.tap();
    expect(vibrateMock).toHaveBeenCalledWith(30);
  });

  it('confirm calls navigator.vibrate with pattern when supported', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useHaptic());
    result.current.confirm();
    expect(vibrateMock).toHaveBeenCalledWith([40, 30, 40]);
  });
});
