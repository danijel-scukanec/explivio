import type { components } from '../generated/api';

// F23: bookings (flights, hotels, car hire, …). Types come from the OpenAPI schema — do not hand-write.
export type Reservation = Required<components['schemas']['Reservation']>;
export type ReservationType = components['schemas']['ReservationType'];
export type ReservationStatus = components['schemas']['ReservationStatus'];
export type CreateReservationRequest = components['schemas']['CreateReservationCommand'];
export type UpdateReservationRequest = components['schemas']['UpdateReservationCommand'];
