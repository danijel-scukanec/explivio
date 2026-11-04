import { authHeaders } from '../auth';

// F20 (web push): the browser Web Push client. Registers the service worker, subscribes via the
// PushManager using the server's VAPID public key, and mirrors the subscription to the API so the
// Notifications Worker can push to it. Parallels the mobile Expo registration. Everything here is
// best-effort and guarded by feature + capability checks — on an unsupported browser it's inert.
const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

const SW_URL = '/sw.js';

/** True when this browser can do Web Push at all (SW + PushManager + Notification API present). */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export interface WebPushState {
  supported: boolean;
  permission: NotificationPermission; // 'default' | 'granted' | 'denied'
  subscribed: boolean;
}

/** Current state for the bell button: whether supported, the permission, and if a subscription exists. */
export async function getWebPushState(): Promise<WebPushState> {
  if (!isWebPushSupported()) {
    return { supported: false, permission: 'denied', subscribed: false };
  }
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    subscribed = Boolean(sub);
  } catch {
    /* ignore — treat as not subscribed */
  }
  return { supported: true, permission: Notification.permission, subscribed };
}

/**
 * Turn on web push: register the SW, ask permission, subscribe with the server's VAPID key, and send
 * the subscription to the API. Returns the resulting state. Throws only on an unexpected error; a
 * denied permission or missing server key resolves to a non-subscribed state so the caller can explain.
 */
export async function enableWebPush(): Promise<WebPushState> {
  if (!isWebPushSupported()) return { supported: false, permission: 'denied', subscribed: false };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { supported: true, permission, subscribed: false };
  }

  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    // Web push isn't configured server-side (no VAPID key) — nothing to subscribe to.
    return { supported: true, permission, subscribed: false };
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await sendSubscription(subscription);
  return { supported: true, permission, subscribed: true };
}

/** Turn off web push: unsubscribe locally and remove the subscription from the API. */
export async function disableWebPush(): Promise<WebPushState> {
  if (!isWebPushSupported()) return { supported: false, permission: 'denied', subscribed: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removeSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* best-effort */
  }
  return { supported: true, permission: Notification.permission, subscribed: false };
}

async function fetchVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/devices/web/vapid-key`, { headers: await authHeaders() });
    if (!res.ok) return '';
    const body = (await res.json()) as { publicKey?: string };
    return body.publicKey ?? '';
  } catch {
    return '';
  }
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const body = {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
  const res = await fetch(`${API_URL}/devices/web`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to register web push subscription');
}

async function removeSubscription(endpoint: string): Promise<void> {
  await fetch(`${API_URL}/devices/web?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  }).catch(() => undefined);
}

// VAPID keys are URL-safe base64; the PushManager wants the raw bytes. Backed by a concrete
// ArrayBuffer (not ArrayBufferLike) so it satisfies the BufferSource type expected by subscribe().
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
