import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BudgetSummary, BudgetBalances, Expense, TripMember } from '@explivio/shared';
import { formatCurrency } from '@explivio/shared';
import { getTripMembers, setTripBaseCurrency } from '../../trips/services/tripsApi';
import { getBudgetSummary, getBudgetBalances, deleteExpense, exportBudget } from '../services/budgetApi';
import { ExpenseItem } from '../components/ExpenseItem';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { BalancesPanel } from '../components/BalancesPanel';
import { useTrip } from '../../trips/pages/TripLayout';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

// F25: the currencies offered as the trip base / per-expense currency.
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

export function BudgetPage() {
  const { t } = useTranslation();
  const { trip, tripId, reloadTrip, changeSignal } = useTrip();
  const confirm = useConfirm();
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [balances, setBalances] = useState<BudgetBalances | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [budgetData, balancesData, membersData] = await Promise.all([
        getBudgetSummary(tripId),
        getBudgetBalances(tripId),
        getTripMembers(tripId),
      ]);
      setBudget(budgetData);
      setBalances(balancesData);
      setMembers(membersData);
    } catch {
      setError(t('budget.couldNotLoad'));
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load, changeSignal]);

  async function handleDelete(id: string) {
    if (!(await confirm())) return;
    await deleteExpense(tripId, id);
    load();
  }

  async function handleBaseCurrencyChange(currency: string) {
    await setTripBaseCurrency(tripId, currency);
    reloadTrip();
    load();
  }

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(true);
    try {
      await exportBudget(tripId, format, trip.name);
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setExporting(false);
    }
  }

  if (error && !budget) return <p className="text-destructive text-sm">{error}</p>;
  if (!budget) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>;

  const base = budget.baseCurrency;
  const total = Number(budget.total);
  const categories = [...budget.byCategory]
    .map(c => ({ category: c.category, total: Number(c.total) }))
    .sort((a, b) => b.total - a.total);
  const maxCategory = categories.reduce((m, c) => Math.max(m, c.total), 0);
  const byCurrency = budget.byCurrency.map(c => ({ currency: c.currency, total: Number(c.total) }));
  const mixedCurrency = byCurrency.length > 1 || (byCurrency[0] && byCurrency[0].currency !== base);
  // The API populates every expense field; the generated schema just marks them optional.
  const expenses = budget.expenses as Expense[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button onClick={() => setShowModal(true)}>{t('budget.addExpense')}</Button>
      </div>

      <div className="bg-muted mb-6 rounded-xl border p-6">
        <div className="mb-5 flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground text-[13px] tracking-wide uppercase">{t('budget.totalSpend')}</span>
            <label className="text-muted-foreground flex flex-col gap-0.5 text-[11px] tracking-wide uppercase">
              {t('budget.baseCurrency')}
              <Select className="h-8 w-auto" value={base} onChange={e => handleBaseCurrencyChange(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </label>
          </div>
          <span className="text-foreground text-[32px] font-bold tabular-nums">{formatCurrency(total, base)}</span>

          {!budget.conversionAvailable && (
            <p className="mt-2 text-xs text-amber-600">{t('budget.fxUnavailable')}</p>
          )}

          {mixedCurrency && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {byCurrency.map(c => (
                <span className="bg-primary/10 text-foreground rounded-full px-2.5 py-0.5 text-xs tabular-nums" key={c.currency}>
                  {formatCurrency(c.total, c.currency)}
                </span>
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {categories.map(c => (
              <div className="grid grid-cols-[120px_1fr_90px] items-center gap-3" key={c.category}>
                <span className="text-muted-foreground text-[13px]">{t(`enums.expenseCategory.${c.category}`)}</span>
                <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-[width] duration-300"
                    style={{ width: maxCategory > 0 ? `${(c.total / maxCategory) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-foreground text-right text-[13px] tabular-nums">{formatCurrency(c.total, base)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {balances && balances.settlements.length > 0 && (
        <BalancesPanel balances={balances} />
      )}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="mb-2 text-base font-semibold">{t('budget.expenses')}</h2>
          {expenses.length > 0 && (
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" disabled={exporting} onClick={() => handleExport('csv')}>
                {t('budget.exportCsv')}
              </Button>
              <Button variant="ghost" size="sm" disabled={exporting} onClick={() => handleExport('pdf')}>
                {t('budget.exportPdf')}
              </Button>
            </div>
          )}
        </div>
        {expenses.length === 0
          ? <p className="text-muted-foreground text-sm">{t('budget.empty')}</p>
          : <div className="flex flex-col gap-2">
              {expenses.map(e => (
                <ExpenseItem key={e.id} expense={e} tripId={tripId} baseCurrency={base} members={members} onDelete={handleDelete} />
              ))}
            </div>
        }
      </div>

      {showModal && (
        <AddExpenseModal
          tripId={tripId}
          defaultDate={trip.startDate}
          defaultCurrency={base}
          members={members}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
