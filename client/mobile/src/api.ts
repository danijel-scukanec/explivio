import type {
  Trip,
  Activity,
  BudgetSummary,
  CreateTripRequest,
  CreateActivityRequest,
  AddExpenseRequest,
} from '@explivio/shared';

// On web (expo start --web) the device is the host, so localhost works. For a real device/emulator,
// set EXPO_PUBLIC_API_URL to the host's LAN IP (emulators also have their own aliases). The dev API
// injects a fake identity, so no auth header is needed.
const API_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5298'}/v1`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

// Trips
export const getTrips = () => getJson<Trip[]>('/trips');
export const getTrip = (tripId: string) => getJson<Trip>(`/trips/${tripId}`);
export const createTrip = (data: CreateTripRequest) => postJson<{ id: string }>('/trips', data);

// Itinerary
export const getActivities = (tripId: string) => getJson<Activity[]>(`/trips/${tripId}/activities`);
export const createActivity = (tripId: string, data: CreateActivityRequest) =>
  postJson<{ id: string }>(`/trips/${tripId}/activities`, { ...data, tripId });
export const deleteActivity = (tripId: string, id: string) =>
  del(`/trips/${tripId}/activities/${id}`);

// Budget
export const getBudget = (tripId: string) => getJson<BudgetSummary>(`/trips/${tripId}/expenses`);
export const addExpense = (tripId: string, data: AddExpenseRequest) =>
  postJson<{ id: string }>(`/trips/${tripId}/expenses`, { ...data, tripId });
export const deleteExpense = (tripId: string, id: string) =>
  del(`/trips/${tripId}/expenses/${id}`);
