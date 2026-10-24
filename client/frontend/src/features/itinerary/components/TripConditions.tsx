import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripConditions as TripConditionsData, StopConditions, DailyConditions } from '@explivio/shared';
import { weatherCodeInfo, formatLocalTime, formatUtcOffset, formatTripDate } from '@explivio/shared';
import { getTripConditions } from '../services/conditionsApi';
import './TripConditions.css';

// F28: a collapsible "Destination conditions" panel on the trip detail page — per stop it shows the
// local time (from the resolved time zone), the local currency with a live rate against the trip's
// base currency, and a strip of per-day weather. Self-contained: it loads its own data lazily so it
// never blocks the itinerary from rendering, and quietly stays hidden if nothing resolved.
export function TripConditions({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<TripConditionsData | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getTripConditions(tripId)
      .then(d => { if (active) setData(d); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [tripId]);

  if (failed || !data) return null;

  // Only stops we could actually resolve something for are worth showing.
  const stops = data.stops.filter(s => s.hasLocation && (s.timeZoneId || s.weatherAvailable));
  if (stops.length === 0) return null;

  return (
    <section className="conditions">
      <button
        type="button"
        className="conditions__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>🌦 {t('conditions.title')}</span>
        <span className="conditions__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="conditions__stops">
          {stops.map(stop => (
            <StopCard key={stop.stopId} stop={stop} baseCurrency={data.baseCurrency} />
          ))}
        </div>
      )}
    </section>
  );
}

function StopCard({ stop, baseCurrency }: { stop: StopConditions; baseCurrency: string }) {
  const { t } = useTranslation();

  return (
    <div className="conditions__card">
      <div className="conditions__card-head">
        <span className="conditions__place">{stop.place}</span>
        {stop.utcOffsetSeconds != null && (
          <span className="conditions__time" title={stop.timeZoneId ?? undefined}>
            🕐 {formatLocalTime(Number(stop.utcOffsetSeconds))}
            <span className="conditions__tz">{stop.timeZoneAbbreviation || formatUtcOffset(Number(stop.utcOffsetSeconds))}</span>
          </span>
        )}
      </div>

      {stop.localCurrency && (
        <div className="conditions__currency">
          💱 {stop.localCurrency}
          {stop.localPerBaseUnit != null
            ? <span className="conditions__rate">· 1 {baseCurrency} ≈ {Number(stop.localPerBaseUnit).toLocaleString()} {stop.localCurrency}</span>
            : stop.localCurrency === baseCurrency
              ? <span className="conditions__rate">· {t('conditions.sameCurrency')}</span>
              : null}
        </div>
      )}

      {stop.weatherAvailable
        ? (
          <div className="conditions__weather">
            {stop.days.map(day => <WeatherDay key={day.date} day={day} />)}
          </div>
        )
        : <p className="conditions__no-weather">{t('conditions.weatherUnavailable')}</p>}
    </div>
  );
}

function WeatherDay({ day }: { day: DailyConditions }) {
  const { t } = useTranslation();
  const info = weatherCodeInfo(Number(day.weatherCode));
  const max = Math.round(Number(day.temperatureMaxC));
  const min = Math.round(Number(day.temperatureMinC));

  return (
    <div className={`conditions__day${day.source === 'Seasonal' ? ' conditions__day--seasonal' : ''}`}>
      <span className="conditions__day-date">{formatTripDate(day.date)}</span>
      <span className="conditions__day-icon" title={t(info.labelKey)}>{info.icon}</span>
      <span className="conditions__day-temp">{max}° / {min}°</span>
      {day.precipitationProbability != null && Number(day.precipitationProbability) > 0 && (
        <span className="conditions__day-precip">💧 {Number(day.precipitationProbability)}%</span>
      )}
      {day.source === 'Seasonal' && (
        <span className="conditions__day-tag">{t('conditions.seasonal')}</span>
      )}
    </div>
  );
}
