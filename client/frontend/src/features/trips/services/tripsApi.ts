import type { Trip, CreateTripRequest, TripStatus } from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_URL}/trips`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch trips');
  return res.json();
}

export async function getTrip(id: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/trips/${id}`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch trip');
  return res.json();
}

export async function createTrip(data: CreateTripRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips`, {
    method: 'POST',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create trip');
  const { id } = await res.json();
  return id;
}

// F22: change a trip's lifecycle status.
export async function setTripStatus(id: string, status: TripStatus): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/status`, {
    method: 'PATCH',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update trip status');
}
