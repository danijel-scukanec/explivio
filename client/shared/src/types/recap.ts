import type { components } from '../generated/api';

// F29: the stored AI trip recap (narrative + when it was generated) plus the photo gallery the recap
// page shows (the trip cover + any image documents).
export type TripRecap = components['schemas']['RecapResponse'];
export type RecapPhoto = components['schemas']['RecapPhoto'];
