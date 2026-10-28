import type { Trip, TripMember, CreateTripRequest, TripStatus, TripStopInput } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_URL}/trips`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch trips');
  return res.json();
}

export async function getTrip(id: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/trips/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch trip');
  return res.json();
}

export async function createTrip(data: CreateTripRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ stops }),
  });
  if (!res.ok) throw new Error('Failed to update trip route');
}

// F22: change a trip's lifecycle status.
export async function setTripStatus(id: string, status: TripStatus): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/status`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update trip status');
}

// F25: change the currency the trip's budget is reported in.
export async function setTripBaseCurrency(id: string, baseCurrency: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/base-currency`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ baseCurrency }),
  });
  if (!res.ok) throw new Error('Failed to update base currency');
}

// F15/F25: the trip's members (with display names), used for sharing and for splitting expenses.
export async function getTripMembers(id: string): Promise<TripMember[]> {
  const res = await fetch(`${API_URL}/trips/${id}/members`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch trip members');
  return res.json();
}

// F22: upload (or replace) a trip's cover photo. No Content-Type header — the browser sets the
// multipart boundary itself.
export async function setTripCover(id: string, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/trips/${id}/cover`, {
    method: 'POST',
    headers: await authHeaders(),
    body,
  });
  if (!res.ok) throw new Error('Failed to upload cover photo');
}

// F22 / P-Auth: the API path a cover is streamed from (behind trip authorization). Loaded via
// useAuthedBlobUrl (fetch + auth header → object URL), since an <img> can't send the auth header.
export function tripCoverUrl(id: string): string {
  return `${API_URL}/trips/${id}/cover`;
}
