import type { Trip, CreateTripRequest, TripStatus, TripStopInput } from '@explivio/shared';
import { withDevUser, devUserQuery } from '../../../shared/devUser';

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

// F22: replace a trip's ordered route (multi-destination).
export async function setTripStops(id: string, stops: TripStopInput[]): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/stops`, {
    method: 'PUT',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ stops }),
  });
  if (!res.ok) throw new Error('Failed to update trip route');
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

// F22: upload (or replace) a trip's cover photo. No Content-Type header — the browser sets the
// multipart boundary itself.
export async function setTripCover(id: string, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/trips/${id}/cover`, {
    method: 'POST',
    headers: withDevUser(),
    body,
  });
  if (!res.ok) throw new Error('Failed to upload cover photo');
}

// F22: the URL an <img> loads a cover from. The image is streamed by the API behind the trip's
// authorization, so the dev-user is passed as a query param (an <img> can't send headers); `version`
// busts the browser cache after a re-upload.
export function tripCoverUrl(id: string, version?: number): string {
  const dev = devUserQuery(); // '' or '?devUser=...'
  const v = version ? `${dev ? '&' : '?'}v=${version}` : '';
  return `${API_URL}/trips/${id}/cover${dev}${v}`;
}
