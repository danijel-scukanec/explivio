import type { Activity, CreateActivityRequest, UpdateActivityRequest } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getActivities(tripId: string): Promise<Activity[]> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}

export async function createActivity(tripId: string, data: CreateActivityRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to create activity');
  const { id } = await res.json();
  return id;
}

export async function updateActivity(tripId: string, id: string, data: UpdateActivityRequest): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities/${id}`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId, id }),
  });
  if (!res.ok) throw new Error('Failed to update activity');
}

// F23: persist a day's new order. The server rewrites each activity's SortOrder to its index here.
export async function reorderActivities(tripId: string, orderedActivityIds: string[]): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities/reorder`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ tripId, orderedActivityIds }),
  });
  if (!res.ok) throw new Error('Failed to reorder activities');
}

export async function deleteActivity(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete activity');
}
