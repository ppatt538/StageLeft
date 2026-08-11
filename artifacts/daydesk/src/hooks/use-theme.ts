import { useState, useEffect, useCallback } from 'react';

export type Theme = 'default' | 'warm';

const STORAGE_KEY = 'daydesk-theme';

function applyTheme(theme: Theme) {
  if (theme === 'warm') {
    document.documentElement.setAttribute('data-theme', 'warm');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'warm' ? 'warm' : 'default';
    } catch {
      return 'default';
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'default' ? 'warm' : 'default'));
  }, []);

  return { theme, toggle };
}
