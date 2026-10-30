import type { ExtractedBookings } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F18: parse a booking email/file (.eml, text, HTML, or a screenshot image) into draft activities and
// reservations. Multipart; the browser sets the multipart Content-Type, so authHeaders adds only auth.
export async function parseBooking(tripId: string, file: File): Promise<ExtractedBookings> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/trips/${tripId}/parse-booking`, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error('Failed to parse booking');
  return res.json();
}
