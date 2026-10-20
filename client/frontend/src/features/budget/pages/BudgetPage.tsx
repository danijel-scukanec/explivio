import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, BudgetSummary, Expense } from '@explivio/shared';
import { formatCurrency } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import { getBudgetSummary, deleteExpense } from '../services/budgetApi';
import { ExpenseItem } from '../components/ExpenseItem';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './BudgetPage.css';

export function BudgetPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, budgetData] = await Promise.all([
        getTrip(tripId),
        getBudgetSummary(tripId),
      ]);
      setTrip(tripData);
      setBudget(budgetData);
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

  if (loading) return <div className="budget-page"><p className="budget-page__status">{t('common.loading')}</p></div>;
  if (error || !trip || !budget) return <div className="budget-page"><p className="budget-page__status budget-page__status--error">{error ?? t('itinerary.notFound')}</p></div>;

  const total = Number(budget.total);
  const categories = [...budget.byCategory]
    .map(c => ({ category: c.category, total: Number(c.total) }))
    .sort((a, b) => b.total - a.total);
  const maxCategory = categories.reduce((m, c) => Math.max(m, c.total), 0);
  // The API populates every expense field; the generated schema just marks them optional.
  const expenses = budget.expenses as Expense[];
  const currency = expenses[0]?.currency ?? 'USD';

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
          <span className="budget-summary__total-label">{t('budget.totalSpend')}</span>
          <span className="budget-summary__total-value">{formatCurrency(total, currency)}</span>
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
                <span className="budget-summary__category-value">{formatCurrency(c.total, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="budget-page__expenses">
        <h2 className="budget-page__expenses-title">{t('budget.expenses')}</h2>
        {expenses.length === 0
          ? <p className="budget-page__empty">{t('budget.empty')}</p>
          : expenses.map(e => <ExpenseItem key={e.id} expense={e} onDelete={handleDelete} />)
        }
      </div>

      {showModal && (
        <AddExpenseModal
          tripId={tripId!}
          defaultDate={trip.startDate}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
