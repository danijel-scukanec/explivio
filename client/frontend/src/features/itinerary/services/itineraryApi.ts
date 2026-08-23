import type { Activity, CreateActivityRequest } from '@explivio/shared';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getActivities(tripId: string): Promise<Activity[]> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities`);
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}

export async function createActivity(tripId: string, data: CreateActivityRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to create activity');
  const { id } = await res.json();
  return id;
}

export async function deleteActivity(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/activities/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete activity');
}
