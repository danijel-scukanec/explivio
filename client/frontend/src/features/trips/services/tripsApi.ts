import type { Trip, TripMember, TripRole, CreateTripRequest, TripStatus, TripStopInput } from '@explivio/shared';
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

// F15/F25: the trip's members (with display names + emails), used by the member-management UI and the
// budget split UI.
export async function getTripMembers(id: string): Promise<TripMember[]> {
  const res = await fetch(`${API_URL}/trips/${id}/members`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch trip members');
  return res.json();
}

// F15: the caller's own role on this trip, so the UI can show Owner-only controls.
export async function getMemberRole(id: string): Promise<TripRole> {
  const res = await fetch(`${API_URL}/trips/${id}/members/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch your role');
  const body = await res.json();
  return body.role as TripRole;
}

// Surfaces the API's ProblemDetails `title` (e.g. the last-owner guard) so the UI can show it.
async function problemTitle(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.title === 'string') ? body.title : fallback;
}

// F15: invite someone by email (they must already have an Explivio account).
export async function inviteMember(id: string, email: string, role: TripRole): Promise<TripMember> {
  const res = await fetch(`${API_URL}/trips/${id}/members/invite`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(await problemTitle(res, 'Failed to invite member'));
  return res.json();
}

// F15: change a member's role (Owner only; can't demote the last owner).
export async function setMemberRole(id: string, userId: string, role: TripRole): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/members`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error(await problemTitle(res, 'Failed to change role'));
}

// F15: remove a member (Owner only; can't remove the last owner).
export async function removeMember(id: string, userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${id}/members/${userId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await problemTitle(res, 'Failed to remove member'));
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
