import { useState } from 'react';
import type { CreateTripRequest } from '@explivio/shared';
import { createTrip } from '../services/tripsApi';
import './CreateTripModal.css';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

export function CreateTripModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    travelerCount: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'travelerCount' ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const data: CreateTripRequest = { ...form, userId: PLACEHOLDER_USER_ID };

    try {
      await createTrip(data);
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
          <h2>New trip</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            Trip name
            <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Summer in Japan" />
          </label>

          <label>
            Destination
            <input name="destination" value={form.destination} onChange={handleChange} required placeholder="e.g. Tokyo, Japan" />
          </label>

          <div className="modal__row">
            <label>
              Start date
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
            </label>
            <label>
              End date
              <input type="date" name="endDate" value={form.endDate} min={form.startDate} onChange={handleChange} required />
            </label>
          </div>

          <label>
            Travellers
            <input type="number" name="travelerCount" value={form.travelerCount} onChange={handleChange} min={1} max={100} required />
          </label>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
