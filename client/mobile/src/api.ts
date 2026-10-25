import type {
  Trip,
  TripMember,
  Activity,
  BudgetSummary,
  BudgetBalances,
  CreateTripRequest,
  CreateActivityRequest,
  UpdateActivityRequest,
  AddExpenseRequest,
  Reservation,
  CreateReservationRequest,
  UpdateReservationRequest,
  TripStatus,
  TripStopInput,
  TripConditions,
  Checklist,
  TripDocument,
  GalleryItem,
  ShareLink,
} from '@explivio/shared';
import { cachedFetch, enqueue, flushQueue, type QueuedMutation } from './offline';

// On web (expo start --web) the device is the host, so localhost works. For a real device/emulator,
// set EXPO_PUBLIC_API_URL to the host's LAN IP (emulators also have their own aliases). The dev API
// injects a fake identity, so no auth header is needed.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5298';
const API_URL = `${API_BASE}/v1`;

function rawSend(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// GET with a read-through cache — serves the last-known data when the network is unavailable (F31).
function getJson<T>(path: string): Promise<T> {
  return cachedFetch<T>(`GET ${path}`, async () => {
    const res = await rawSend('GET', path);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json() as Promise<T>;
  });
}

// A mutation that queues itself for replay when the device can't reach the server. We split the two
// failure modes by WHERE they happen rather than by error type (RN/Hermes doesn't reliably throw a
// `TypeError` for a dropped network): if `fetch` rejects before we get a Response, the server was
// unreachable — treat it as offline and queue. If we got a Response with a non-2xx status, the server
// was reached and rejected the request — that's a real failure, so surface it.
async function mutate<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  let res: Response;
  try {
    res = await rawSend(method, path, body);
  } catch {
    await enqueue({ method, path, body });
    return null; // offline — queued, will sync on reconnect
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  // DELETE and 204 No Content carry no body to parse.
  return method === 'DELETE' || res.status === 204 ? null : ((await res.json()) as T);
}

// Replay queued mutations against the server (called on reconnect). Returns how many were flushed.
export function syncQueue(): Promise<number> {
  return flushQueue(async (m: QueuedMutation) => {
    const res = await rawSend(m.method, m.path, m.body);
    // A replayed delete whose target is already gone (404) is fine; other non-2xx is a real failure.
    if (!res.ok && res.status !== 404) throw new Error(`replay failed (${res.status})`);
  });
}

// Trips
export const getTrips = () => getJson<Trip[]>('/trips');
export const getTrip = (tripId: string) => getJson<Trip>(`/trips/${tripId}`);
export const createTrip = (data: CreateTripRequest) => mutate<{ id: string }>('POST', '/trips', data);
export const deleteTrip = (tripId: string) => mutate('DELETE', `/trips/${tripId}`);
// F22: change a trip's lifecycle status (queues offline like any other mutation).
export const setTripStatus = (tripId: string, status: TripStatus) =>
  mutate('PATCH', `/trips/${tripId}/status`, { status });

// F22: replace a trip's ordered route (multi-destination).
export const setTripStops = (tripId: string, stops: TripStopInput[]) =>
  mutate('PUT', `/trips/${tripId}/stops`, { stops });

// F25: change the currency the trip's budget is reported in.
export const setTripBaseCurrency = (tripId: string, baseCurrency: string) =>
  mutate('PATCH', `/trips/${tripId}/base-currency`, { baseCurrency });

// F15/F25: the trip's members (with display names), for sharing and splitting expenses.
export const getTripMembers = (tripId: string) => getJson<TripMember[]>(`/trips/${tripId}/members`);

// Itinerary
export const getActivities = (tripId: string) => getJson<Activity[]>(`/trips/${tripId}/activities`);
export const createActivity = (tripId: string, data: CreateActivityRequest) =>
  mutate<{ id: string }>('POST', `/trips/${tripId}/activities`, { ...data, tripId });
// F23: edit an activity in place (name, category, times, …).
export const updateActivity = (tripId: string, id: string, data: UpdateActivityRequest) =>
  mutate('PUT', `/trips/${tripId}/activities/${id}`, { ...data, tripId, id });
// F23: persist a day's new order (by id); the server rewrites each activity's SortOrder.
export const reorderActivities = (tripId: string, orderedActivityIds: string[]) =>
  mutate('PUT', `/trips/${tripId}/activities/reorder`, { tripId, orderedActivityIds });
export const deleteActivity = (tripId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/activities/${id}`);
// AI generation streams over the itinerary-generation hub — see useItineraryGeneration.

// F23: reservations (bookings). A booking's cost is mirrored into the budget server-side.
export const getReservations = (tripId: string) => getJson<Reservation[]>(`/trips/${tripId}/reservations`);
export const createReservation = (tripId: string, data: CreateReservationRequest) =>
  mutate<{ id: string }>('POST', `/trips/${tripId}/reservations`, { ...data, tripId });
export const updateReservation = (tripId: string, id: string, data: UpdateReservationRequest) =>
  mutate('PUT', `/trips/${tripId}/reservations/${id}`, { ...data, tripId, id });
export const deleteReservation = (tripId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/reservations/${id}`);

// Budget
export const getBudget = (tripId: string) => getJson<BudgetSummary>(`/trips/${tripId}/expenses`);
// F25: settle-up balances across the trip's split expenses.
export const getBudgetBalances = (tripId: string) => getJson<BudgetBalances>(`/trips/${tripId}/expenses/balances`);
export const addExpense = (tripId: string, data: AddExpenseRequest) =>
  mutate<{ id: string }>('POST', `/trips/${tripId}/expenses`, { ...data, tripId });
export const deleteExpense = (tripId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/expenses/${id}`);

// F28: destination conditions — per-stop time zone, local currency + live rate, per-day weather.
// Read-through cached like the other GETs so it survives going offline.
export const getTripConditions = (tripId: string) =>
  getJson<TripConditions>(`/trips/${tripId}/conditions`);

// F25: fetch the budget export as text (CSV) — the mobile UI shares it via the OS share sheet. Not a
// cached/queued call: it's an on-demand download that only makes sense online.
export async function fetchBudgetCsv(tripId: string): Promise<string> {
  const res = await rawSend('GET', `/trips/${tripId}/expenses/export?format=csv`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.text();
}

// F27: fetch the itinerary as an iCalendar (.ics) document — shared as text via the OS share sheet,
// mirroring the budget CSV. (PDF export is web-only: a binary file needs expo-file-system/-sharing,
// deliberately not added for a secondary feature.) Online-only, like the CSV.
export async function fetchItineraryIcs(tripId: string): Promise<string> {
  const res = await rawSend('GET', `/trips/${tripId}/calendar/export?format=ics`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.text();
}

// F27: the anonymous subscription-feed URL for a share token — the live link Google/Outlook/Apple
// Calendar poll. The token is the credential, so no auth is attached. webcal:// opens the device's
// calendar app directly.
export const calendarFeedUrl = (token: string) => `${API_URL}/calendar/${token}.ics`;
export const calendarWebcalUrl = (token: string) => calendarFeedUrl(token).replace(/^https?:/, 'webcal:');

// F24: checklists (packing lists / to-dos). Named lists, each with items. Mutations queue offline
// like every other JSON mutation.
export const getChecklists = (tripId: string) => getJson<Checklist[]>(`/trips/${tripId}/checklists`);
export const createChecklist = (tripId: string, name: string) =>
  mutate<{ id: string }>('POST', `/trips/${tripId}/checklists`, { tripId, name });
export const deleteChecklist = (tripId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/checklists/${id}`);
export const addChecklistItem = (tripId: string, checklistId: string, text: string) =>
  mutate<{ id: string }>('POST', `/trips/${tripId}/checklists/${checklistId}/items`, { tripId, checklistId, text });
export const updateChecklistItem = (
  tripId: string, checklistId: string, id: string, text: string, isChecked: boolean) =>
  mutate('PUT', `/trips/${tripId}/checklists/${checklistId}/items/${id}`, { tripId, checklistId, id, text, isChecked });
export const deleteChecklistItem = (tripId: string, checklistId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/checklists/${checklistId}/items/${id}`);

// F24: trip documents (Blob-backed). List/delete are ordinary JSON calls; upload is multipart and
// online-only — binary bodies don't fit the offline replay queue, so it isn't routed through mutate().
export const getDocuments = (tripId: string) => getJson<TripDocument[]>(`/trips/${tripId}/documents`);
export const deleteDocument = (tripId: string, id: string) =>
  mutate('DELETE', `/trips/${tripId}/documents/${id}`);
export const documentContentUrl = (tripId: string, id: string) =>
  `${API_URL}/trips/${tripId}/documents/${id}/content`;

export async function uploadDocument(
  tripId: string, file: { uri: string; name: string; mimeType?: string }): Promise<TripDocument> {
  const form = new FormData();
  // React Native's FormData takes a {uri, name, type} object for file parts.
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as unknown as Blob);
  const res = await fetch(`${API_URL}/trips/${tripId}/documents`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<TripDocument>;
}

// F26: the public gallery, likes, cloning and share links. The gallery list is read-through cached so
// it survives going offline; likes/clone/visibility are queued mutations.
export const getGallery = () => getJson<GalleryItem[]>('/gallery');
export const getGalleryTrip = (tripId: string) => getJson<Trip>(`/gallery/${tripId}`);
export const getSharedTrip = (token: string) => getJson<Trip>(`/trips/shared/${token}`);
export const likeTrip = (tripId: string) => mutate('POST', `/trips/${tripId}/like`);
export const unlikeTrip = (tripId: string) => mutate('DELETE', `/trips/${tripId}/like`);
export const cloneTrip = (tripId: string) => mutate<{ id: string }>('POST', `/trips/${tripId}/clone`);
export const setTripVisibility = (tripId: string, isPublic: boolean) =>
  mutate('PATCH', `/trips/${tripId}/visibility`, { isPublic });
export const revokeShareLink = (tripId: string) => mutate('DELETE', `/trips/${tripId}/share`);

// Minting a share link must return the token, so it's online-only (not routed through the offline
// queue, which discards responses).
export async function createShareLink(tripId: string): Promise<ShareLink> {
  const res = await rawSend('POST', `/trips/${tripId}/share`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<ShareLink>;
}
