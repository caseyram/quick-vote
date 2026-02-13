# Phase 24: Presentation Polish - Research

**Researched:** 2026-02-13
**Domain:** Slide transitions, color pickers, luminance calculation, batch cover images, dynamic styling
**Confidence:** HIGH

## Summary

Phase 24 adds presentation polish to the existing projection view and template editor: directional slide transitions (~400ms slide in/out), customizable background color with auto-contrast text/charts, and batch cover images displayed during voting. The technical domain spans CSS animations (Motion library for directional slides), color science (luminance calculation for contrast), React color pickers (hex input + wheel), and database schema extension (batch cover image field).

The project already uses Motion (v12.29.2) for animations in PresentationView, with established patterns for slide and crossfade transitions. The challenge is adding directional slide animations (left/right based on navigation), implementing a lightweight color picker in the template editor toolbar, calculating relative luminance to auto-switch text color (WCAG standards), and extending the batch data model to support cover images.

**Primary recommendation:** Use Motion's custom direction variants with AnimatePresence for directional slide transitions, adopt react-colorful (2.8 KB) for the hex color picker, implement WCAG relative luminance formula for auto-contrast (threshold 0.5 for light/dark), store background_color in session_templates blueprint (not database schema), add cover_image_path to batches table and batch blueprints, and use inline styles with CSS variables for dynamic background colors (Tailwind doesn't support runtime color values).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transition feel:**
- Directional slide animation: slide in from right for next, slide in from left for previous
- No visible gap between images during transition
- ~400ms duration (medium speed)
- Transitions apply to ALL sequence item changes (slide-to-slide, slide-to-batch, batch-to-slide, etc.)
- Same slide animation style regardless of item type — consistent feel throughout

**Background color:**
- Full color picker (wheel/slider + hex input) in the template editor toolbar
- Default color: dark blue/gray
- Applies to projection view only — participant view stays default
- Live preview in template editor — color changes reflected in real time
- Color persists in template blueprint

**Batch cover images:**
- Admin can pick from existing slides in the sequence OR upload a new image specifically for the batch
- Placement of cover image control: Claude's discretion (based on existing batch editing UI)
- Cover image displays full-screen on projection while participants answer questions (like a slide)
- Cover image transitions away (slide/fade out) when results are ready to show — clean separation

**Contrast handling:**
- Auto light/dark text switching based on background luminance — no manual text color picker
- Result bars/charts adapt their colors to ensure contrast against the chosen background
- Participant view is not affected — contrast handling only applies to projection

### Claude's Discretion

- Cover image control placement within the batch editing UI
- Exact curated default dark blue/gray hex value
- Luminance threshold for light/dark text switching
- Chart color adaptation algorithm
- Loading/transition states during slide animations

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.29.2 | Directional slide animations | Already used in PresentationView (lines 306-323); supports custom direction variants with AnimatePresence |
| react | 19.0 | UI framework | Project standard |
| tailwindcss | 4.1.18 | Static styling | Project standard; dynamic colors use inline styles |
| zustand | 5.0.5 | Template editor state | Already manages template data; will store background_color in blueprint |

### Supporting (New for Phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-colorful | 5.6.1 (latest) | Hex color picker component | Lightweight (2.8 KB), TypeScript support, HexColorPicker + HexColorInput components, accessible |
| browser-image-compression | 2.0.2 | Cover image upload compression | Already in use for slide uploads (EditorToolbar.tsx); reuse for batch cover images |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-colorful | react-color | react-color is 13x larger (36 KB vs 2.8 KB); react-colorful is modern, tree-shakeable, actively maintained |
| WCAG luminance formula | Simple RGB average | RGB average doesn't account for human perception; WCAG formula (0.2126*R + 0.7152*G + 0.0722*B) matches actual perceived brightness |
| Database schema for background_color | Blueprint JSON only | Background color is template-level (not session instance), belongs in blueprint alongside global template ID |
| Chart color adaptation | Fixed dark/light palettes | User decision requires adaptive colors; need algorithm to adjust saturation/lightness while preserving hue |

