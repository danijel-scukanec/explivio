import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityCategory, CreateActivityRequest } from '@explivio/shared';
import { createActivity } from '../services/itineraryApi';
import { PlaceSearchInput } from '../../../shared/components/PlaceSearchInput';
import type { PlaceResult } from '../../../shared/components/PlaceSearchInput';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
    <Modal title={t('addActivity.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <Field label={t('addActivity.searchPlace')}>
            <PlaceSearchInput
              onPlaceSelect={handlePlaceSelect}
              placeholder={t('addActivity.searchPlaceholder')}
            />
          </Field>
          {form.location && (
            <p className="bg-primary/10 text-muted-foreground -mt-2 rounded-md px-2.5 py-1.5 text-[13px]">📍 {form.location}</p>
          )}

          <Field label={t('addActivity.name')}>
            <Input name="name" value={form.name} onChange={handleChange} required placeholder={t('addActivity.namePlaceholder')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('addActivity.date')}>
              <Input type="date" name="date" value={form.date} min={minDate} max={maxDate} onChange={handleChange} required />
            </Field>
            <Field label={t('addActivity.category')}>
              <Select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`enums.activityCategory.${c}`)}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('addActivity.startTime')}>
              <Input type="time" name="startTime" value={form.startTime} onChange={handleChange} />
            </Field>
            <Field label={t('addActivity.endTime')}>
              <Input type="time" name="endTime" value={form.endTime} min={form.startTime} onChange={handleChange} />
            </Field>
          </div>

          <Field label={t('addActivity.notes')}>
            <Input name="description" value={form.description} onChange={handleChange} placeholder={t('common.optionalNotes')} />
          </Field>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </ModalBody>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('addActivity.adding') : t('addActivity.add')}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
