import { useMemo } from 'react';
import { type Theme } from './theme';
import { useThemeState } from './ThemeProvider';

// The active palette, resolved from the user's theme preference (system/light/dark). Re-renders when
// the preference changes or — in "system" mode — when the device switches appearance.
export function useTheme(): Theme {
  return useThemeState().theme;
}

// Build a StyleSheet from the active palette, memoised per theme. Screens define a `makeStyles(theme)`
// factory at module scope and call `const styles = useThemedStyles(makeStyles)` inside the component.
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]);
}
