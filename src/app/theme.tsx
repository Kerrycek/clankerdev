import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useUiSettings, type UiThemePreference } from './uiSettings';

export type EffectiveTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: UiThemePreference;
  effective: EffectiveTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const ui = useUiSettings();
  const preference = ui.settings.theme;

  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    onChange();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // Safari fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const effective: EffectiveTheme = preference === 'system' ? systemTheme : preference;

  // Apply theme override to <html>.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    if (preference === 'system') {
      html.removeAttribute('data-theme');
      // Ensure system mode uses platform-appropriate form controls.
      html.style.colorScheme = 'light dark';
      return;
    }

    html.setAttribute('data-theme', preference);
    // Let CSS handle explicit theme color-scheme.
    html.style.colorScheme = '';
  }, [preference]);

  const ctx: ThemeContextValue = useMemo(
    () => ({
      preference,
      effective,
    }),
    [effective, preference]
  );

  return <ThemeContext.Provider value={ctx}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
