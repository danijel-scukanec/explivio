import type { AiUsageSnapshot } from '@explivio/shared';
import { authHeaders } from '../../../shared/auth';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F21: the accumulated AI usage (tokens, estimated cost, cache hits, per feature + model).
export async function getAiUsage(): Promise<AiUsageSnapshot> {
  const res = await fetch(`${API_URL}/ai/usage`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch AI usage');
  return res.json();
}
