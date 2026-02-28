import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type PresentationThemePreference = 'dark' | 'light';

interface PresentationThemeContextValue {
  theme: PresentationThemePreference;
  setTheme: (theme: PresentationThemePreference) => void;
  toggleTheme: () => void;
}

const PresentationThemeContext = createContext<PresentationThemeContextValue | undefined>(undefined);

function getInitialTheme(): PresentationThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('quickvote-presentation-theme');
  return stored === 'light' ? 'light' : 'dark';
}

export function PresentationThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PresentationThemePreference>(getInitialTheme);

  const setTheme = (nextTheme: PresentationThemePreference) => {
    setThemeState(nextTheme);
    localStorage.setItem('quickvote-presentation-theme', nextTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return (
    <PresentationThemeContext.Provider value={value}>
      {children}
    </PresentationThemeContext.Provider>
  );
}

export function usePresentationTheme(): PresentationThemeContextValue {
  const ctx = useContext(PresentationThemeContext);
  if (!ctx) throw new Error('usePresentationTheme must be used within PresentationThemeProvider');
  return ctx;
}
