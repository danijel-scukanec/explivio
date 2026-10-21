import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExpenseCategory, AddExpenseRequest, ExpenseShareInput, TripMember } from '@explivio/shared';
import { addExpense } from '../services/budgetApi';
import { memberName } from '../memberNames';
import '../../trips/components/CreateTripModal.css';
import './AddExpenseModal.css';

const CATEGORIES: ExpenseCategory[] = [
  'Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other',
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

interface Props {
  tripId: string;
  defaultDate: string;
  defaultCurrency: string;
  members: TripMember[];
  onClose: () => void;
  onCreated: () => void;
}

// Splits `amount` into `n` equal shares (2dp), giving the last share the rounding remainder so the
// shares always sum exactly to the amount.
function equalShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((amount / n) * 100) / 100;
  const shares = Array(n).fill(each);
  shares[n - 1] = Math.round((amount - each * (n - 1)) * 100) / 100;
  return shares;
}

export function AddExpenseModal({ tripId, defaultDate, defaultCurrency, members, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: defaultCurrency,
    category: 'Food' as ExpenseCategory,
    date: defaultDate,
  });
  const [split, setSplit] = useState(false);
  const [paidBy, setPaidBy] = useState(members[0]?.userId ?? '');
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map(m => m.userId)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(form.amount) || 0;
  const selectedIds = useMemo(() => members.filter(m => selected.has(m.userId)).map(m => m.userId), [members, selected]);
  const canSplit = members.length > 1;

  // The share each selected member is assigned, by mode.
  const shares = useMemo<Record<string, number>>(() => {
    if (mode === 'equal') {
      const amounts = equalShares(amount, selectedIds.length);
      return Object.fromEntries(selectedIds.map((id, i) => [id, amounts[i] ?? 0]));
    }
    return Object.fromEntries(selectedIds.map(id => [id, Number(customAmounts[id]) || 0]));
  }, [mode, amount, selectedIds, customAmounts]);

  const sharesTotal = selectedIds.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  const splitBalanced = Math.abs(sharesTotal - amount) <= 0.01;

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function toggleMember(userId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!(amount > 0)) {
      setError(t('addExpense.amountGtZero'));
      return;
    }

    let paidByUserId: string | undefined;
    let splits: ExpenseShareInput[] | undefined;
    if (split) {
      if (selectedIds.length === 0) { setError(t('addExpense.pickSomeone')); return; }
      if (!paidBy) { setError(t('addExpense.pickPayer')); return; }
      if (!splitBalanced) { setError(t('addExpense.sharesMustSum')); return; }
      paidByUserId = paidBy;
      splits = selectedIds.map(id => ({ userId: id, amount: shares[id] }));
    }

    setSubmitting(true);
    const data: AddExpenseRequest = {
      tripId,
      description: form.description,
      amount,
      currency: form.currency,
      category: form.category,
      date: form.date,
      paidByUserId,
      splits,
    };

    try {
      await addExpense(tripId, data);
      onCreated();
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{t('addExpense.title')}</h2>
          <button className="modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            {t('addExpense.description')}
            <input name="description" value={form.description} onChange={handleChange} required maxLength={300} placeholder={t('addExpense.descriptionPlaceholder')} />
          </label>

          <div className="modal__row">
            <label>
              {t('addExpense.amount')}
              <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" step="0.01" placeholder="0.00" />
            </label>
            <label>
              {t('addExpense.currency')}
              <select name="currency" value={form.currency} onChange={handleChange}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="modal__row">
            <label>
              {t('addExpense.category')}
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`enums.expenseCategory.${c}`)}</option>)}
              </select>
            </label>
            <label>
              {t('addExpense.date')}
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </label>
          </div>

          {canSplit && (
            <div className="split">
              <label className="split__toggle">
                <input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} />
                {t('addExpense.splitExpense')}
              </label>

              {split && (
                <div className="split__body">
                  <div className="modal__row">
                    <label>
                      {t('addExpense.paidBy')}
                      <select value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                        {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m)}</option>)}
                      </select>
                    </label>
                    <label>
                      {t('addExpense.splitMode')}
                      <select value={mode} onChange={e => setMode(e.target.value as 'equal' | 'custom')}>
                        <option value="equal">{t('addExpense.splitEqual')}</option>
                        <option value="custom">{t('addExpense.splitCustom')}</option>
                      </select>
                    </label>
                  </div>

                  <div className="split__members">
                    {members.map(m => {
                      const isSelected = selected.has(m.userId);
                      return (
                        <div className={`split__member${isSelected ? ' split__member--on' : ''}`} key={m.userId}>
                          <label className="split__member-pick">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleMember(m.userId)} />
                            {memberName(m)}
                          </label>
                          {isSelected && (
                            mode === 'equal'
                              ? <span className="split__share">{(shares[m.userId] ?? 0).toFixed(2)}</span>
                              : <input
                                  className="split__share-input"
                                  type="number" min="0" step="0.01"
                                  value={customAmounts[m.userId] ?? ''}
                                  onChange={e => setCustomAmounts(prev => ({ ...prev, [m.userId]: e.target.value }))}
                                  placeholder="0.00"
                                />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className={`split__summary${splitBalanced ? '' : ' split__summary--off'}`}>
                    {t('addExpense.splitTotal', {
                      total: sharesTotal.toFixed(2),
                      amount: amount.toFixed(2),
                      currency: form.currency,
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? t('addExpense.adding') : t('addExpense.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
