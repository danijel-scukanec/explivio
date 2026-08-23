import type { Trip, CreateTripRequest } from '@explivio/shared';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_URL}/trips`);
  if (!res.ok) throw new Error('Failed to fetch trips');
  return res.json();
}

export async function getTrip(id: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/trips/${id}`);
  if (!res.ok) throw new Error('Failed to fetch trip');
  return res.json();
}

export async function createTrip(data: CreateTripRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create trip');
  const { id } = await res.json();
  return id;
}
