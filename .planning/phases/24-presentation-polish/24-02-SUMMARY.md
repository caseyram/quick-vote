---
phase: 24-presentation-polish
plan: 02
subsystem: color-picker-ui
tags:
  - color-picker
  - auto-contrast
  - chart-adaptation
  - ui-components
dependency_graph:
  requires:
    - color-contrast-utilities
    - background-color-infrastructure
  provides:
    - color-picker-ui
    - adaptive-chart-rendering
  affects:
    - editor-toolbar
    - batch-results-projection
tech_stack:
  added: []
  patterns:
    - click-outside-detection
    - adaptive-color-mapping
    - luminance-based-text-color
key_files:
  created: []
  modified:
    - src/components/editor/EditorToolbar.tsx
    - src/components/BatchResultsProjection.tsx
decisions:
  - HexColorPicker and HexColorInput from react-colorful provide wheel + text input in single UI
  - Click-outside detection uses mousedown listener with ref-based containment check
  - Color picker positioned with absolute positioning (top-10 left-0) below the swatch button
  - Chart color adaptation uses 3.0 minimum contrast ratio (WCAG AA minimum for graphics)
  - Reason card background adapts to light/dark (bg-white/10 vs bg-black/10) based on text mode
metrics:
  duration_minutes: 6
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
  completed_at: 2026-02-13T14:17:30Z
---

# Phase 24 Plan 02: Color Picker UI & Adaptive Charts Summary

**One-liner:** Interactive color picker in template editor with automatic chart and text contrast adaptation for custom backgrounds.

## What Was Built

### Color Picker UI (EditorToolbar)
- **Visual color picker** with HexColorPicker wheel and HexColorInput text field from react-colorful library
- **Color swatch button** displays current background color (defaults to #1a1a2e dark blue-gray)
- **Click-outside detection** closes picker when clicking outside using mousedown event listener with ref containment check
- **Live preview** updates editor preview immediately when color changes via store setBackgroundColor action
- **Toolbar placement** positioned in center section after response template selector with visual separator

### Adaptive Chart Colors (BatchResultsProjection)
- **Background color prop** added to component interface (optional, defaults to #1a1a2e)
- **Automatic text color switching** based on background luminance using getTextColor utility
- **Dynamic color classes** for headings (text-white/text-gray-900) and subtitles (text-gray-400/text-gray-600)
- **Chart color adaptation** applies getAdaptiveChartColor to ensure 3.0+ contrast ratio with custom backgrounds
- **Reason card backgrounds** adapt from bg-white/10 (dark mode) to bg-black/10 (light mode)
- **Results ready screen** text colors adapt to background luminance

### Integration
- Color picker state managed in template editor store (backgroundColor field from Plan 01)
- Color utilities from Plan 01 (getTextColor, getAdaptiveChartColor) integrated for automatic contrast
- PresentationView already passing backgroundColor prop (added in separate commit 3b1ea0b)

## Deviations from Plan

None - plan executed exactly as written. All planned functionality delivered.

## Verification Results

- TypeScript compilation: PASSED (`npx tsc --noEmit`)
- Production build: PASSED (`npm run build`)
- Color picker imports: CONFIRMED (HexColorPicker, HexColorInput from react-colorful)
- Click-outside detection: CONFIRMED (useEffect with mousedown listener and ref check)
- Adaptive chart colors: CONFIRMED (getAdaptiveChartColor applied to chartData)
- Dynamic text colors: CONFIRMED (headingColor, subTextColor computed from getTextColor)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add color picker to EditorToolbar with click-outside handling | a3c6b33 | EditorToolbar.tsx |
| 2 | Adapt BatchResultsProjection for auto-contrast charts and text | 5e21228 | BatchResultsProjection.tsx |

## Requirements Met

- **PRES-02**: Admin can set session background color via full color picker (wheel + hex input) in template editor toolbar
- **PRES-03**: Text and chart colors adapt for contrast when background changes
- Color picker has click-outside-to-close behavior
- Live preview reflects color changes immediately (via store integration from Plan 01)

## Technical Details

### Color Picker Implementation
The color picker uses react-colorful's HexColorPicker (visual wheel) and HexColorInput (text field) components. State management includes:
- `showColorPicker` local state for open/closed
- `colorPickerRef` for click-outside detection
- `backgroundColor` and `setBackgroundColor` from template editor store

Click-outside detection pattern:
```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
      setShowColorPicker(false);
    }
  }
  if (showColorPicker) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showColorPicker]);
```

### Chart Color Adaptation
Chart colors adapt using HSL color space manipulation:
1. Convert original color to HSL
2. Check contrast ratio against background
3. If below 3.0, adjust lightness (+30 for dark backgrounds, -30 for light backgrounds)
4. Convert back to hex

Text color adaptation uses WCAG luminance calculation:
- Background luminance > 0.5 → dark text (text-gray-900, text-gray-600)
- Background luminance ≤ 0.5 → light text (text-white, text-gray-400)

## Next Steps

- **Plan 03**: Additional presentation polish features (if any remain in phase)
- **Future**: Load backgroundColor from session template in live presentation view (currently hardcoded to #1a1a2e)
- **Future**: Extend adaptive color system to other projection components (QuestionProjection, SlideProjection)

## Self-Check

Verifying claimed files and commits exist:

- FOUND: src/components/editor/EditorToolbar.tsx (modified)
- FOUND: src/components/BatchResultsProjection.tsx (modified)
- FOUND: commit a3c6b33
- FOUND: commit 5e21228

## Self-Check: PASSED
