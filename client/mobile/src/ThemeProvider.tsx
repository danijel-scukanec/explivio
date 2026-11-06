import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type Theme } from './theme';

// Theme preference: follow the device ("system", the default) or pin light/dark. The choice is
// persisted on-device (AsyncStorage) and exposed through context so a change re-renders the whole app.
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

interface ThemeState {
  theme: Theme;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const device = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Load the saved preference once on mount (async; the first render uses "system").
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (v === 'light' || v === 'dark' || v === 'system') setPreferenceState(v); })
      .catch(() => {});
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (device === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeState>(
    () => ({ theme: scheme === 'dark' ? darkTheme : lightTheme, scheme, preference, setPreference }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Full theme state — used by the settings screen to read/set the preference.
export function useThemeState(): ThemeState {
  const ctx = useContext(ThemeContext);
  // Fallback keeps the app rendering if a consumer mounts outside the provider (shouldn't happen).
  if (!ctx) return { theme: lightTheme, scheme: 'light', preference: 'system', setPreference: () => {} };
  return ctx;
}
