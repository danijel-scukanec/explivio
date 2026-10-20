import type { ReservationType, ReservationStatus } from '@explivio/shared';

// F23: presentation helpers shared by the Bookings page and the itinerary's per-day booking cards.

export const RESERVATION_TYPES: ReservationType[] = [
  'Flight', 'Accommodation', 'CarRental', 'Restaurant', 'Transport', 'Tour', 'Other',
];

export const RESERVATION_STATUSES: ReservationStatus[] = ['Reserved', 'Confirmed', 'Cancelled'];

export const TYPE_ICONS: Record<ReservationType, string> = {
  Flight: '✈️',
  Accommodation: '🏨',
  CarRental: '🚗',
  Restaurant: '🍽',
  Transport: '🚆',
  Tour: '🎟',
  Other: '📌',
};

export const TYPE_LABELS: Record<ReservationType, string> = {
  Flight: 'Flight',
  Accommodation: 'Stay',
  CarRental: 'Car rental',
  Restaurant: 'Restaurant',
  Transport: 'Transport',
  Tour: 'Tour',
  Other: 'Other',
};

export function reservationStatusColor(status: ReservationStatus): string {
  switch (status) {
    case 'Confirmed': return '#2f855a';
    case 'Reserved': return '#b7791f';
    case 'Cancelled': return '#a0aec0';
  }
}

// StartsAt/EndsAt are ISO date-time strings. Format just the time for a day view.
export function formatReservationTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function reservationDateKey(iso: string): string {
  // Local calendar day (YYYY-MM-DD) so a booking lands on the itinerary day it starts.
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
