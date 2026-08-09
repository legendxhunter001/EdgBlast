import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type FontSize = 'sm' | 'md' | 'lg';
type Density = 'compact' | 'spacious';
type ChartStyle = 'minimal' | 'detailed';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
  toggleTheme: () => void;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  density: Density;
  setDensity: (d: Density) => void;
  chartStyle: ChartStyle;
  setChartStyle: (c: ChartStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  theme: 'dark',
  setMode: () => {},
  toggleTheme: () => {},
  fontSize: 'md',
  setFontSize: () => {},
  density: 'spacious',
  setDensity: () => {},
  chartStyle: 'detailed',
  setChartStyle: () => {},
});

const KEY_MODE = 'edge-theme-mode';
const KEY_FONT = 'edge-font-size';
const KEY_DENSITY = 'edge-density';
const KEY_CHART = 'edge-chart-style';

const readSystem = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(KEY_MODE);
  const legacy = localStorage.getItem('edge-theme');
  if (!stored && (legacy === 'light' || legacy === 'dark')) return legacy as ThemeMode;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
};

const getStored = <T extends string>(key: string, fallback: T, allowed: T[]): T => {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystem);
  const [fontSize, setFontSizeState] = useState<FontSize>(() => getStored(KEY_FONT, 'md', ['sm', 'md', 'lg']));
  const [density, setDensityState] = useState<Density>(() => getStored(KEY_DENSITY, 'spacious', ['compact', 'spacious']));
  const [chartStyle, setChartStyleState] = useState<ChartStyle>(() => getStored(KEY_CHART, 'detailed', ['minimal', 'detailed']));

  const theme: ResolvedTheme = mode === 'system' ? systemTheme : mode;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    const t = window.setTimeout(() => root.classList.remove('theme-transition'), 350);
    return () => window.clearTimeout(t);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const map = { sm: '14px', md: '16px', lg: '18px' } as const;
    root.style.fontSize = map[fontSize];
    localStorage.setItem(KEY_FONT, fontSize);
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;
    localStorage.setItem(KEY_DENSITY, density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem(KEY_CHART, chartStyle);
    document.documentElement.dataset.chartStyle = chartStyle;
  }, [chartStyle]);

  useEffect(() => { localStorage.setItem(KEY_MODE, mode); }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleTheme = useCallback(() => setModeState(theme === 'dark' ? 'light' : 'dark'), [theme]);

  return (
    <ThemeContext.Provider
      value={{
        mode, theme, setMode, toggleTheme,
        fontSize, setFontSize: setFontSizeState,
        density, setDensity: setDensityState,
        chartStyle, setChartStyle: setChartStyleState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
