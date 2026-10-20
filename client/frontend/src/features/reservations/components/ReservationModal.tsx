import { useState } from 'react';
import type { Reservation, ReservationType, ReservationStatus, CreateReservationRequest } from '@explivio/shared';
import { createReservation, updateReservation } from '../services/reservationsApi';
import { RESERVATION_TYPES, RESERVATION_STATUSES, TYPE_LABELS } from './reservationMeta';
import '../../trips/components/CreateTripModal.css';

interface Props {
  tripId: string;
  // When editing, the existing booking; otherwise a create form.
  reservation?: Reservation;
  // Default day (YYYY-MM-DD) for a new booking's start.
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

// API DateTimes serialize without a zone (e.g. "2026-11-10T09:00:00"); <input type="datetime-local">
// wants "YYYY-MM-DDTHH:mm", so slice/append rather than go through Date (which would shift by zone).
const toLocalInput = (iso: string) => iso.slice(0, 16);
const toApiDateTime = (local: string) => (local.length === 16 ? `${local}:00` : local);

export function ReservationModal({ tripId, reservation, defaultDate, onClose, onSaved }: Props) {
  const editing = reservation != null;
  const [form, setForm] = useState({
    type: (reservation?.type ?? 'Flight') as ReservationType,
    title: reservation?.title ?? '',
    status: (reservation?.status ?? 'Reserved') as ReservationStatus,
    startsAt: reservation ? toLocalInput(reservation.startsAt) : `${defaultDate}T09:00`,
    endsAt: reservation?.endsAt ? toLocalInput(reservation.endsAt) : '',
    provider: reservation?.provider ?? '',
    confirmationNumber: reservation?.confirmationNumber ?? '',
    cost: reservation?.cost != null ? String(reservation.cost) : '',
    currency: reservation?.currency ?? 'USD',
    bookingUrl: reservation?.bookingUrl ?? '',
    notes: reservation?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const data: CreateReservationRequest = {
      tripId,
      type: form.type,
      title: form.title,
      provider: form.provider || null,
      confirmationNumber: form.confirmationNumber || null,
      startsAt: toApiDateTime(form.startsAt),
      endsAt: form.endsAt ? toApiDateTime(form.endsAt) : null,
      status: form.status,
      bookingUrl: form.bookingUrl || null,
      notes: form.notes || null,
      cost: form.cost.trim() === '' ? null : Number(form.cost),
      currency: form.currency || 'USD',
    };

    try {
      if (editing) {
        await updateReservation(tripId, reservation!.id, { ...data, id: reservation!.id });
      } else {
        await createReservation(tripId, data);
      }
      onSaved();
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
          <h2>{editing ? 'Edit booking' : 'Add booking'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__row">
            <label>
              Type
              <select name="type" value={form.type} onChange={handleChange}>
                {RESERVATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label>
              Status
              <select name="status" value={form.status} onChange={handleChange}>
                {RESERVATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label>
            Title
            <input name="title" value={form.title} onChange={handleChange} required placeholder="e.g. ANA NH211 HND→SFO" />
          </label>

          <div className="modal__row">
            <label>
              Starts
              <input type="datetime-local" name="startsAt" value={form.startsAt} onChange={handleChange} required />
            </label>
            <label>
              Ends (optional)
              <input type="datetime-local" name="endsAt" value={form.endsAt} min={form.startsAt} onChange={handleChange} />
            </label>
          </div>

          <div className="modal__row">
            <label>
              Provider
              <input name="provider" value={form.provider} onChange={handleChange} placeholder="e.g. Hilton, ANA" />
            </label>
            <label>
              Confirmation #
              <input name="confirmationNumber" value={form.confirmationNumber} onChange={handleChange} placeholder="e.g. ABC123" />
            </label>
          </div>

          <div className="modal__row">
            <label>
              Cost (optional)
              <input type="number" name="cost" value={form.cost} min="0" step="0.01" onChange={handleChange} placeholder="0.00" />
            </label>
            <label>
              Currency
              <input name="currency" value={form.currency} onChange={handleChange} maxLength={3} placeholder="USD" />
            </label>
          </div>
          <p className="modal__hint">Adding a cost records a matching expense in the trip budget.</p>

          <label>
            Booking link
            <input name="bookingUrl" value={form.bookingUrl} onChange={handleChange} placeholder="https://…" />
          </label>

          <label>
            Notes
            <input name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes" />
          </label>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
