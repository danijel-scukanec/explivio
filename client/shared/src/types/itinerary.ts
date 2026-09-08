import type { components } from '../generated/api';

export type Activity = Required<components['schemas']['Activity']>;
export type ActivityCategory = components['schemas']['ActivityCategory'];
export type CreateActivityRequest = components['schemas']['CreateActivityCommand'];

// F12/F13: AI-generated itinerary draft (structured output from the /generate endpoint and the
// streaming hub). Types come from the OpenAPI schema — do not hand-write.
export type GeneratedItinerary = Required<components['schemas']['GeneratedItinerary']>;
export type GeneratedActivity = Required<components['schemas']['GeneratedActivity']>;
export type GenerateItineraryRequest = components['schemas']['GenerateItineraryCommand'];
