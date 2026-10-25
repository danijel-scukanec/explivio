import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F27: download the itinerary as a calendar file (.ics) or a printable PDF. The export endpoint is
// auth-gated (Viewer role), so we fetch with the dev-user header and save the blob, rather than
// pointing a plain <a href> at it (which couldn't carry the header). The server's filename sits in
// Content-Disposition, but a cross-origin fetch can't read that header (CORS doesn't expose it), so
// the caller passes the trip name and we build the same "<slug>-itinerary.<ext>" name client-side.
export async function downloadItinerary(tripId: string, format: 'ics' | 'pdf', tripName?: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/calendar/export?format=${format}`, {
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to export itinerary');

  const blob = await res.blob();
  const fileName = `${slug(tripName)}-itinerary.${format}`;
  saveBlob(blob, fileName);
}

function slug(value?: string): string {
  const s = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'trip';
}

// F27: the anonymous subscription feed URL for a trip's share token — the "sync" link that Google,
// Outlook or Apple Calendar poll. The token is the credential, so no auth is attached. We return the
// https URL (Google's "from URL" wants https) and a webcal:// variant (Apple/Outlook prefer it).
export function calendarFeedUrl(token: string): string {
  return `${API_URL}/calendar/${token}.ics`;
}

export function calendarWebcalUrl(token: string): string {
  return calendarFeedUrl(token).replace(/^https?:/, 'webcal:');
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
