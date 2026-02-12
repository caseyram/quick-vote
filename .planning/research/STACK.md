# Stack Research — v2.0 Feature Additions

**Project:** QuickVote v2.0
**Domain:** Real-time voting with template authoring, team-based voting, presentation polish
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

**No major stack additions required.** Existing stack handles all new features with minor utility library additions for color contrast checking and HTML sanitization. All new features leverage validated capabilities (Motion for transitions, dnd-kit for multi-select, qrcode.react for team QR codes, native contenteditable for inline editing).

## New Capabilities Required

| Capability | Stack Component | Status |
|------------|----------------|--------|
| Template edit/preview modes | React state patterns | Already validated |
| Team-based QR codes | qrcode.react ^4.2.0 | Already installed |
| Crossfade transitions | Motion ^12.29.2 (AnimatePresence) | Already installed |
| Configurable backgrounds with contrast | **polished** (new utility) | Needs installation |
| Multi-select drag-and-drop | dnd-kit ^6.3.1 (pattern implementation) | Already installed |
| Inline editing in sequence | Native contenteditable + **isomorphic-dompurify** (new) | Needs sanitization lib |

## Required Stack Additions

### Color Contrast Utilities

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **polished** | ^4.3.1 | WCAG contrast checking, color manipulation | Industry standard for styled-in-JS color utilities, provides `readableColor()` for auto contrast and `getLuminance()` for WCAG compliance. 2kB gzipped, framework agnostic, Sass-style helpers. |

**Installation:**
```bash
npm install polished
```

**Usage Pattern:**
```typescript
import { readableColor, getLuminance } from 'polished';

// Auto-select black/white text based on background
const textColor = readableColor('#FF5733'); // Returns '#000' or '#fff'

// WCAG AA compliance check (4.5:1 for normal text)
const bgLuminance = getLuminance('#FF5733');
const textLuminance = getLuminance('#FFFFFF');
const contrast = (Math.max(bgLuminance, textLuminance) + 0.05) /
                 (Math.min(bgLuminance, textLuminance) + 0.05);
const meetsWCAG_AA = contrast >= 4.5;
```

**Why not `color-contrast-checker`:** Latest version 2.1.0 from 4 years ago (2022), unmaintained. Polished is actively maintained and provides broader color utilities beyond contrast checking.

### HTML Sanitization (Inline Editing)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **isomorphic-dompurify** | ^3.0.0-rc.2 | XSS prevention for contenteditable | OWASP-recommended sanitizer with isomorphic (client + SSR) support. DOMPurify is industry standard (24M+ weekly downloads). Isomorphic wrapper enables server-side sanitization for import/export flows. |

**Installation:**
```bash
npm install isomorphic-dompurify
```

**Usage Pattern:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize HTML from contenteditable
const clean = DOMPurify.sanitize(dirtyHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
});

// Server memory management (long-running processes)
import { clearWindow } from 'isomorphic-dompurify';
clearWindow(); // Resets jsdom state to prevent memory leaks
```

**Why isomorphic over regular dompurify:** Project uses server-side template export/import. Regular DOMPurify doesn't support Node.js. Isomorphic wrapper provides seamless client + server sanitization with same API.

**Security requirement:** Always sanitize on both client (during edit) AND server (on import), per OWASP best practices.

## Patterns Using Existing Stack

### Multi-Select Drag-and-Drop (dnd-kit)

**Implementation approach** (no new library needed):

```typescript
// Track selection with Set
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Ctrl/Cmd+click for toggle, Shift+click for range
function handleItemClick(id: string, event: React.MouseEvent) {
  if (event.metaKey || event.ctrlKey) {
    const newSelection = new Set(selectedIds);
    newSelection.has(id) ? newSelection.delete(id) : newSelection.add(id);
    setSelectedIds(newSelection);
  } else if (event.shiftKey) {
    // Range selection logic
  } else {
    setSelectedIds(new Set([id]));
  }
}

