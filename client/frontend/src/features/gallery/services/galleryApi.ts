import type { GalleryItem, ShareLink, Trip, UserProfile } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F26: the public trip gallery, share links, likes and cloning.
export async function getGallery(): Promise<GalleryItem[]> {
  const res = await fetch(`${API_URL}/gallery`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load gallery');
  return res.json();
}

// F26 (follow): the "Following" feed — public trips from people the caller follows.
export async function getFollowingGallery(): Promise<GalleryItem[]> {
  const res = await fetch(`${API_URL}/gallery/following`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load following feed');
  return res.json();
}

export async function followUser(userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${userId}/follow`, { method: 'POST', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to follow');
}

export async function unfollowUser(userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${userId}/follow`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to unfollow');
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/users/${userId}/profile`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

export async function getUserTrips(userId: string): Promise<GalleryItem[]> {
  const res = await fetch(`${API_URL}/users/${userId}/trips`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load user trips');
  return res.json();
}

export async function getGalleryTrip(tripId: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/gallery/${tripId}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load trip');
  return res.json();
}

export async function getSharedTrip(token: string): Promise<Trip> {
  const res = await fetch(`${API_URL}/trips/shared/${token}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load shared trip');
  return res.json();
}

export async function likeTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/like`, { method: 'POST', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to like');
}

export async function unlikeTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/like`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to unlike');
}

export async function cloneTrip(tripId: string): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/clone`, { method: 'POST', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to clone');
  const { id } = await res.json();
  return id;
}

// --- owner controls (used from the itinerary share panel) -------------------------------------

export async function setTripVisibility(tripId: string, isPublic: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/visibility`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ isPublic }),
  });
  if (!res.ok) throw new Error('Failed to change visibility');
}

export async function createShareLink(tripId: string): Promise<ShareLink> {
  const res = await fetch(`${API_URL}/trips/${tripId}/share`, { method: 'POST', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to create share link');
  return res.json();
}

export async function revokeShareLink(tripId: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/share`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to revoke share link');
}

// The viewer-facing URL for a share token.
export function shareUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}