**Installation:**
```bash
npm install react-colorful
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── editor/
│   │   ├── EditorToolbar.tsx         # MODIFIED - add color picker next to global template selector
│   │   ├── BatchEditor.tsx           # MODIFIED - add cover image selector
│   │   └── PreviewProjection.tsx    # MODIFIED - apply background color + auto-contrast
│   ├── PresentationView.tsx          # MODIFIED - directional transitions, background color
│   ├── BatchResultsProjection.tsx    # MODIFIED - auto-contrast for charts
│   └── SlideDisplay.tsx              # MODIFIED - may need wrapper for batch cover images
├── lib/
│   ├── color-contrast.ts             # NEW - luminance calculation, text color selection
│   └── chart-colors.ts               # NEW - adaptive chart color generation
├── stores/
│   └── template-editor-store.ts      # MODIFIED - add backgroundColor to blueprint
└── types/
    └── database.ts                   # MODIFIED - add cover_image_path to Batch and blueprint
```

### Pattern 1: Directional Slide Transitions with Motion

**What:** Extend existing slide transitions to accept custom direction, slide in from right (forward) or left (backward)

**When to use:** PresentationView sequence item transitions, preview projection transitions

**Example:**
```typescript
// Source: Existing PresentationView.tsx slideVariants (lines 306-317) + user requirements
const slideVariants = {
  enter: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '100%' : direction === 'backward' ? '-100%' : 0,
    opacity: direction ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '-100%' : direction === 'backward' ? '100%' : 0,
    opacity: direction ? 0 : 1,
  }),
};

// Apply to ALL sequence items (slides and batches)
<AnimatePresence mode="wait" custom={navigationDirection}>
  <motion.div
    key={activeSessionItemId ?? 'none'}
    custom={navigationDirection}
    variants={slideVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }} // ~400ms cubic-bezier
    className="w-full h-full absolute inset-0"
  >
    {/* Slide or batch content */}
  </motion.div>
</AnimatePresence>
```

**Key changes from existing code:**
- PresentationView currently uses slideVariants for slides, crossfadeVariants for batches (lines 306-323)
- User requirement: same slide animation for ALL item types
- Transition duration: change from spring (variable) to fixed 0.4s
- Position: absolute for overlap during transition (no visible gap)

### Pattern 2: WCAG Relative Luminance Calculation

**What:** Calculate relative luminance from hex/RGB color, determine if text should be light or dark

**When to use:** Background color changes in template editor preview and projection view

**Example:**
```typescript
// lib/color-contrast.ts
// Source: WCAG 2.1 specification - https://www.w3.org/WAI/GL/wiki/Contrast_ratio

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error('Invalid hex color');

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = sRGBtoLinear(r);
  const G = sRGBtoLinear(g);
  const B = sRGBtoLinear(b);

  // WCAG formula
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getTextColor(backgroundHex: string): 'light' | 'dark' {
  const luminance = getRelativeLuminance(backgroundHex);
  // Threshold 0.5 (Claude's discretion): luminance 0-1 range
  // Values < 0.5 are perceived as dark, need light text
  return luminance > 0.5 ? 'dark' : 'light';
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const L1 = getRelativeLuminance(hex1);
  const L2 = getRelativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  return (lighter + 0.05) / (darker + 0.05);
}
```

