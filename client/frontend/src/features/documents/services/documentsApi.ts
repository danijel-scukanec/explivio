import type { TripDocument } from '@explivio/shared';
import { withDevUser, devUserQuery } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F24: Blob-backed trip documents. List/delete are JSON; upload is multipart; download is a direct
// link to the content endpoint (the ?devUser suffix carries the dev identity, since an <a> download
// can't set the X-Dev-User header — same trick as the cover image).
export async function getDocuments(tripId: string): Promise<TripDocument[]> {
  const res = await fetch(`${API_URL}/trips/${tripId}/documents`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(tripId: string, file: File): Promise<TripDocument> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/trips/${tripId}/documents`, {
    method: 'POST',
    headers: withDevUser(), // no Content-Type — the browser sets the multipart boundary
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function deleteDocument(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/documents/${id}`, {
    method: 'DELETE',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to delete document');
}

export function documentContentUrl(tripId: string, id: string): string {
  return `${API_URL}/trips/${tripId}/documents/${id}/content${devUserQuery()}`;
}
