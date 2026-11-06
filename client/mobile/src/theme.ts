// Shared visual tokens for the mobile app — mirrors the web app's accent/neutral palette so the two
// clients feel like one product. Two palettes (light/dark); `useTheme()` picks the active one from the
// device setting. Screens read colours through `useTheme()` / `useThemedStyles()` (see ./useTheme), not
// by importing a palette directly, so they react when the system switches between light and dark.

export interface Theme {
  accent: string;
  accentBg: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  textStrong: string;
  danger: string;
}

export const lightTheme: Theme = {
  accent: '#aa3bff',
  accentBg: 'rgba(170, 59, 255, 0.1)',
  bg: '#ffffff',
  card: '#f6f5f7',
  border: '#e5e4e7',
  text: '#6b6375',
  textStrong: '#08060d',
  danger: '#e53e3e',
};

export const darkTheme: Theme = {
  accent: '#c48bff',
  accentBg: 'rgba(196, 139, 255, 0.18)',
  bg: '#16171d',
  card: '#20212a',
  border: '#2e303a',
  text: '#9ca3af',
  textStrong: '#f3f4f6',
  danger: '#f87171',
};