**Sources:**
- [W3C Contrast Ratio Formula](https://www.w3.org/WAI/GL/wiki/Contrast_ratio) - HIGH confidence
- [WebAIM Contrast and Color](https://webaim.org/articles/contrast/) - HIGH confidence
- WebSearch verified approach (see sources section)

### Pattern 3: React-Colorful Integration in Toolbar

**What:** Add HexColorPicker + HexColorInput in EditorToolbar next to global template selector

**When to use:** Template editor toolbar for background color selection

**Example:**
```typescript
// EditorToolbar.tsx
import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useTemplateEditorStore } from '../../stores/template-editor-store';

function EditorToolbar() {
  const { backgroundColor, setBackgroundColor } = useTemplateEditorStore();
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      {/* Existing toolbar content */}

      {/* Color picker section */}
      <div className="w-px h-6 bg-gray-300" />
      <span className="text-xs text-gray-500">Background</span>

      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-8 h-8 rounded border-2 border-gray-300 shadow-sm"
          style={{ backgroundColor: backgroundColor || '#1a1a2e' }}
          title="Projection background color"
        />

        {showColorPicker && (
          <div className="absolute top-10 left-0 z-10 bg-white p-3 rounded-lg shadow-xl border border-gray-200">
            <HexColorPicker
              color={backgroundColor || '#1a1a2e'}
              onChange={setBackgroundColor}
            />
            <HexColorInput
              color={backgroundColor || '#1a1a2e'}
              onChange={setBackgroundColor}
              prefixed
              className="w-full mt-2 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Source:** [react-colorful documentation](https://www.npmjs.com/package/react-colorful) - HIGH confidence

### Pattern 4: Dynamic Background with CSS Variables

**What:** Use inline style with CSS variable for background color, avoiding Tailwind's build-time limitation

**When to use:** Applying dynamic background colors in projection view and preview

**Example:**
```typescript
// PresentationView.tsx / PreviewProjection.tsx
import { getTextColor } from '../lib/color-contrast';

function ProjectionView() {
  const backgroundColor = useSessionStore(s => s.session?.backgroundColor) || '#1a1a2e';
  const textColorClass = getTextColor(backgroundColor) === 'light'
    ? 'text-white'
    : 'text-gray-900';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${textColorClass}`}
      style={{ backgroundColor }}
    >
      {/* Content with auto-adjusted text color */}
    </div>
  );
}
```

**Why inline styles:** Tailwind CSS cannot generate classes for runtime color values. Dynamic class names like `bg-${color}` are purged during build. CSS variables with inline styles bypass this limitation.

**Source:** [Medium - Handle Dynamic Colors in React & Tailwind CSS (Jan 2026)](https://medium.com/@hridoycodev/beyond-hardcoding-3-ways-to-handle-dynamic-colors-in-react-tailwind-css-d397fb1ef80a) - MEDIUM confidence (recent 2026 article, verified approach)

### Pattern 5: Batch Cover Image Storage

**What:** Add cover_image_path to batches table and batch blueprints, reuse existing slide image upload flow

**When to use:** Batch editing UI, blueprint serialization/deserialization, projection view rendering

**Schema change:**
```sql
-- New migration: 20260213_070_batch_cover_images.sql
ALTER TABLE batches
  ADD COLUMN cover_image_path TEXT NULL;
```

**Blueprint update:**
```typescript
// types/database.ts
export interface Batch {
  id: string;
  session_id: string;
  name: string;
  position: number;
  status: BatchStatus;
  cover_image_path: string | null; // NEW
  created_at: string;
}

export interface SessionBlueprintItem {
  item_type: 'batch' | 'slide';
  position: number;
  batch?: {
    name: string;
    timer_duration?: number | null;
    template_id?: string | null;
    cover_image_path?: string | null; // NEW
    questions: QuestionBlueprint[];
  };
  slide?: {
    image_path: string;
    caption: string | null;
  };
}
```

**UI placement (Claude's discretion):**
Add cover image selector in BatchEditor.tsx toolbar, next to timer input:
```typescript
// BatchEditor.tsx
<div className="flex items-center gap-3">
  {/* Existing batch name + question count */}

  <div className="flex-1" />

  {/* Cover image selector */}
  <div className="flex items-center gap-1.5">
    <label className="text-xs text-gray-500">Cover</label>
    <select
      value={item.batch?.cover_image_path || ''}
      onChange={(e) => handleCoverImageChange(e.target.value)}
      className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm"
    >
      <option value="">None</option>
      {/* List existing slides in sequence */}
      {availableSlides.map(slide => (
        <option key={slide.id} value={slide.image_path}>
          {slide.caption || 'Untitled Slide'}
        </option>
      ))}
    </select>
    <button onClick={handleUploadCoverImage} className="...">
      Upload
    </button>
  </div>

  {/* Existing timer input */}
</div>
```

### Pattern 6: Adaptive Chart Colors

**What:** Adjust chart bar colors to ensure contrast against custom background

**When to use:** BatchResultsProjection when background color is not default

**Example:**
```typescript
// lib/chart-colors.ts
import { getRelativeLuminance, getContrastRatio } from './color-contrast';

export function getAdaptiveChartColor(
  originalColor: string,
  backgroundColor: string,
  minContrast: number = 4.5
): string {
  const currentContrast = getContrastRatio(originalColor, backgroundColor);

  if (currentContrast >= minContrast) {
    return originalColor; // Already sufficient contrast
  }

  // Adjust lightness: lighten if bg is dark, darken if bg is light
  const bgLuminance = getRelativeLuminance(backgroundColor);
  const adjustedColor = bgLuminance < 0.5
    ? lightenColor(originalColor, 0.3)
    : darkenColor(originalColor, 0.3);

  return adjustedColor;
}

function lightenColor(hex: string, amount: number): string {
  // Convert to HSL, increase lightness, convert back
  // Implementation details...
}

function darkenColor(hex: string, amount: number): string {
  // Convert to HSL, decrease lightness, convert back
  // Implementation details...
}
```

**Alternative approach:** Use fixed high-contrast palettes (dark background = light colors, light background = dark colors). Simpler, but less flexible.

### Anti-Patterns to Avoid

- **Using Tailwind dynamic classes for background color:** `bg-[${color}]` won't work; Tailwind purges unknown classes. Use inline styles.
- **Storing background_color in sessions table:** Background color is template-level, not session instance level. Store in blueprint JSON.
- **Calculating luminance with simple RGB average:** `(r+g+b)/3` doesn't match human perception. Use WCAG formula with gamma correction.
- **Hardcoding text color to white:** Breaks on light backgrounds. Always calculate based on luminance.
- **Animating both entering and exiting content with opacity only:** Creates visible gap during transition. Use absolute positioning + transform for overlap.
- **Different transition styles for slides vs batches:** User requirement is consistent feel. Apply same directional slide to all items.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color picker UI | Custom canvas/slider color picker | react-colorful | 2.8 KB, accessible, keyboard navigation, touch support, TypeScript types, battle-tested |
| Luminance calculation | Custom brightness formula | WCAG relative luminance (0.2126*R + 0.7152*G + 0.0722*B with gamma correction) | Matches human perception, standardized, accessibility compliant |
| Hex to RGB conversion | String manipulation | Regex `/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i` | Handles #-prefixed and non-prefixed, case-insensitive, validated pattern |
| Chart color adjustment | Manual color math | HSL conversion + lightness adjustment | HSL preserves hue and saturation, only adjusts lightness for contrast |

**Key insight:** Color science is complex (gamma correction, perceptual brightness, color space conversions). Use proven formulas and libraries to avoid edge cases.

## Common Pitfalls

### Pitfall 1: Flickering During Directional Transitions

**What goes wrong:** Gap appears between exiting and entering slides, or content flickers/jumps during transition.

**Why it happens:** Both slides are positioned relatively, causing layout shift. Or opacity reaches 0 before x transform completes.

**How to avoid:** Use `position: absolute` on both entering/exiting elements, wrap in `position: relative` container. Ensure `mode="wait"` on AnimatePresence is NOT used (need overlap). Coordinate x and opacity timing.

**Warning signs:** White flash between slides, content jumps vertically during horizontal slide.

**Example fix:**
```typescript
// Container with relative positioning
<div className="relative w-full h-full overflow-hidden">
  <AnimatePresence custom={direction}>
    <motion.div
      className="absolute inset-0" // Both slides overlap
      // ... variants
    />
  </AnimatePresence>
</div>
```

### Pitfall 2: Incorrect Luminance Calculation

**What goes wrong:** Dark text appears on dark background, or light text on light background.

**Why it happens:** Forgot gamma correction (sRGBtoLinear step), or used simple RGB average instead of WCAG formula.

**How to avoid:** Always apply gamma correction before weighting. Use WCAG formula (0.2126*R + 0.7152*G + 0.0722*B) with linearized RGB values.

**Warning signs:** Green backgrounds incorrectly classified as dark, blue backgrounds as light.

**Correct implementation:**
```typescript
// WRONG: Simple average
const brightness = (r + g + b) / 3; // Doesn't match perception

// CORRECT: WCAG relative luminance
const R = sRGBtoLinear(r);
const G = sRGBtoLinear(g);
const B = sRGBtoLinear(b);
const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
```

### Pitfall 3: Color Picker Doesn't Close on Outside Click

**What goes wrong:** Color picker dropdown stays open when clicking elsewhere, blocking UI.

**Why it happens:** No click-outside detection or onBlur handler.

**How to avoid:** Use useRef + useEffect to detect clicks outside picker, close dropdown. Or use library like react-click-outside.

**Warning signs:** Picker stays open permanently, multiple pickers can open simultaneously.

**Example:**
```typescript
const pickerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
      setShowColorPicker(false);
    }
  }

  if (showColorPicker) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showColorPicker]);
```

### Pitfall 4: Background Color Not Persisting in Blueprint

**What goes wrong:** Background color resets to default when template is saved and reloaded.

**Why it happens:** Forgot to include backgroundColor in toBlueprint() serialization or loadFromBlueprint() deserialization.

**How to avoid:** Add backgroundColor to SessionBlueprint interface, update both serialization and deserialization methods in template-editor-store.ts.

**Warning signs:** Color picker shows correct value but preview/live session uses default color.

**Fix:**
```typescript
// template-editor-store.ts
toBlueprint: () => ({
  version: 1 as const,
  globalTemplateId: state.globalTemplateId ?? null,
  backgroundColor: state.backgroundColor ?? null, // NEW
  sessionItems: blueprintItems,
}),

loadFromBlueprint: (templateId, name, blueprint) => {
  set({
    // ... existing fields
    backgroundColor: blueprint.backgroundColor ?? null, // NEW
  });
}
```

### Pitfall 5: Chart Colors Don't Adapt on Background Change

**What goes wrong:** Bar chart colors are invisible against custom background (e.g., red bars on red background).

**Why it happens:** BarChart component uses hardcoded AGREE_DISAGREE_COLORS / MULTI_CHOICE_COLORS without checking background.

**How to avoid:** Pass backgroundColor to BarChart, apply adaptive color adjustment before rendering. Or use fixed high-contrast palettes (light colors on dark bg, dark colors on light bg).

**Warning signs:** Results page unreadable with certain background colors, user complaints about invisible charts.

**Fix:**
```typescript
// BatchResultsProjection.tsx
import { getAdaptiveChartColor } from '../lib/chart-colors';

const backgroundColor = session?.backgroundColor || '#1a1a2e';
const adaptedChartData = chartData.map(item => ({
  ...item,
  color: getAdaptiveChartColor(item.color, backgroundColor),
}));

<BarChart data={adaptedChartData} theme="dark" />
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Motion Direction-Aware Variants (Existing Pattern Extended)

```typescript
// Source: PresentationView.tsx lines 306-323 + user requirements
const slideVariants = {
  enter: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '100%' : direction === 'backward' ? '-100%' : 0,
    opacity: direction ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'backward' | null) => ({
    x: direction === 'forward' ? '-100%' : direction === 'backward' ? '100%' : 0,
    opacity: direction ? 0 : 1,
  }),
};

// Usage in component
const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward' | null>(null);

const handleNext = () => {
  setNavigationDirection('forward');
  setCurrentIndex(i => i + 1);
};

const handlePrev = () => {
  setNavigationDirection('backward');
  setCurrentIndex(i => i - 1);
};

return (
  <div className="relative w-full h-full overflow-hidden">
    <AnimatePresence initial={false} custom={navigationDirection}>
      <motion.div
        key={currentItemId}
        custom={navigationDirection}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
        className="absolute inset-0"
      >
        {/* Content */}
      </motion.div>
    </AnimatePresence>
  </div>
);
```

### HexColorPicker with HexColorInput (react-colorful)

```typescript
// Source: https://www.npmjs.com/package/react-colorful
import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';

function ColorPickerExample() {
  const [color, setColor] = useState('#1a1a2e');

  return (
    <div>
      <HexColorPicker color={color} onChange={setColor} />
      <HexColorInput
        color={color}
        onChange={setColor}
        prefixed // Shows # prefix
        className="mt-2 w-full px-2 py-1 border rounded font-mono"
      />
    </div>
  );
}
```

### WCAG Relative Luminance Calculation

```typescript
// Source: https://www.w3.org/WAI/GL/wiki/Contrast_ratio
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error('Invalid hex color');

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  // Gamma correction
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = sRGBtoLinear(r);
  const G = sRGBtoLinear(g);
  const B = sRGBtoLinear(b);

  // WCAG formula
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getTextColor(backgroundHex: string): 'light' | 'dark' {
  const luminance = getRelativeLuminance(backgroundHex);
  return luminance > 0.5 ? 'dark' : 'light';
}
```

### Dynamic Background with Inline Styles

```typescript
// Source: https://medium.com/@hridoycodev/beyond-hardcoding-3-ways-to-handle-dynamic-colors-in-react-tailwind-css-d397fb1ef80a
import { getTextColor } from '../lib/color-contrast';

function DynamicBackgroundComponent({ backgroundColor }: { backgroundColor: string }) {
  const textColorClass = getTextColor(backgroundColor) === 'light'
    ? 'text-white'
    : 'text-gray-900';

  return (
    <div
      className={`min-h-screen p-8 ${textColorClass}`}
      style={{ backgroundColor }}
    >
      <h1>Content with auto-adjusted text color</h1>
    </div>
  );
}
```

### Batch Cover Image Upload (Reusing Slide Upload Pattern)

```typescript
// Source: EditorToolbar.tsx lines 114-148 (existing slide upload pattern)
import imageCompression from 'browser-image-compression';
import { uploadSlideImage } from '../../lib/slide-api';

async function handleCoverImageUpload(file: File) {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.85,
      preserveExif: false,
    });

    const imagePath = await uploadSlideImage('templates', compressed);

    // Update batch with cover image
    updateItem(batchItemId, {
      batch: {
        ...batch,
        cover_image_path: imagePath,
      },
    });
  } catch (err) {
    console.error('Failed to upload cover image:', err);
    alert('Failed to upload image. Please try again.');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple RGB brightness | WCAG relative luminance with gamma correction | WCAG 2.0 (2008) | Accurate perceptual brightness, accessibility compliant |
| react-color (36 KB) | react-colorful (2.8 KB) | 2020-2021 | 13x smaller bundle, modern, tree-shakeable, same functionality |
| Tailwind dynamic classes | Inline styles + CSS variables | Tailwind v3+ build optimization | Tailwind purges unknown classes; inline styles needed for runtime colors |
| Crossfade for all transitions | Directional slides (presentation apps) | User decision (Phase 24) | Feels like Keynote/PowerPoint, clear navigation direction |
| Fixed color schemes | User-customizable backgrounds | User decision (Phase 24) | Branding flexibility, requires contrast handling |

**Deprecated/outdated:**
- **Simple RGB average for brightness:** Doesn't match human perception. Use WCAG luminance.
- **react-color:** Bloated (36 KB), inactive maintenance. Use react-colorful.
- **Storing color as RGB object:** Use hex string for simplicity and interoperability.

## Open Questions

1. **Default background color hex value**
   - What we know: User wants "dark blue/gray" default, Claude's discretion for exact value
   - What's unclear: Specific hex code preference
   - Recommendation: `#1a1a2e` (very dark blue-gray, matches existing PresentationView bg `#1a1a1a` but with blue tint). Alternative: `#16213e` (navy blue-gray). Both have luminance < 0.1, ensuring white text.

2. **Luminance threshold for light/dark text**
   - What we know: Auto-switch based on background luminance, Claude's discretion for threshold
   - What's unclear: Exact threshold value (0.4? 0.5? 0.6?)
   - Recommendation: 0.5 (midpoint of 0-1 range). WCAG doesn't specify text color threshold, only contrast ratio. 0.5 is commonly used in color libraries and provides balanced switching.

3. **Chart color adaptation algorithm**
   - What we know: Charts must adapt to ensure contrast, Claude's discretion for algorithm
   - What's unclear: Lightness adjustment amount, whether to preserve hue
   - Recommendation: Preserve hue and saturation, adjust only lightness. If bg luminance < 0.5 (dark), lighten chart colors by 30%. If bg luminance >= 0.5 (light), darken by 30%. Simpler alternative: fixed high-contrast palettes (light colors for dark bg, dark colors for light bg).

4. **Cover image control placement**
   - What we know: Claude's discretion, should fit within existing batch editing UI
   - What's unclear: Best placement for usability
   - Recommendation: BatchEditor.tsx toolbar, between question count and timer input. Dropdown to select from existing slides + upload button. Keeps all batch metadata in one toolbar row.

5. **Loading states during slide upload**
   - What we know: Slide upload compresses and uploads image, takes 1-3 seconds
   - What's unclear: Loading indicator design
   - Recommendation: Disable upload button with "Uploading..." text (matching existing EditorToolbar pattern line 272). Show spinner icon in button.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection:**
  - `src/pages/PresentationView.tsx` - Existing transition patterns (slideVariants, crossfadeVariants, AnimatePresence)
  - `src/components/editor/EditorToolbar.tsx` - Toolbar structure, slide upload pattern
  - `src/components/editor/BatchEditor.tsx` - Batch editing UI, toolbar layout
  - `src/stores/template-editor-store.ts` - Blueprint serialization/deserialization
  - `package.json` - Motion 12.29.2, browser-image-compression 2.0.2
  - `src/types/database.ts` - Database schema types
  - `supabase/migrations/20250101_005_add_batches.sql` - Batches table schema

- **Official specifications:**
  - [W3C Contrast Ratio Formula](https://www.w3.org/WAI/GL/wiki/Contrast_ratio) - Relative luminance calculation
  - [WebAIM Contrast and Color](https://webaim.org/articles/contrast/) - WCAG contrast requirements

- **Library documentation:**
  - [react-colorful npm package](https://www.npmjs.com/package/react-colorful) - HexColorPicker, HexColorInput API
  - [react-colorful GitHub](https://github.com/omgovich/react-colorful) - TypeScript examples, size comparison

### Secondary (MEDIUM confidence)

- [Medium - Handle Dynamic Colors in React & Tailwind CSS (Jan 2026)](https://medium.com/@hridoycodev/beyond-hardcoding-3-ways-to-handle-dynamic-colors-in-react-tailwind-css-d397fb1ef80a) - Inline styles with CSS variables approach
- [GitHub Gist - Calculate brightness value by RGB or HEX](https://gist.github.com/w3core/e3d9b5b6d69a3ba8671cc84714cca8a4) - Luminance calculation examples
- [Andreas Wik - Determine If A Color Is Bright Or Dark](https://awik.io/determine-color-bright-dark-using-javascript/) - HSP equation alternative approach

### Tertiary (LOW confidence)

- [LogRocket - Applying dynamic styles with Tailwind CSS](https://blog.logrocket.com/applying-dynamic-styles-tailwind-css/) - Tailwind limitations with dynamic values (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-colorful is well-documented (2.8 KB, actively maintained, 12k+ GitHub stars), Motion already in use
- Architecture: HIGH - Existing transition patterns, luminance formula is WCAG standard, inline styles approach verified
- Pitfalls: MEDIUM-HIGH - Transition overlap pitfall from Motion patterns, luminance calculation pitfalls from WCAG examples, color picker click-outside is common React pattern

**Research date:** 2026-02-13
**Valid until:** 60 days (2026-04-14) - Stable libraries (react-colorful, Motion), WCAG formula is permanent standard
