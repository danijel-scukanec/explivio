import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Reservation, ReservationType, ReservationStatus, CreateReservationRequest } from '@explivio/shared';
import { createReservation, updateReservation } from '../services/reservationsApi';
import { RESERVATION_TYPES, RESERVATION_STATUSES } from './reservationMeta';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
    <Modal title={editing ? t('reservationModal.editTitle') : t('reservationModal.addTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('reservationModal.type')}>
              <Select name="type" value={form.type} onChange={handleChange}>
                {RESERVATION_TYPES.map(rt => <option key={rt} value={rt}>{t(`enums.reservationType.${rt}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('reservationModal.status')}>
              <Select name="status" value={form.status} onChange={handleChange}>
                {RESERVATION_STATUSES.map(s => <option key={s} value={s}>{t(`enums.reservationStatus.${s}`)}</option>)}
              </Select>
            </Field>
          </div>

          <Field label={t('reservationModal.title')}>
            <Input name="title" value={form.title} onChange={handleChange} required placeholder={t('reservationModal.titlePlaceholder')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('reservationModal.starts')}>
              <Input type="datetime-local" name="startsAt" value={form.startsAt} onChange={handleChange} required />
            </Field>
            <Field label={t('reservationModal.ends')}>
              <Input type="datetime-local" name="endsAt" value={form.endsAt} min={form.startsAt} onChange={handleChange} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('reservationModal.provider')}>
              <Input name="provider" value={form.provider} onChange={handleChange} placeholder={t('reservationModal.providerPlaceholder')} />
            </Field>
            <Field label={t('reservationModal.confirmation')}>
              <Input name="confirmationNumber" value={form.confirmationNumber} onChange={handleChange} placeholder={t('reservationModal.confirmationPlaceholder')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('reservationModal.cost')}>
              <Input type="number" name="cost" value={form.cost} min="0" step="0.01" onChange={handleChange} placeholder="0.00" />
            </Field>
            <Field label={t('reservationModal.currency')}>
              <Input name="currency" value={form.currency} onChange={handleChange} maxLength={3} placeholder="USD" />
            </Field>
          </div>
          <p className="text-muted-foreground -mt-1 text-xs">{t('reservationModal.costHint')}</p>

          <Field label={t('reservationModal.bookingLink')}>
            <Input name="bookingUrl" value={form.bookingUrl} onChange={handleChange} placeholder="https://…" />
          </Field>

          <Field label={t('reservationModal.notes')}>
            <Input name="notes" value={form.notes} onChange={handleChange} placeholder={t('common.optionalNotes')} />
          </Field>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </ModalBody>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('reservationModal.adding') : editing ? t('reservationModal.save') : t('reservationModal.add')}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
