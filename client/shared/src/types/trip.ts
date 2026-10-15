import type { components } from '../generated/api';

export type Trip = components['schemas']['TripResponse'];
export type CreateTripRequest = components['schemas']['CreateTripCommand'];
export type TripStatus = components['schemas']['TripStatus'];
// F22: multi-destination trips. TripStop is a stop as returned by the API; TripStopInput is the
// shape sent when creating a trip or replacing its route.
export type TripStop = components['schemas']['TripStopResponse'];
export type TripStopInput = components['schemas']['TripStopInput'];
