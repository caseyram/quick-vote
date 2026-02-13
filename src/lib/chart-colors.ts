/**
 * Adaptive chart color utilities
 */

import { getRelativeLuminance, getContrastRatio, hexToRgb } from './color-contrast';

/**
 * Convert hex to HSL
 * @param hex - Hex color string
 * @returns HSL object with h (0-360), s (0-100), l (0-100)
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  const rInt = Math.round((r + m) * 255);
  const gInt = Math.round((g + m) * 255);
  const bInt = Math.round((b + m) * 255);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rInt)}${toHex(gInt)}${toHex(bInt)}`;
}

/**
 * Get an adaptive chart color that ensures sufficient contrast with background
 * @param originalColor - Original hex color
 * @param backgroundColor - Background hex color
 * @param minContrast - Minimum contrast ratio (default 3.0)
 * @returns Adjusted hex color or original if already sufficient contrast
 */
export function getAdaptiveChartColor(
  originalColor: string,
  backgroundColor: string,
  minContrast: number = 3.0
): string {
  const currentContrast = getContrastRatio(originalColor, backgroundColor);

  if (currentContrast >= minContrast) {
    return originalColor;
  }

  const bgLuminance = getRelativeLuminance(backgroundColor);
  const isDarkBackground = bgLuminance < 0.5;

  const hsl = hexToHsl(originalColor);

  if (isDarkBackground) {
    // Increase lightness for dark backgrounds
    hsl.l = Math.min(100, hsl.l + 30);
  } else {
    // Decrease lightness for light backgrounds
    hsl.l = Math.max(0, hsl.l - 30);
  }

  return hslToHex(hsl.h, hsl.s, hsl.l);
}
