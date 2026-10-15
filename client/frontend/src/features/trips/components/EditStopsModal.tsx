import { useState } from 'react';
import type { TripStop, TripStopInput } from '@explivio/shared';
import { setTripStops } from '../services/tripsApi';
import { TripStopsEditor } from './TripStopsEditor';
import './CreateTripModal.css';

interface Props {
  tripId: string;
  initialStops: TripStop[];
  minDate?: string;
  maxDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

function toInput(stop: TripStop): TripStopInput {
  return {
    place: stop.place,
    arriveDate: stop.arriveDate ?? null,
    departDate: stop.departDate ?? null,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
  };
}

// F22: edit a trip's ordered route after creation. Reuses TripStopsEditor and PUTs the whole list.
export function EditStopsModal({ tripId, initialStops, minDate, maxDate, onClose, onSaved }: Props) {
  const [stops, setStops] = useState<TripStopInput[]>(
    initialStops.length > 0
      ? initialStops.map(toInput)
      : [{ place: '', arriveDate: null, departDate: null, latitude: null, longitude: null }],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = stops
      .map(s => ({ ...s, place: s.place.trim() }))
      .filter(s => s.place.length > 0);
    if (cleaned.length === 0) {
      setError('A trip needs at least one destination.');
      return;
    }

    setSubmitting(true);
    try {
      await setTripStops(tripId, cleaned);
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
          <h2>Edit route</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__stops">
            <TripStopsEditor stops={stops} onChange={setStops} minDate={minDate} maxDate={maxDate} />
          </div>

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
