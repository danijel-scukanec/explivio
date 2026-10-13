import type { Trip, Activity } from '@explivio/shared';

// On web (expo start --web) the device is the host, so localhost works. For a real device/emulator,
// set EXPO_PUBLIC_API_URL to the host's LAN IP (emulators also have their own aliases). The dev API
// injects a fake identity, so no auth header is needed for read-only screens.
const API_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5298'}/v1`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const getTrips = () => getJson<Trip[]>('/trips');
export const getTrip = (tripId: string) => getJson<Trip>(`/trips/${tripId}`);
export const getActivities = (tripId: string) => getJson<Activity[]>(`/trips/${tripId}/activities`);