// During drag, move all selected items
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || !selectedIds.has(active.id as string)) return;

  // Reorder all selected items together
  const itemsToMove = sessionItems.filter(item => selectedIds.has(item.id));
  // ... reorder logic
}
```

**Source:** [dnd-kit GitHub issue #120](https://github.com/clauderic/dnd-kit/issues/120) — confirmed multi-select is a user-implemented pattern, not a built-in feature.

### Crossfade Transitions (Motion)

**Use existing AnimatePresence** with `mode="wait"` for sequential transitions:

```typescript
import { AnimatePresence, motion } from 'motion/react';

<AnimatePresence mode="wait">
  <motion.div
    key={currentSlideId}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    {currentSlide}
  </motion.div>
</AnimatePresence>
```

**Mode options:**
- `sync` (default): New element enters while old exits (crossfade)
- `wait`: New element waits until old exits completely (sequential)
- `popLayout`: Exiting element removed from layout immediately

**Source:** [Motion AnimatePresence docs](https://motion.dev/docs/react-animate-presence)

### Team QR Codes (qrcode.react)

**Already installed** (^4.2.0). Supports React 19. Generate multiple QR codes with different URLs:

```typescript
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`${baseUrl}/session/${sessionId}/team/${teamId}`}
  size={200}
  level="M"
  marginSize={1}
