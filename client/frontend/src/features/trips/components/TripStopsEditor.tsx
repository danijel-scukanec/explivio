import { useTranslation } from 'react-i18next';
import type { TripStopInput } from '@explivio/shared';
import { PlaceSearchInput } from '../../../shared/components/PlaceSearchInput';
import type { PlaceResult } from '../../../shared/components/PlaceSearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

interface Props {
  stops: TripStopInput[];
  onChange: (stops: TripStopInput[]) => void;
  // Optional trip span, so stop dates can't fall outside the trip.
  minDate?: string;
  maxDate?: string;
}

const EMPTY_STOP: TripStopInput = {
  place: '',
  arriveDate: null,
  departDate: null,
  latitude: null,
  longitude: null,
};

// F22: edits a trip's ordered route — add/remove/reorder stops, each with a place (optionally picked
// from Google Places so it gets map coordinates) and optional arrive/depart dates. Reused by the
// create-trip modal and the edit-route modal.
export function TripStopsEditor({ stops, onChange, minDate, maxDate }: Props) {
  const { t } = useTranslation();
  function update(index: number, patch: Partial<TripStopInput>) {
    onChange(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function add() {
    onChange([...stops, { ...EMPTY_STOP }]);
  }

  function remove(index: number) {
    onChange(stops.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handlePlaceSelect(index: number, place: PlaceResult) {
    update(index, { place: place.name, latitude: place.lat, longitude: place.lng });
  }

  return (
    <div className="flex flex-col gap-3">
      {stops.map((stop, i) => (
        <div className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-3" key={i}>
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
              {i + 1}
            </span>
            <Input
              className="min-w-0 flex-1"
              value={stop.place}
              onChange={e => update(i, { place: e.target.value })}
              placeholder={t('stops.cityPlace')}
              required
            />
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('stops.moveUp')}>↑</Button>
              <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label={t('stops.moveDown')}>↓</Button>
              <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => remove(i)} disabled={stops.length === 1} aria-label={t('stops.removeStop')}>✕</Button>
            </div>
          </div>

          <PlaceSearchInput
            onPlaceSelect={p => handlePlaceSelect(i, p)}
            placeholder={t('stops.searchAutofill')}
            includedPrimaryTypes={['(cities)']}
          />

          <div className="flex gap-3">
            <Field className="text-muted-foreground flex-1 text-xs font-normal" label={t('stops.arrive')}>
              <Input
                type="date"
                value={stop.arriveDate ?? ''}
                min={minDate}
                max={maxDate}
                onChange={e => update(i, { arriveDate: e.target.value || null })}
              />
            </Field>
            <Field className="text-muted-foreground flex-1 text-xs font-normal" label={t('stops.depart')}>
              <Input
                type="date"
                value={stop.departDate ?? ''}
                min={stop.arriveDate ?? minDate}
                max={maxDate}
                onChange={e => update(i, { departDate: e.target.value || null })}
              />
            </Field>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" className="self-start border-dashed" onClick={add}>
        {t('stops.addStop')}
      </Button>
    </div>
  );
}
