import type { TripConditions } from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F28: destination conditions for a trip — per-stop time zone, local currency + live rate, per-day
// weather. Read-only; the itinerary page loads it lazily alongside the trip.
export async function getTripConditions(tripId: string): Promise<TripConditions> {
  const res = await fetch(`${API_URL}/trips/${tripId}/conditions`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch conditions');
  return res.json();
}
