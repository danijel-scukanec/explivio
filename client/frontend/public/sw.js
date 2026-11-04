/* global self, clients */
// F20 (web push): the service worker that receives browser push and handles clicks. Served at /sw.js
// (root scope) so it covers the whole app. The worker (NotificationsWorker/WebPushSender) sends a JSON
// payload of { title, body, data:{ tripId } }; we show it as an OS notification and, on click, focus an
// open tab (or open a new one) at the trip's itinerary — mirroring the mobile push tap deep-link.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Explivio', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Explivio';
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
    // Collapse repeats for the same trip into one notification rather than stacking.
    tag: payload.data && payload.data.tripId ? `trip-${payload.data.tripId}` : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const tripId = data.tripId;
  // F26 (follow): a "published" notification goes to the public gallery (the recipient is a follower,
  // not a trip member); every other kind opens the trip's itinerary.
  let path = '/';
  if (tripId) path = data.kind === 'TripPublished' ? `/gallery/${tripId}` : `/trips/${tripId}/itinerary`;
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an already-open app tab if there is one; navigate it to the trip.
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      // Otherwise open a new tab.
      if (clients.openWindow) return clients.openWindow(target);
      return undefined;
    }),
  );
});
