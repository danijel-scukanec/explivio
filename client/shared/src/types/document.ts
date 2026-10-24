import type { components } from '../generated/api';

// F24: trip documents (Blob-backed). Types come from the OpenAPI schema — do not hand-write.
export type TripDocument = Required<components['schemas']['DocumentResponse']>;
