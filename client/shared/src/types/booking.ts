import type { components } from '../generated/api';

// F18: the result of parsing a booking email/file — a summary plus draft items, each classified by the
// model as an activity or a reservation, that the client reviews and adds.
export type ExtractedBookings = components['schemas']['ExtractedBookings'];
export type ExtractedBookingItem = components['schemas']['ExtractedBookingItem'];
export type ExtractedItemKind = components['schemas']['ExtractedItemKind'];
