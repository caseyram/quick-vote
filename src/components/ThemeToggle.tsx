import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { preference, cycleTheme } = useTheme();

  const icon = preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '💻';
  const label = preference === 'dark' ? 'Dark' : preference === 'light' ? 'Light' : 'System';

  return (
    <button
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className={`rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] ${
        size === 'sm' ? 'text-lg p-1' : 'text-xl p-2'
      }`}
    >
      {icon}
    </button>
  );
}
