import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, BudgetSummary, BudgetBalances, Expense, TripMember } from '@explivio/shared';
import { formatCurrency } from '@explivio/shared';
import { getTrip, getTripMembers, setTripBaseCurrency } from '../../trips/services/tripsApi';
import { getBudgetSummary, getBudgetBalances, deleteExpense, exportBudget } from '../services/budgetApi';
import { ExpenseItem } from '../components/ExpenseItem';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { BalancesPanel } from '../components/BalancesPanel';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './BudgetPage.css';

// F25: the currencies offered as the trip base / per-expense currency.
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

export function BudgetPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [balances, setBalances] = useState<BudgetBalances | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, budgetData, balancesData, membersData] = await Promise.all([
        getTrip(tripId),
        getBudgetSummary(tripId),
        getBudgetBalances(tripId),
        getTripMembers(tripId),
      ]);
      setTrip(tripData);
      setBudget(budgetData);
      setBalances(balancesData);
      setMembers(membersData);
    } catch {
      setError(t('budget.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  // F15: live collaboration — refetch when another member changes expenses, and show who's viewing.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteExpense(tripId, id);
    load();
  }

  function handleCreated() {
    setShowModal(false);
    load();
  }

  async function handleBaseCurrencyChange(currency: string) {
    if (!tripId) return;
    await setTripBaseCurrency(tripId, currency);
    load();
  }

  async function handleExport(format: 'csv' | 'pdf') {
    if (!tripId || !trip) return;
    setExporting(true);
    try {
      await exportBudget(tripId, format, trip.name);
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="budget-page"><p className="budget-page__status">{t('common.loading')}</p></div>;
  if (error || !trip || !budget) return <div className="budget-page"><p className="budget-page__status budget-page__status--error">{error ?? t('itinerary.notFound')}</p></div>;

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
    <div className="budget-page">
      <div className="budget-page__header">
        <div className="budget-page__back">
          <Link to="/trips">← Trips</Link>
          <h1>{trip.name}</h1>
          <span className="budget-page__destination">{trip.destination}</span>
          {othersViewing > 0 && (
            <span className="budget-page__presence" title={presentUserIds.join(', ')}>
              <span className="budget-page__presence-dot" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        <div className="budget-page__actions">
          <Link className="btn btn--ghost" to={`/trips/${tripId}/itinerary`}>🗓 {t('budget.itinerary')}</Link>
          <LanguageSwitcher />
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>{t('budget.addExpense')}</button>
        </div>
      </div>

      <div className="budget-summary">
        <div className="budget-summary__total">
          <div className="budget-summary__total-head">
            <span className="budget-summary__total-label">{t('budget.totalSpend')}</span>
            <label className="budget-summary__base">
              {t('budget.baseCurrency')}
              <select value={base} onChange={e => handleBaseCurrencyChange(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <span className="budget-summary__total-value">{formatCurrency(total, base)}</span>

          {!budget.conversionAvailable && (
            <p className="budget-summary__fx-warning">{t('budget.fxUnavailable')}</p>
          )}

          {mixedCurrency && (
            <div className="budget-summary__currencies">
              {byCurrency.map(c => (
                <span className="budget-summary__currency-chip" key={c.currency}>
                  {formatCurrency(c.total, c.currency)}
                </span>
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="budget-summary__categories">
            {categories.map(c => (
              <div className="budget-summary__category" key={c.category}>
                <span className="budget-summary__category-label">{t(`enums.expenseCategory.${c.category}`)}</span>
                <div className="budget-summary__bar-track">
                  <div
                    className="budget-summary__bar-fill"
                    style={{ width: maxCategory > 0 ? `${(c.total / maxCategory) * 100}%` : '0%' }}
                  />
                </div>
                <span className="budget-summary__category-value">{formatCurrency(c.total, base)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {balances && balances.settlements.length > 0 && (
        <BalancesPanel balances={balances} />
      )}

      <div className="budget-page__expenses">
        <div className="budget-page__expenses-head">
          <h2 className="budget-page__expenses-title">{t('budget.expenses')}</h2>
          {expenses.length > 0 && (
            <div className="budget-page__export">
              <button className="btn btn--ghost btn--sm" disabled={exporting} onClick={() => handleExport('csv')}>
                {t('budget.exportCsv')}
              </button>
              <button className="btn btn--ghost btn--sm" disabled={exporting} onClick={() => handleExport('pdf')}>
                {t('budget.exportPdf')}
              </button>
            </div>
          )}
        </div>
        {expenses.length === 0
          ? <p className="budget-page__empty">{t('budget.empty')}</p>
          : expenses.map(e => (
              <ExpenseItem key={e.id} expense={e} baseCurrency={base} members={members} onDelete={handleDelete} />
            ))
        }
      </div>

      {showModal && (
        <AddExpenseModal
          tripId={tripId!}
          defaultDate={trip.startDate}
          defaultCurrency={base}
          members={members}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
