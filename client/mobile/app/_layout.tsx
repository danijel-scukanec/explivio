import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import '../src/i18n'; // F30: initialise i18next before any screen renders
import { OfflineBanner } from '../src/OfflineBanner';
import { useTheme } from '../src/useTheme';
import { AuthProvider } from '../src/AuthProvider';
import { AuthGate } from '../src/AuthGate';
import { PushRegistrar } from '../src/PushRegistrar';

export default function RootLayout() {
  const theme = useTheme();
  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style="light" />
        <OfflineBanner />
        <PushRegistrar />
        <AuthGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.accent },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            {/* A trip renders its own bottom-tab navigator with its own header. */}
            <Stack.Screen name="trips/[tripId]" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
      </View>
    </AuthProvider>
  );
}
