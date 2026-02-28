# Phase 3 — Theme System

**Objective:** Add system/dark/light theme support with CSS custom properties across all participant views and an independent presentation view theme controlled from admin.

---

## Step 1: Define CSS custom properties

### Files to modify
- `src/index.css`

### Changes

Add semantic color tokens scoped to `[data-theme]`:

```css
[data-theme="dark"] {
  --bg-primary: #030712;       /* gray-950 */
  --bg-surface: #111827;       /* gray-900 */
  --bg-elevated: #1f2937;      /* gray-800 */
  --bg-input: #1f2937;         /* gray-800 */
  --border-primary: #374151;   /* gray-700 */
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;   /* gray-400 */
  --text-muted: #6b7280;       /* gray-500 */
  --text-placeholder: #6b7280; /* gray-500 */
}

[data-theme="light"] {
  --bg-primary: #f9fafb;       /* gray-50 */
  --bg-surface: #ffffff;
  --bg-elevated: #f3f4f6;      /* gray-100 */
  --bg-input: #ffffff;
  --border-primary: #d1d5db;   /* gray-300 */
  --text-primary: #111827;     /* gray-900 */
  --text-secondary: #6b7280;   /* gray-500 */
  --text-muted: #9ca3af;       /* gray-400 */
  --text-placeholder: #9ca3af; /* gray-400 */
}
```

Presentation view gets its own scope:
```css
[data-presentation-theme="dark"] {
  --pres-bg: #1a1a2e;
  --pres-text: #ffffff;
  --pres-text-secondary: #9ca3af;
  --pres-card-bg: rgba(255, 255, 255, 0.1);
}

[data-presentation-theme="light"] {
  --pres-bg: #f9fafb;
  --pres-text: #111827;
  --pres-text-secondary: #6b7280;
  --pres-card-bg: rgba(0, 0, 0, 0.05);
}
```

---

## Step 2: Update ThemeContext

### Files to modify
- `src/context/ThemeContext.tsx`

### Changes

1. Expand Theme type:
```ts
type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';
```

2. Add `resolvedTheme` to context:
```ts
interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  cycleTheme: () => void; // dark → light → system → dark
}
```

3. Default to `'system'` instead of `'dark'`:
```ts
function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem('quickvote-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}
```

4. Add `prefers-color-scheme` media query listener:
```ts
const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(
  () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

useEffect(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => setSystemPreference(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);

const resolvedTheme: ResolvedTheme = preference === 'system' ? systemPreference : preference;
```

5. Set `data-theme` to resolved value:
```ts
useEffect(() => {
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  localStorage.setItem('quickvote-theme', preference);
}, [resolvedTheme, preference]);
```

6. Add cycle function:
```ts
const cycleTheme = () => {
  setPreference(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark');
};
```

---

## Step 3: Add presentation theme context

### Files to create
- `src/context/PresentationThemeContext.tsx`

### Details

Separate context for presentation view theme:
```ts
type PresentationThemePreference = 'dark' | 'light';

interface PresentationThemeContextValue {
  theme: PresentationThemePreference;
  toggleTheme: () => void;
}
```

- Persists to `localStorage` key `quickvote-presentation-theme`
- Defaults to `'dark'`
- Sets `data-presentation-theme` on the presentation view's root element (not document — scoped)
- Broadcast `presentation_theme_changed` event so if admin changes it, the projection window picks it up

### Files to modify
- `src/App.tsx` — wrap with PresentationThemeProvider (or just provide it in PresentationView and AdminSession)

---

## Step 4: Update ThemeToggle component

### Files to modify
- `src/components/ThemeToggle.tsx`

### Changes

3-way cycle button:
```tsx
export function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { preference, cycleTheme } = useTheme();
  const icon = preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '💻';
  const label = preference === 'dark' ? 'Dark' : preference === 'light' ? 'Light' : 'System';

  return (
    <button
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className={size === 'sm' ? 'text-lg p-1' : 'text-xl p-2'}
    >
      {icon}
    </button>
  );
}
```

---

## Step 5: Convert participant views

