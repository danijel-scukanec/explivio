import type { GalleryItem, ShareLink, Trip } from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F26: the public trip gallery, share links, likes and cloning.
export async function getGallery(): Promise<GalleryItem[]> {
  const res = await fetch(`${API_URL}/gallery`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to load gallery');
  return res.json();
}

export async function getGalleryTrip(tripId: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/gallery/${tripId}`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to load trip');
  return res.json();
}

export async function getSharedTrip(token: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/trips/shared/${token}`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to load shared trip');
  return res.json();
}

export async function likeTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/like`, { method: 'POST', headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to like');
}

export async function unlikeTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/like`, { method: 'DELETE', headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to unlike');
}

export async function cloneTrip(tripId: string): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/clone`, { method: 'POST', headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to clone');
  const { id } = await res.json();
  return id;
}

// --- owner controls (used from the itinerary share panel) -------------------------------------

export async function setTripVisibility(tripId: string, isPublic: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/visibility`, {
    method: 'PATCH',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ isPublic }),
  });
  if (!res.ok) throw new Error('Failed to change visibility');
}

export async function createShareLink(tripId: string): Promise<ShareLink> {
  const res = await fetch(`${API_URL}/trips/${tripId}/share`, { method: 'POST', headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to create share link');
  return res.json();
}

export async function revokeShareLink(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/share`, { method: 'DELETE', headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to revoke share link');
}

// The viewer-facing URL for a share token.
export function shareUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}
