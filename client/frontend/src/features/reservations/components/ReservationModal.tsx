import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Reservation, ReservationType, ReservationStatus, CreateReservationRequest } from '@explivio/shared';
import { createReservation, updateReservation } from '../services/reservationsApi';
import { RESERVATION_TYPES, RESERVATION_STATUSES } from './reservationMeta';
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
  const { t } = useTranslation();
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
      setError(t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{editing ? t('reservationModal.editTitle') : t('reservationModal.addTitle')}</h2>
          <button className="modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__row">
            <label>
              {t('reservationModal.type')}
              <select name="type" value={form.type} onChange={handleChange}>
                {RESERVATION_TYPES.map(rt => <option key={rt} value={rt}>{t(`enums.reservationType.${rt}`)}</option>)}
              </select>
            </label>
            <label>
              {t('reservationModal.status')}
              <select name="status" value={form.status} onChange={handleChange}>
                {RESERVATION_STATUSES.map(s => <option key={s} value={s}>{t(`enums.reservationStatus.${s}`)}</option>)}
              </select>
            </label>
          </div>

          <label>
            {t('reservationModal.title')}
            <input name="title" value={form.title} onChange={handleChange} required placeholder={t('reservationModal.titlePlaceholder')} />
          </label>

          <div className="modal__row">
            <label>
              {t('reservationModal.starts')}
              <input type="datetime-local" name="startsAt" value={form.startsAt} onChange={handleChange} required />
            </label>
            <label>
              {t('reservationModal.ends')}
              <input type="datetime-local" name="endsAt" value={form.endsAt} min={form.startsAt} onChange={handleChange} />
            </label>
          </div>

          <div className="modal__row">
            <label>
              {t('reservationModal.provider')}
              <input name="provider" value={form.provider} onChange={handleChange} placeholder={t('reservationModal.providerPlaceholder')} />
            </label>
            <label>
              {t('reservationModal.confirmation')}
              <input name="confirmationNumber" value={form.confirmationNumber} onChange={handleChange} placeholder={t('reservationModal.confirmationPlaceholder')} />
            </label>
          </div>

          <div className="modal__row">
            <label>
              {t('reservationModal.cost')}
              <input type="number" name="cost" value={form.cost} min="0" step="0.01" onChange={handleChange} placeholder="0.00" />
            </label>
            <label>
              {t('reservationModal.currency')}
              <input name="currency" value={form.currency} onChange={handleChange} maxLength={3} placeholder="USD" />
            </label>
          </div>
          <p className="modal__hint">{t('reservationModal.costHint')}</p>

          <label>
            {t('reservationModal.bookingLink')}
            <input name="bookingUrl" value={form.bookingUrl} onChange={handleChange} placeholder="https://…" />
          </label>

          <label>
            {t('reservationModal.notes')}
            <input name="notes" value={form.notes} onChange={handleChange} placeholder={t('common.optionalNotes')} />
          </label>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? t('reservationModal.adding') : editing ? t('reservationModal.save') : t('reservationModal.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
