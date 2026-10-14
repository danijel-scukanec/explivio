import AsyncStorage from '@react-native-async-storage/async-storage';

// F31: lightweight offline support. Reads are cached (last-known data is shown when the network is
// down); write mutations that fail because the device is offline are queued and replayed on reconnect.
// This is a pragmatic version — it does not do optimistic UI or conflict resolution (a production app
// would add both); it gives offline reads and eventual write sync.

const QUEUE_KEY = '@explivio/mutation-queue';

export interface QueuedMutation {
  method: string;
  path: string;
  body?: unknown;
}

// Fetch fresh and cache it; on failure (e.g. offline), fall back to the cached value if present.
export async function cachedFetch<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const fresh = await fetcher();
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
    return fresh;
  } catch (err) {
    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
    if (cached != null) return JSON.parse(cached) as T;
    throw err;
  }
}

export async function getQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

async function setQueue(q: QueuedMutation[]): Promise<void> {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

export async function enqueue(m: QueuedMutation): Promise<void> {
  const q = await getQueue();
  q.push(m);
  await setQueue(q);
}

export async function queueCount(): Promise<number> {
  return (await getQueue()).length;
}

// Replay queued mutations in order, oldest first; stop on the first that fails (keeps the rest queued
// so order is preserved). Returns how many were flushed.
//
// A single in-flight flush at a time: reconnects can fire from several places at once (the banner's
// hook, a connectivity flap, a dev double-mount), and two concurrent flushes would each read the same
// queue and replay every item twice. Coalescing onto one promise keeps replay exactly-once.
let flushing: Promise<number> | null = null;

export function flushQueue(send: (m: QueuedMutation) => Promise<void>): Promise<number> {
  if (flushing) return flushing;
  flushing = runFlush(send).finally(() => { flushing = null; });
  return flushing;
}

async function runFlush(send: (m: QueuedMutation) => Promise<void>): Promise<number> {
  let q = await getQueue();
  let done = 0;
  while (q.length > 0) {
    try {
      await send(q[0]);
      q = q.slice(1);
      await setQueue(q);
      done++;
    } catch {
      break;
    }
  }
  return done;
}
