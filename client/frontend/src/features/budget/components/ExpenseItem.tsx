import { useTranslation } from 'react-i18next';
import type { Expense, TripMember } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { useAuthedBlobUrl } from '../../../shared/hooks/useAuthedBlobUrl';
import { receiptUrl } from '../services/budgetApi';
import { nameFor } from '../memberNames';

interface Props {
  expense: Expense;
  tripId: string;
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

export function ExpenseItem({ expense, tripId, baseCurrency, members, onDelete }: Props) {
  const { t } = useTranslation();
  // F17: load the scanned receipt image (behind trip authorization) when one exists.
  const receipt = useAuthedBlobUrl(expense.hasReceipt ? receiptUrl(tripId, expense.id) : null);
  // F23: expenses created from a booking's cost are managed from that booking, so they can't be
  // deleted here (deleting would strand the reservation's cost).
  const fromBooking = expense.reservationId != null;
  // F25: show the converted amount when the expense is in a different currency from the trip base.
  const converted = expense.amountInBase != null && expense.currency !== baseCurrency
    ? Number(expense.amountInBase)
    : null;
  const shares = expense.shares ?? [];
  const isSplit = shares.length > 0;
  const tag = 'ml-2 align-middle rounded-full px-1.5 py-px text-[11px]';

  return (
    <div className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <span className="shrink-0 text-lg">{CATEGORY_ICONS[expense.category] ?? '📌'}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-card-foreground text-[15px] font-medium">
          {expense.description}
          {fromBooking && <span className={`${tag} bg-primary/10 text-primary`}>{t('expense.fromBooking')}</span>}
          {isSplit && <span className={`${tag} bg-muted text-foreground`}>{t('expense.splitWays', { count: shares.length })}</span>}
        </span>
        <span className="text-muted-foreground text-xs">
          {t(`enums.expenseCategory.${expense.category}`)} · {formatTripDate(expense.date)}
          {expense.paidByUserId && <> · {t('expense.paidBy', { name: nameFor(members, expense.paidByUserId) })}</>}
        </span>
      </div>
      {receipt && (
        <a className="shrink-0 leading-none" href={receipt} target="_blank" rel="noreferrer" title={t('expense.viewReceipt')}>
          <img className="size-[34px] rounded-md border object-cover" src={receipt} alt={t('expense.receipt')} />
        </a>
      )}
      <span className="text-card-foreground flex shrink-0 flex-col items-end text-[15px] font-semibold tabular-nums">
        {formatCurrency(Number(expense.amount), expense.currency)}
        {converted != null && (
          <span className="text-muted-foreground text-xs font-normal">≈ {formatCurrency(converted, baseCurrency)}</span>
        )}
      </span>
      {fromBooking
        ? <span className="shrink-0 px-1.5 py-0.5 text-xs opacity-60" title={t('expense.managedFromBooking')}>🔒</span>
        : <button className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded px-1.5 py-0.5 text-[13px]" onClick={() => onDelete(expense.id)} aria-label={t('expense.delete')}>✕</button>
      }
    </div>
  );
}
