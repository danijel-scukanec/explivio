import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import '../src/i18n'; // F30: initialise i18next before any screen renders
import { OfflineBanner } from '../src/OfflineBanner';
import { theme } from '../src/theme';
import { AuthProvider } from '../src/AuthProvider';
import { AuthGate } from '../src/AuthGate';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style="light" />
        <OfflineBanner />
        <AuthGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.accent },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.bg },
            }}
          />
        </AuthGate>
      </View>
    </AuthProvider>
  );
}
