import type {
  Checklist,
  CreateChecklistRequest,
  RenameChecklistRequest,
  AddChecklistItemRequest,
  UpdateChecklistItemRequest,
} from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F24: packing lists / checklists for a trip. Several named lists, each with items.
export async function getChecklists(tripId: string): Promise<Checklist[]> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch checklists');
  return res.json();
}

export async function createChecklist(tripId: string, data: CreateChecklistRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists`, {
    method: 'POST',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to create checklist');
  const { id } = await res.json();
  return id;
}

export async function renameChecklist(tripId: string, id: string, data: RenameChecklistRequest): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists/${id}`, {
    method: 'PUT',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId, id }),
  });
  if (!res.ok) throw new Error('Failed to rename checklist');
}

export async function deleteChecklist(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists/${id}`, {
    method: 'DELETE',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to delete checklist');
}

export async function addChecklistItem(
  tripId: string, checklistId: string, data: AddChecklistItemRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists/${checklistId}/items`, {
    method: 'POST',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId, checklistId }),
  });
  if (!res.ok) throw new Error('Failed to add item');
  const { id } = await res.json();
  return id;
}

export async function updateChecklistItem(
  tripId: string, checklistId: string, id: string, data: UpdateChecklistItemRequest): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists/${checklistId}/items/${id}`, {
    method: 'PUT',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId, checklistId, id }),
  });
  if (!res.ok) throw new Error('Failed to update item');
}

export async function deleteChecklistItem(tripId: string, checklistId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/checklists/${checklistId}/items/${id}`, {
    method: 'DELETE',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to delete item');
}
