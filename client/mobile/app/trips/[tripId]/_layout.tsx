import { Stack } from 'expo-router';
import { useTheme } from '../../../src/useTheme';

// A trip is a Stack: the (tabs) group holds the bottom-tab sections (its own header), and every other
// screen (add/edit forms, members, share, export, conditions, recap, generate, assistant, import) is a
// stack sibling that pushes over the tabs with a back button. Each of those screens sets its own title
// via <Stack.Screen> as before.
export default function TripStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.accent },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
