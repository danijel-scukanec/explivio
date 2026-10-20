import { getLocale } from './locale';

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(getLocale() ?? 'en-US', { style: 'currency', currency }).format(amount);
}
