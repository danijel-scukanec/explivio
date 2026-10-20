import { useState } from 'react';
import type { Activity, ActivityCategory, UpdateActivityRequest } from '@explivio/shared';
import { updateActivity } from '../services/itineraryApi';
import { PlaceSearchInput } from '../../../shared/components/PlaceSearchInput';
import type { PlaceResult } from '../../../shared/components/PlaceSearchInput';
import '../../trips/components/CreateTripModal.css';

const CATEGORIES: ActivityCategory[] = [
  'Sightseeing', 'Food', 'Transport', 'Accommodation', 'Adventure', 'Other',
];

// The API stores times as "HH:mm:ss"; <input type="time"> wants "HH:mm".
const toInputTime = (t: string | null) => (t ? t.slice(0, 5) : '');

interface Props {
  tripId: string;
  activity: Activity;
  minDate: string;
  maxDate: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditActivityModal({ tripId, activity, minDate, maxDate, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: activity.name,
    date: activity.date,
    startTime: toInputTime(activity.startTime),
    endTime: toInputTime(activity.endTime),
    location: activity.location ?? '',
    description: activity.description ?? '',
    category: activity.category,
    lat: activity.latitude,
    lng: activity.longitude,
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

    const data: UpdateActivityRequest = {
      tripId,
      id: activity.id,
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
      await updateActivity(tripId, activity.id, data);
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
          <h2>Edit activity</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <label>
            Change place
            <PlaceSearchInput
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search restaurants, hotels, attractions…"
            />
          </label>
          {form.location && (
            <p className="modal__place-selected">📍 {form.location}</p>
          )}

          <label>
            Activity name
            <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Visit Senso-ji Temple" />
          </label>

          <div className="modal__row">
            <label>
              Date
              <input type="date" name="date" value={form.date} min={minDate} max={maxDate} onChange={handleChange} required />
            </label>
            <label>
              Category
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="modal__row">
            <label>
              Start time
              <input type="time" name="startTime" value={form.startTime} onChange={handleChange} />
            </label>
            <label>
              End time
              <input type="time" name="endTime" value={form.endTime} min={form.startTime} onChange={handleChange} />
            </label>
          </div>

          <label>
            Notes
            <input name="description" value={form.description} onChange={handleChange} placeholder="Optional notes" />
          </label>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
