import type { Reservation, CreateReservationRequest, UpdateReservationRequest } from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getReservations(tripId: string): Promise<Reservation[]> {
  const res = await fetch(`${API_URL}/trips/${tripId}/reservations`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch reservations');
  return res.json();
}

export async function createReservation(tripId: string, data: CreateReservationRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/reservations`, {
    method: 'POST',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to create reservation');
  const { id } = await res.json();
  return id;
}

export async function updateReservation(tripId: string, id: string, data: UpdateReservationRequest): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/reservations/${id}`, {
    method: 'PUT',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId, id }),
  });
  if (!res.ok) throw new Error('Failed to update reservation');
}

export async function deleteReservation(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/reservations/${id}`, {
    method: 'DELETE',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to delete reservation');
}
