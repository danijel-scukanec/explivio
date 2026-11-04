import type { components } from '../generated/api';

// F26: public gallery, share links and likes. Types come from the OpenAPI schema — do not hand-write.
export type GalleryItem = Required<components['schemas']['GalleryItemResponse']>;
export type ShareLink = Required<components['schemas']['ShareLinkResponse']>;

// F26 (follow): a user's public profile (display name, counts, follow state).
export type UserProfile = Required<components['schemas']['UserProfileResponse']>;
