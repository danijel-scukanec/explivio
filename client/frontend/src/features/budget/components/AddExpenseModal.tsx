import { useState } from 'react';
import type { ExpenseCategory, AddExpenseRequest } from '@explivio/shared';
import { addExpense } from '../services/budgetApi';
import '../../trips/components/CreateTripModal.css';

const CATEGORIES: ExpenseCategory[] = [
  'Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

interface Props {
  tripId: string;
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddExpenseModal({ tripId, defaultDate, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'USD',
    category: 'Food' as ExpenseCategory,
    date: defaultDate,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = Number(form.amount);
    if (!(amount > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setSubmitting(true);
    const data: AddExpenseRequest = {
      tripId,
      description: form.description,
      amount,
      currency: form.currency,
      category: form.category,
      date: form.date,
    };

    try {
      await addExpense(tripId, data);
      onCreated();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Add expense</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            Description
            <input name="description" value={form.description} onChange={handleChange} required maxLength={300} placeholder="e.g. Train tickets" />
          </label>

          <div className="modal__row">
            <label>
              Amount
              <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" step="0.01" placeholder="0.00" />
            </label>
            <label>
              Currency
              <select name="currency" value={form.currency} onChange={handleChange}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="modal__row">
            <label>
              Category
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Date
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </label>
          </div>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
