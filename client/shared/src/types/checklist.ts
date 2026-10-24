import type { components } from '../generated/api';

// F24: packing lists / checklists. Types come from the OpenAPI schema — do not hand-write.
export type Checklist = Required<components['schemas']['ChecklistResponse']>;
export type ChecklistItem = Required<components['schemas']['ChecklistItemResponse']>;
export type CreateChecklistRequest = components['schemas']['CreateChecklistCommand'];
export type RenameChecklistRequest = components['schemas']['RenameChecklistCommand'];
export type AddChecklistItemRequest = components['schemas']['AddChecklistItemCommand'];
export type UpdateChecklistItemRequest = components['schemas']['UpdateChecklistItemCommand'];
