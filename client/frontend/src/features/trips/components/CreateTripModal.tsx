import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateTripRequest, TripStopInput } from '@explivio/shared';
import { createTrip } from '../services/tripsApi';
import { TripStopsEditor } from './TripStopsEditor';
import './CreateTripModal.css';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

export function CreateTripModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    travelerCount: 1,
  });
  // F22: a trip is an ordered route of stops; start with one empty stop.
  const [stops, setStops] = useState<TripStopInput[]>([
    { place: '', arriveDate: null, departDate: null, latitude: null, longitude: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'travelerCount' ? Number(value) : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanedStops = stops
      .map(s => ({ ...s, place: s.place.trim() }))
      .filter(s => s.place.length > 0);
    if (cleanedStops.length === 0) {
      setError(t('createTrip.needDestination'));
      return;
    }

    setSubmitting(true);
    const data: CreateTripRequest = { ...form, stops: cleanedStops, userId: PLACEHOLDER_USER_ID };

    try {
      await createTrip(data);
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
          <h2>{t('createTrip.title')}</h2>
          <button className="modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            {t('createTrip.name')}
            <input name="name" value={form.name} onChange={handleChange} required placeholder={t('createTrip.namePlaceholder')} />
          </label>

          <div className="modal__row">
            <label>
              {t('createTrip.startDate')}
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
            </label>
            <label>
              {t('createTrip.endDate')}
              <input type="date" name="endDate" value={form.endDate} min={form.startDate} onChange={handleChange} required />
            </label>
          </div>

          <label>
            {t('createTrip.travellers')}
            <input type="number" name="travelerCount" value={form.travelerCount} onChange={handleChange} min={1} max={100} required />
          </label>

          <div className="modal__stops">
            <span className="modal__stops-label">{t('createTrip.destinations')}</span>
            <TripStopsEditor
              stops={stops}
              onChange={setStops}
              minDate={form.startDate || undefined}
              maxDate={form.endDate || undefined}
            />
          </div>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? t('createTrip.creating') : t('createTrip.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
