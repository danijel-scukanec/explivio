import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from './theme';

// The active palette for the current device appearance. Re-renders when the system switches light/dark.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

// Build a StyleSheet from the active palette, memoised per theme. Screens define a `makeStyles(theme)`
// factory at module scope and call `const styles = useThemedStyles(makeStyles)` inside the component.
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]);
}
