import type { ReservationType, ReservationStatus } from '@explivio/shared';

// F23: presentation helpers for bookings (mirrors the web app's reservationMeta).

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

export function formatReservationTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function reservationDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
