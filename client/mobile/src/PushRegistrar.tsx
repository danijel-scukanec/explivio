import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { authEnabled, useAuth } from './AuthProvider';
import { registerForPush, routeFromResponse } from './push';

// F20 (push): mounts under the auth context and the router. Registers the device for push once the
// user is signed in (or immediately in dev-identity mode) and deep-links to a trip when a push is
// tapped. Renders nothing. Everything it calls is best-effort, so it's inert until push is set up.
export function PushRegistrar() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  // Register when there's an identity to attach the token to. Under real auth, wait for sign-in; in
  // dev-identity mode (authEnabled false) the API always has the dev user, so register right away.
  useEffect(() => {
    if (authEnabled && !isAuthenticated) return;
    void registerForPush();
  }, [isAuthenticated]);

  // useLastNotificationResponse covers both a cold start (app opened from a tap) and taps while the app
  // is running; dedupe by the notification id so a re-render doesn't navigate twice.
  useEffect(() => {
    const id = lastResponse?.notification.request.identifier;
    if (!lastResponse || !id || handledId.current === id) return;
    handledId.current = id;

    const route = routeFromResponse(lastResponse);
    if (route) router.push(route);
  }, [lastResponse, router]);

  return null;
}
