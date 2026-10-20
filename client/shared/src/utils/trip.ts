import type { TripStatus } from '../types/trip';
import { getLocale } from './locale';

export function getTripDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function formatTripDate(date: string): string {
  return new Date(date).toLocaleDateString(getLocale() ?? 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// F22: trip lifecycle status presentation, shared by web and mobile so the badge colours match.
// Order mirrors the natural lifecycle, and doubles as the filter order.
export const TRIP_STATUSES: TripStatus[] = ['Draft', 'Planned', 'Active', 'Completed', 'Cancelled'];

const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  Draft: '#9ca3af',
  Planned: '#6366f1',
  Active: '#16a34a',
  Completed: '#64748b',
  Cancelled: '#dc2626',
};

export function tripStatusColor(status: TripStatus): string {
  return TRIP_STATUS_COLORS[status] ?? '#9ca3af';
}
