import { useTranslation } from 'react-i18next';
import type { TripStopInput } from '@explivio/shared';
import { PlaceSearchInput } from '../../../shared/components/PlaceSearchInput';
import type { PlaceResult } from '../../../shared/components/PlaceSearchInput';
import './TripStopsEditor.css';

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
    <div className="stops-editor">
      {stops.map((stop, i) => (
        <div className="stop-row" key={i}>
          <div className="stop-row__head">
            <span className="stop-row__num">{i + 1}</span>
            <input
              className="stop-row__place"
              value={stop.place}
              onChange={e => update(i, { place: e.target.value })}
              placeholder={t('stops.cityPlace')}
              required
            />
            <div className="stop-row__controls">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('stops.moveUp')}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label={t('stops.moveDown')}>↓</button>
              <button type="button" onClick={() => remove(i)} disabled={stops.length === 1} aria-label={t('stops.removeStop')}>✕</button>
            </div>
          </div>

          <PlaceSearchInput
            onPlaceSelect={p => handlePlaceSelect(i, p)}
            placeholder={t('stops.searchAutofill')}
          />

          <div className="stop-row__dates">
            <label>
              {t('stops.arrive')}
              <input
                type="date"
                value={stop.arriveDate ?? ''}
                min={minDate}
                max={maxDate}
                onChange={e => update(i, { arriveDate: e.target.value || null })}
              />
            </label>
            <label>
              {t('stops.depart')}
              <input
                type="date"
                value={stop.departDate ?? ''}
                min={stop.arriveDate ?? minDate}
                max={maxDate}
                onChange={e => update(i, { departDate: e.target.value || null })}
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="stops-editor__add" onClick={add}>{t('stops.addStop')}</button>
    </div>
  );
}
