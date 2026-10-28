import type { BudgetSummary, BudgetBalances, AddExpenseRequest } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

export async function getBudgetSummary(tripId: string): Promise<BudgetSummary> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
}

// F25: settle-up balances across the trip's split expenses.
export async function getBudgetBalances(tripId: string): Promise<BudgetBalances> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses/balances`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch balances');
  return res.json();
}

export async function addExpense(tripId: string, data: AddExpenseRequest): Promise<string> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, tripId }),
  });
  if (!res.ok) throw new Error('Failed to add expense');
  const { id } = await res.json();
  return id;
}

export async function deleteExpense(tripId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete expense');
}

// F25: download the budget as CSV or PDF. The file is streamed by the API behind the trip's
// authorization; we fetch it (with the dev-user header) and hand the browser a blob to save.
export async function exportBudget(tripId: string, format: 'csv' | 'pdf', fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}/trips/${tripId}/expenses/export?format=${format}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to export budget');

  const blob = await res.blob();
  const fileName = fileNameFromDisposition(res.headers.get('Content-Disposition'))
    ?? `${fallbackName}-budget.${format}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Pulls a filename from a Content-Disposition header when the server provides one.
function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : null;
}
