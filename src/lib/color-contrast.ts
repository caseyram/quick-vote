/**
 * Color contrast utilities for WCAG compliance
 */

/**
 * Parse hex color to RGB
 * @param hex - Hex color string (with or without #)
 * @returns RGB object with r, g, b values (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert sRGB channel to linear RGB (gamma correction)
 * @param channel - RGB channel value (0-255)
 * @returns Linear RGB value (0-1)
 */
function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance using WCAG formula
 * @param hex - Hex color string
 * @returns Relative luminance (0-1)
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = sRGBtoLinear(r);
  const G = sRGBtoLinear(g);
  const B = sRGBtoLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Determine if light or dark text should be used on a given background
 * @param backgroundHex - Background hex color
 * @returns 'light' for white text, 'dark' for black text
 */
export function getTextColor(backgroundHex: string): 'light' | 'dark' {
  const luminance = getRelativeLuminance(backgroundHex);
  return luminance > 0.5 ? 'dark' : 'light';
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 * @param hex1 - First hex color
 * @param hex2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}
