import type { components } from '../generated/api';

// F26: public gallery, share links and likes. Types come from the OpenAPI schema — do not hand-write.
export type GalleryItem = Required<components['schemas']['GalleryItemResponse']>;
export type ShareLink = Required<components['schemas']['ShareLinkResponse']>;
