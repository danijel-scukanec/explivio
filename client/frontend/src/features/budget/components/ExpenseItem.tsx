import type { Expense } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import './ExpenseItem.css';

interface Props {
  expense: Expense;
  onDelete: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Transport: '🚌',
  Accommodation: '🏨',
  Food: '🍽',
  Activities: '🎟',
  Shopping: '🛍',
  Other: '📌',
};

export function ExpenseItem({ expense, onDelete }: Props) {
  return (
    <div className="expense-item">
      <span className="expense-item__icon">{CATEGORY_ICONS[expense.category] ?? '📌'}</span>
      <div className="expense-item__body">
        <span className="expense-item__description">{expense.description}</span>
        <span className="expense-item__meta">{expense.category} · {formatTripDate(expense.date)}</span>
      </div>
      <span className="expense-item__amount">{formatCurrency(Number(expense.amount), expense.currency)}</span>
      <button className="expense-item__delete" onClick={() => onDelete(expense.id)} aria-label="Delete expense">✕</button>
    </div>
  );
}
