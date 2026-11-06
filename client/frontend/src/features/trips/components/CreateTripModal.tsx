import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateTripRequest, TripStopInput } from '@explivio/shared';
import { createTrip } from '../services/tripsApi';
import { TripStopsEditor } from './TripStopsEditor';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// F25: currencies a trip's budget can be reported in.
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

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
    baseCurrency: 'EUR',
  });
  // F22: a trip is an ordered route of stops; start with one empty stop.
  const [stops, setStops] = useState<TripStopInput[]>([
    { place: '', arriveDate: null, departDate: null, latitude: null, longitude: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
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
    <Modal title={t('createTrip.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <Field label={t('createTrip.name')}>
            <Input name="name" value={form.name} onChange={handleChange} required placeholder={t('createTrip.namePlaceholder')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('createTrip.startDate')}>
              <Input type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
            </Field>
            <Field label={t('createTrip.endDate')}>
              <Input type="date" name="endDate" value={form.endDate} min={form.startDate} onChange={handleChange} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('createTrip.travellers')}>
              <Input type="number" name="travelerCount" value={form.travelerCount} onChange={handleChange} min={1} max={100} required />
            </Field>
            <Field label={t('createTrip.baseCurrency')}>
              <Select name="baseCurrency" value={form.baseCurrency} onChange={handleChange}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-sm font-semibold">{t('createTrip.destinations')}</span>
            <TripStopsEditor
              stops={stops}
              onChange={setStops}
              minDate={form.startDate || undefined}
              maxDate={form.endDate || undefined}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </ModalBody>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('createTrip.creating') : t('createTrip.create')}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
