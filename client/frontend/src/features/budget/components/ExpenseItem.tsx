import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  // F23: expenses created from a booking's cost are managed from that booking, so they can't be
  // deleted here (deleting would strand the reservation's cost).
  const fromBooking = expense.reservationId != null;

  return (
    <div className="expense-item">
      <span className="expense-item__icon">{CATEGORY_ICONS[expense.category] ?? '📌'}</span>
      <div className="expense-item__body">
        <span className="expense-item__description">
          {expense.description}
          {fromBooking && <span className="expense-item__tag">{t('expense.fromBooking')}</span>}
        </span>
        <span className="expense-item__meta">{t(`enums.expenseCategory.${expense.category}`)} · {formatTripDate(expense.date)}</span>
      </div>
      <span className="expense-item__amount">{formatCurrency(Number(expense.amount), expense.currency)}</span>
      {fromBooking
        ? <span className="expense-item__locked" title={t('expense.managedFromBooking')}>🔒</span>
        : <button className="expense-item__delete" onClick={() => onDelete(expense.id)} aria-label={t('expense.delete')}>✕</button>
      }
    </div>
  );
}
