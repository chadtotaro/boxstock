import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  toggle: () => {},
  isDark: true,
});

const STORAGE_KEY = 'miniz-theme';

/* ── CSS custom property definitions ─────────────────────────────── */

const darkTokens: Record<string, string> = {
  '--c-bg': '#0F1115',
  '--c-bg-panel': '#14171D',
  '--c-bg-elevated': '#14171D',
  '--c-bg-hover': 'rgba(255,255,255,0.03)',
  '--c-bg-input': 'rgba(255,255,255,0.04)',
  '--c-bg-input-solid': '#0F1115',

  '--c-border': '#1E222A',
  '--c-border-subtle': 'rgba(255,255,255,0.05)',
  '--c-border-dashed': 'rgba(255,255,255,0.12)',

  '--c-text': '#EAEDF3',
  '--c-text-secondary': '#DADFE8',
  '--c-text-muted': '#555B68',
  '--c-text-dim': '#3A3F4A',
  '--c-text-icon': '#6B7280',
  '--c-text-icon-disabled': '#2C303A',

  '--c-accent': '#00D4FF',
  '--c-accent-hover': '#33DEFF',
  '--c-accent-bg': 'rgba(0,212,255,0.1)',
  '--c-accent-bg-subtle': 'rgba(0,212,255,0.06)',
  '--c-accent-bg-hover': 'rgba(0,212,255,0.08)',
  '--c-accent-border': 'rgba(0,212,255,0.2)',
  '--c-accent-border-strong': 'rgba(0,212,255,0.3)',

  '--c-error': '#FF3355',
  '--c-error-bg': 'rgba(255,51,85,0.12)',
  '--c-error-border': 'rgba(255,51,85,0.45)',
  '--c-error-border-toast': '#2A1E1E',
  '--c-success': '#3A8F5C',
  '--c-warning': '#7A5E2A',

  '--c-grid-line': '#1E222A',
  '--c-grid-dash': 'rgba(255,255,255,0.06)',
  '--c-grid-dot': 'rgba(255,255,255,0.05)',
  '--c-grid-crosshair': '#1A1E26',
  '--c-canvas-bg': '#0F1115',

  '--c-minimap-bg': 'rgba(14,17,21,0.92)',
  '--c-minimap-inner': '#0A0C10',
  '--c-minimap-grid': '#161920',

  '--c-overlay': 'rgba(0,0,0,0.6)',
  '--c-shadow': 'rgba(0,0,0,0.4)',
  '--c-shadow-strong': 'rgba(0,0,0,0.5)',

  '--c-tile-dark': '#161920',
  '--c-tag-color': '#00D4FF',
  '--c-tag-bg': 'rgba(0,212,255,0.08)',
  '--c-tag-border': 'rgba(0,212,255,0.15)',
  '--c-tag-muted': 'rgba(0,212,255,0.6)',
  '--c-tag-muted-bg': 'rgba(0,212,255,0.06)',

  '--c-card-hover-border': 'rgba(255,255,255,0.1)',
  '--c-menu-bg': '#1A1E26',
  '--c-menu-border': '#2A2E38',
  '--c-kbd-bg': 'rgba(255,255,255,0.06)',
  '--c-kbd-border': 'rgba(255,255,255,0.1)',

  '--c-scroll-thumb': 'rgba(255,255,255,0.1)',
};

const lightTokens: Record<string, string> = {
  '--c-bg': '#F2F3F5',
  '--c-bg-panel': '#FFFFFF',
  '--c-bg-elevated': '#FFFFFF',
  '--c-bg-hover': 'rgba(0,0,0,0.03)',
  '--c-bg-input': 'rgba(0,0,0,0.04)',
  '--c-bg-input-solid': '#F2F3F5',

  '--c-border': '#D4D7DD',
  '--c-border-subtle': 'rgba(0,0,0,0.07)',
  '--c-border-dashed': 'rgba(0,0,0,0.15)',

  '--c-text': '#1A1D23',
  '--c-text-secondary': '#2E3138',
  '--c-text-muted': '#6B7280',
  '--c-text-dim': '#9CA3AF',
  '--c-text-icon': '#6B7280',
  '--c-text-icon-disabled': '#C8CCD4',

  '--c-accent': '#0099CC',
  '--c-accent-hover': '#00B8F0',
  '--c-accent-bg': 'rgba(0,153,204,0.1)',
  '--c-accent-bg-subtle': 'rgba(0,153,204,0.05)',
  '--c-accent-bg-hover': 'rgba(0,153,204,0.08)',
  '--c-accent-border': 'rgba(0,153,204,0.25)',
  '--c-accent-border-strong': 'rgba(0,153,204,0.4)',

  '--c-error': '#DC2626',
  '--c-error-bg': 'rgba(220,38,38,0.08)',
  '--c-error-border': 'rgba(220,38,38,0.35)',
  '--c-error-border-toast': '#F3D4D4',
  '--c-success': '#15803D',
  '--c-warning': '#A16207',

  '--c-grid-line': '#D4D7DD',
  '--c-grid-dash': 'rgba(0,0,0,0.06)',
  '--c-grid-dot': 'rgba(0,0,0,0.08)',
  '--c-grid-crosshair': '#C0C4CC',
  '--c-canvas-bg': '#FFFFFF',

  '--c-minimap-bg': 'rgba(255,255,255,0.95)',
  '--c-minimap-inner': '#F0F1F3',
  '--c-minimap-grid': '#DFE1E5',

  '--c-overlay': 'rgba(0,0,0,0.35)',
  '--c-shadow': 'rgba(0,0,0,0.1)',
  '--c-shadow-strong': 'rgba(0,0,0,0.15)',

  '--c-tile-dark': '#161920',
  '--c-tag-color': '#0077AA',
  '--c-tag-bg': 'rgba(0,119,170,0.08)',
  '--c-tag-border': 'rgba(0,119,170,0.2)',
  '--c-tag-muted': 'rgba(0,119,170,0.65)',
  '--c-tag-muted-bg': 'rgba(0,119,170,0.06)',

  '--c-card-hover-border': 'rgba(0,0,0,0.12)',
  '--c-menu-bg': '#FFFFFF',
  '--c-menu-border': '#D4D7DD',
  '--c-kbd-bg': 'rgba(0,0,0,0.05)',
  '--c-kbd-border': 'rgba(0,0,0,0.1)',

  '--c-scroll-thumb': 'rgba(0,0,0,0.12)',
};

function applyTokens(tokens: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

/* ── Provider ────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {}
    return 'light';
  });

  useEffect(() => {
    applyTokens(mode === 'dark' ? darkTokens : lightTokens);
    document.documentElement.setAttribute('data-theme', mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggle, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
