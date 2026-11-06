import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripStop, TripStopInput } from '@explivio/shared';
import { setTripStops } from '../services/tripsApi';
import { TripStopsEditor } from './TripStopsEditor';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

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
  const { t } = useTranslation();
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
      setError(t('editRoute.needDestination'));
      return;
    }

    setSubmitting(true);
    try {
      await setTripStops(tripId, cleaned);
      onSaved();
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t('editRoute.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <TripStopsEditor stops={stops} onChange={setStops} minDate={minDate} maxDate={maxDate} />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </ModalBody>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('editRoute.saving') : t('editRoute.save')}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
