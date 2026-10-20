import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityCategory, CreateActivityRequest } from '@explivio/shared';
import { createActivity } from '../services/itineraryApi';
import { PlaceSearchInput } from '../../../shared/components/PlaceSearchInput';
import type { PlaceResult } from '../../../shared/components/PlaceSearchInput';
import '../../trips/components/CreateTripModal.css';

const CATEGORIES: ActivityCategory[] = [
  'Sightseeing', 'Food', 'Transport', 'Accommodation', 'Adventure', 'Other',
];

interface Props {
  tripId: string;
  initialDate?: string;
  minDate: string;
  maxDate: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddActivityModal({ tripId, initialDate, minDate, maxDate, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    date: initialDate ?? minDate,
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    category: 'Sightseeing' as ActivityCategory,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handlePlaceSelect(place: PlaceResult) {
    setForm(prev => ({
      ...prev,
      location: place.address,
      name: prev.name || place.name,
      lat: place.lat,
      lng: place.lng,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const data: CreateActivityRequest = {
      tripId,
      name: form.name,
      date: form.date,
      startTime: form.startTime ? `${form.startTime}:00` : null,
      endTime: form.endTime ? `${form.endTime}:00` : null,
      location: form.location || null,
      description: form.description || null,
      category: form.category,
      latitude: form.lat,
      longitude: form.lng,
    };

    try {
      await createActivity(tripId, data);
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
          <h2>{t('addActivity.title')}</h2>
          <button className="modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            {t('addActivity.searchPlace')}
            <PlaceSearchInput
              onPlaceSelect={handlePlaceSelect}
              placeholder={t('addActivity.searchPlaceholder')}
            />
          </label>
          {form.location && (
            <p className="modal__place-selected">📍 {form.location}</p>
          )}

          <label>
            {t('addActivity.name')}
            <input name="name" value={form.name} onChange={handleChange} required placeholder={t('addActivity.namePlaceholder')} />
          </label>

          <div className="modal__row">
            <label>
              {t('addActivity.date')}
              <input type="date" name="date" value={form.date} min={minDate} max={maxDate} onChange={handleChange} required />
            </label>
            <label>
              {t('addActivity.category')}
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`enums.activityCategory.${c}`)}</option>)}
              </select>
            </label>
          </div>

          <div className="modal__row">
            <label>
              {t('addActivity.startTime')}
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange} />
            </label>
            <label>
              {t('addActivity.endTime')}
              <input type="time" name="endTime" value={form.endTime} min={form.startTime} onChange={handleChange} />
            </label>
          </div>

          <label>
            {t('addActivity.notes')}
            <input name="description" value={form.description} onChange={handleChange} placeholder={t('common.optionalNotes')} />
          </label>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? t('addActivity.adding') : t('addActivity.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
