import { useTranslation } from 'react-i18next';
import type { Expense, TripMember } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { nameFor } from '../memberNames';
import './ExpenseItem.css';

interface Props {
  expense: Expense;
  baseCurrency: string;
  members: TripMember[];
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

export function ExpenseItem({ expense, baseCurrency, members, onDelete }: Props) {
  const { t } = useTranslation();
  // F23: expenses created from a booking's cost are managed from that booking, so they can't be
  // deleted here (deleting would strand the reservation's cost).
  const fromBooking = expense.reservationId != null;
  // F25: show the converted amount when the expense is in a different currency from the trip base.
  const converted = expense.amountInBase != null && expense.currency !== baseCurrency
    ? Number(expense.amountInBase)
    : null;
  const shares = expense.shares ?? [];
  const isSplit = shares.length > 0;

  return (
    <div className="expense-item">
      <span className="expense-item__icon">{CATEGORY_ICONS[expense.category] ?? '📌'}</span>
      <div className="expense-item__body">
        <span className="expense-item__description">
          {expense.description}
          {fromBooking && <span className="expense-item__tag">{t('expense.fromBooking')}</span>}
          {isSplit && <span className="expense-item__tag expense-item__tag--split">{t('expense.splitWays', { count: shares.length })}</span>}
        </span>
        <span className="expense-item__meta">
          {t(`enums.expenseCategory.${expense.category}`)} · {formatTripDate(expense.date)}
          {expense.paidByUserId && <> · {t('expense.paidBy', { name: nameFor(members, expense.paidByUserId) })}</>}
        </span>
      </div>
      <span className="expense-item__amount">
        {formatCurrency(Number(expense.amount), expense.currency)}
        {converted != null && (
          <span className="expense-item__converted">≈ {formatCurrency(converted, baseCurrency)}</span>
        )}
      </span>
      {fromBooking
        ? <span className="expense-item__locked" title={t('expense.managedFromBooking')}>🔒</span>
        : <button className="expense-item__delete" onClick={() => onDelete(expense.id)} aria-label={t('expense.delete')}>✕</button>
      }
    </div>
  );
}
