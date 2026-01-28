import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cmr_theme_mode';

export type ThemeMode = 'light' | 'dark';

function readStoredThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

function applyThemeMode(mode: ThemeMode) {
  document.body.classList.toggle('dark', mode === 'dark');
  document.body.classList.toggle('light', mode === 'light');
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const initial = readStoredThemeMode();
    applyThemeMode(initial);
    return initial;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, mode);
    applyThemeMode(mode);
  }, [mode]);

  const api = useMemo(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
      isDark: mode === 'dark',
    }),
    [mode],
  );

  return api;
}