/>
```

**Source:** [qrcode.react GitHub](https://github.com/zpao/qrcode.react) — Latest 4.2.0 supports React ^16.8.0 through ^19.0.0.

### Inline Editing (Native contenteditable)

**Avoid `react-contenteditable`** (last updated 3 years ago, React 19 compatibility unknown). Use native contenteditable with controlled patterns:

```typescript
function InlineEdit({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleBlur() {
    const html = ref.current?.innerHTML ?? '';
    const sanitized = DOMPurify.sanitize(html, { /* config */ });
    onChange(sanitized);
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  return (
    <div
      ref={ref}
      contentEditable
      onBlur={handleBlur}
      onPaste={handlePaste}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
```

**Why not react-contenteditable:** Package unmaintained (3 years), React 19 compatibility unverified, adds dependency for pattern easily implemented natively.

**Sources:**
- [LogRocket: Build inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/)
- [Tania Rascia: Content Editable Elements](https://www.taniarascia.com/content-editable-elements-in-javascript-react/)

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **react-contenteditable** | Unmaintained (3 years), React 19 support unverified | Native contenteditable with sanitization |
| **color-contrast-checker** | Unmaintained (4 years old), limited features | polished (broader utilities, maintained) |
| **react-qr-code** | Switching library creates migration work for no benefit | qrcode.react (already installed, works) |
| **react-hotkeys-hook** | Adds 10kB for simple keyboard shortcuts | Native event listeners (already used) |
| **dnd-kit plugins** | Multi-select is pattern, not plugin | Implement with Set + event handlers |

## Alternative Libraries Considered

### Color Contrast

| Library | Why Not Chosen |
|---------|---------------|
| `color-contrast-checker` (2.1.0) | Last updated 4 years ago, unmaintained |
| `wcag-contrast` (1.0.1) | Single-purpose, polished provides same + more utilities |
| `get-contrast` | Smaller but lacks color manipulation helpers needed for background picker |

**Winner:** polished — Maintained, comprehensive, industry standard for styled-in-JS projects.

### Keyboard Shortcuts

| Library | Why Not Chosen |
|---------|---------------|
| `react-hotkeys-hook` | 10kB bundle, overkill for 6 shortcuts already implemented natively |
| `react-keyboard-shortcuts` | New (Jan 2026), unproven, native solution works |

**Winner:** Native `addEventListener('keydown')` — Already implemented in `KeyboardShortcutHelp.tsx`, works perfectly, zero bytes.

### HTML Sanitization

| Library | Why Not Chosen |
|---------|---------------|
| `dompurify` | Doesn't support Node.js (server-side template imports fail) |
| `sanitize-html` | Larger bundle (11kB vs 4kB), less configurable |

**Winner:** isomorphic-dompurify — SSR support needed, OWASP recommended, 4kB gzipped.

## Installation Summary

```bash
# New utilities only
npm install polished isomorphic-dompurify

# Type definitions (if using TypeScript strict mode)
npm install -D @types/dompurify
```

**Total addition:** ~6kB gzipped (polished 2kB + isomorphic-dompurify 4kB)

## Integration Checklist

- [ ] Install polished for background contrast checking
- [ ] Install isomorphic-dompurify for contenteditable sanitization
- [ ] Implement multi-select pattern with Set + event handlers (no library)
- [ ] Use AnimatePresence `mode="wait"` for crossfade transitions
- [ ] Generate team QR codes with existing qrcode.react
- [ ] Use native contenteditable with DOMPurify sanitization
- [ ] Validate WCAG AA contrast (4.5:1 normal text, 3:1 large text)
- [ ] Sanitize HTML on client blur AND server import

## Version Compatibility

| Package | Current Version | Compatible With | Notes |
|---------|----------------|-----------------|-------|
| polished | 4.3.1 | All React versions | Zero React dependencies |
| isomorphic-dompurify | 3.0.0-rc.2 | React 19, Node.js 18+ | jsdom peer dependency handled internally |
| qrcode.react | 4.2.0 (installed) | React ^16.8 - ^19.0 | Already compatible |
| motion | 12.29.2 (installed) | React 19 | Already compatible |
| dnd-kit | 6.3.1 (installed) | React 19 | Already compatible |

## Security Considerations

### XSS Prevention (Inline Editing)

**CRITICAL:** Always sanitize contenteditable HTML:

1. **Client-side:** Sanitize on blur before storing
2. **Server-side:** Sanitize template imports before database insert
3. **Render:** Use `dangerouslySetInnerHTML` only with sanitized content

**WCAG contrast configuration:**
```typescript
import { readableColor } from 'polished';

// Strict mode: Returns only if WCAG AA compliant
const textColor = readableColor(
  backgroundColor,
  '#000000',      // Dark text
  '#FFFFFF',      // Light text
  true            // Strict WCAG AA (4.5:1)
);
```

**Source:** [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Performance Notes

### polished Tree-Shaking

```typescript
// ✅ Good: Import only what you need
import { readableColor, getLuminance } from 'polished';

// ❌ Bad: Imports entire library
import * as polished from 'polished';
```

### DOMPurify Memory Management

For long-running admin sessions (template editing), clear jsdom state periodically:

```typescript
import { clearWindow } from 'isomorphic-dompurify';

// After bulk template imports or every N sanitizations
clearWindow();
```

**Source:** [isomorphic-dompurify docs](https://github.com/kkomelin/isomorphic-dompurify) — Prevents memory leaks in server-side sanitization.

## Sources

**Context7 / Official Docs:**
- [Motion AnimatePresence Documentation](https://motion.dev/docs/react-animate-presence) — MEDIUM confidence
- [dnd-kit GitHub Repository](https://github.com/clauderic/dnd-kit) — HIGH confidence
- [qrcode.react GitHub](https://github.com/zpao/qrcode.react) — HIGH confidence
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) — HIGH confidence

**NPM Packages:**
- [polished npm](https://www.npmjs.com/package/polished) — MEDIUM confidence (version from npm trends)
- [isomorphic-dompurify npm](https://www.npmjs.com/package/isomorphic-dompurify) — MEDIUM confidence
- [DOMPurify official site](https://dompurify.com/) — HIGH confidence

**Community Research:**
- [dnd-kit multi-select issue #120](https://github.com/clauderic/dnd-kit/issues/120) — MEDIUM confidence (community pattern, not official)
- [LogRocket: Inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/) — LOW confidence (tutorial, not official docs)
- [Tania Rascia: Content Editable Elements](https://www.taniarascia.com/content-editable-elements-in-javascript-react/) — LOW confidence

---
*Stack research for: QuickVote v2.0 Template Authoring & Presentation Polish*
*Researched: 2026-02-12*
