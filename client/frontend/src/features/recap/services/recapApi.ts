import type { TripRecap } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5298';

// F29: the stored recap + photo gallery for a trip. 404 when the feature is off (the gate) or the
// trip isn't visible to the caller.
export async function getRecap(tripId: string): Promise<TripRecap> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/recap`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch recap');
  return res.json();
}

// A gallery photo's url is API-relative (/v1/...); prefix the host so useAuthedBlobUrl can fetch it.
export function recapPhotoUrl(url: string): string {
  return `${BASE}${url}`;
}
