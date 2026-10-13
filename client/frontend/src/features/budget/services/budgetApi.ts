import type { BudgetSummary, AddExpenseRequest } from '@explivio/shared';
import { withDevUser } from '../../../shared/devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getBudgetSummary(tripId: string): Promise<BudgetSummary> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
}

export async function addExpense(tripId: string, data: AddExpenseRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
    method: 'POST',
    headers: withDevUser({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to add expense');
  const { id } = await res.json();
  return id;
}

export async function deleteExpense(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses/${id}`, {
    method: 'DELETE',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to delete expense');
}
