import type { components } from '../generated/api';

export type Activity = Required<components['schemas']['Activity']>;
export type ActivityCategory = components['schemas']['ActivityCategory'];
export type CreateActivityRequest = components['schemas']['CreateActivityCommand'];
