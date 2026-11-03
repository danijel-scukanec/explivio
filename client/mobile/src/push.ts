import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDevice, unregisterDevice } from './api';

// F20 (push): the mobile client half. Registers this device's Expo push token with the API (which the
// Notifications Worker uses to send push) and presents notifications received while the app is open.
//
// Remote push requires a DEVELOPMENT BUILD, not Expo Go (SDK 53+ dropped remote push from Expo Go on
// Android) — see mobile AGENTS.md. Everything here is best-effort: on web, in Expo Go, without
// permission, or offline it simply no-ops, so the app behaves exactly as before until push is set up.

// Foreground presentation. Without a handler, notifications aren't shown while the app is open. SDK 57
// replaced the old shouldShowAlert with shouldShowBanner / shouldShowList.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const TOKEN_KEY = 'explivio.pushToken';

// getExpoPushTokenAsync needs the EAS project id. It's in app.json (extra.eas.projectId); easConfig is
// the fallback the SDK itself reads.
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

// Register this device for push and send its token to the API. Safe to call on every app start — the
// backend upserts by token, so repeats are cheap and keep LastSeenAt fresh.
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // Android needs a channel in place before the permission prompt / token request.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token) return;

    if (await registerDevice(token, Platform.OS)) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Expo Go, no FCM credentials, offline, permission dialog dismissed — retry next launch.
  }
}

// Unregister on sign-out so the user stops receiving push for this device.
export async function unregisterForPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await unregisterDevice(token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort
  }
}

// The trip a push points at, from its data payload (the worker sets data.tripId).
export function tripIdFromResponse(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as { tripId?: string } | undefined;
  return typeof data?.tripId === 'string' ? data.tripId : null;
}