### Files to modify
- `src/pages/ParticipantSession.tsx` (~29 hardcoded dark references)
- `src/components/VoteAgreeDisagree.tsx` (~8 references)
- `src/components/VoteMultipleChoice.tsx` (~6 references)
- `src/components/BatchVotingCarousel.tsx` (~7 references)

### Changes

Systematic replacement:
- `bg-gray-950` → `bg-[var(--bg-primary)]`
- `bg-gray-900` → `bg-[var(--bg-surface)]`
- `bg-gray-800` → `bg-[var(--bg-elevated)]`
- `border-gray-700` → `border-[var(--border-primary)]`
- `text-white` → `text-[var(--text-primary)]`
- `text-gray-400` → `text-[var(--text-secondary)]`
- `text-gray-500` → `text-[var(--text-muted)]`
- `placeholder-gray-500` → `placeholder-[var(--text-placeholder)]`

Add ThemeToggle to ParticipantSession header area (small size, top corner).

### Note on vote button colors
The vote option buttons (agree=blue, disagree=orange, sometimes=gray) use semantic colors from `AGREE_DISAGREE_COLORS` and `MULTI_CHOICE_COLORS` constants. These are functional colors, not theme colors — they should NOT change with theme. Only the unselected state (`rgba(55, 65, 81, 0.5)`) needs a theme-aware alternative for light mode.

---

## Step 6: Convert presentation view

### Files to modify
- `src/pages/PresentationView.tsx` (~6 references)
- `src/components/BatchResultsProjection.tsx` (~5 references)

### Changes

**PresentationView.tsx:**
- Replace `backgroundColor = '#1a1a2e'` with `var(--pres-bg)` from presentation theme context
- Replace hardcoded `textColorClass` logic with `var(--pres-text)`
- Set `data-presentation-theme` on the root element

**BatchResultsProjection.tsx:**
- Replace `backgroundColor` prop usage with presentation theme CSS vars
- `cardBg`, `headingColor`, `subTextColor`, `reasonTextColor`, `reasonNameColor` → derive from `--pres-*` vars

**Admin controls:**
- Add a small theme toggle (☀️/🌙) in the PresentationControls toolbar for the presentation view
- On toggle, broadcast `presentation_theme_changed` so the projection window updates

---

## Step 7: Update Home page

### Files to modify
- `src/pages/Home.tsx`

### Changes

Replace inline ternary pattern (`light ? 'bg-gray-50' : 'bg-gray-950'`) with CSS variable references. Remove the `const light = theme === 'light'` pattern. The Home page already has ThemeToggle — update it to use the new `cycleTheme` API.

---

## Files to create
- `src/context/PresentationThemeContext.tsx`

## Files to delete
None.

## Database changes
None.

## AC mapping
- AC-R6-1: ✓ Step 2 — ThemePreference type includes 'system'
- AC-R6-2: ✓ Step 2 — default is 'system', resolves via matchMedia
- AC-R6-3: ✓ Steps 2+4 — cycle button, localStorage persistence
- AC-R6-4: ✓ Steps 5+6+7 — toggle on Home, participant, presentation
- AC-R6-5: ✓ Step 5 — all participant views use CSS vars
- AC-R6-6: ✓ Step 6 — presentation view uses independent theme with CSS vars
- AC-R6-7: ✓ Step 2 — matchMedia change listener updates resolvedTheme live

## Implementation Notes (from adversarial review)
- **State variants:** When converting hardcoded classes, grep for ALL Tailwind state variants (hover:, active:, disabled:, focus:) on gray shades — not just base classes. Convert them all.
- **Broadcast direction:** Presentation theme broadcast is one-way: admin → projection only. Projection view never sends theme broadcasts.
- **Opacity modifiers:** Audit converted files for opacity modifiers (e.g., `bg-gray-950/50`). If found, define CSS vars as RGB values or create separate opacity-variant variables.

## Pitfalls addressed
- P1 (scope creep): Systematic find-replace with defined mapping table. Visual check per component.
- P4 (toggle placement): Small cycle button in top corner of participant view, non-intrusive.
