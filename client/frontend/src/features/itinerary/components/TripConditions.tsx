import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripConditions as TripConditionsData, StopConditions, DailyConditions } from '@explivio/shared';
import { weatherCodeInfo, formatLocalTime, formatUtcOffset, formatTripDate } from '@explivio/shared';
import { getTripConditions } from '../services/conditionsApi';
import { cn } from '@/lib/utils';

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
    <section className="bg-muted/50 my-4 rounded-[10px] border">
      <button
        type="button"
        className="text-foreground flex w-full items-center justify-between px-4 py-3 font-semibold"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>🌦 {t('conditions.title')}</span>
        <span className="text-muted-foreground" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
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
    <div className="bg-background rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-foreground font-semibold">{stop.place}</span>
        {stop.utcOffsetSeconds != null && (
          <span className="text-muted-foreground inline-flex items-baseline gap-1.5 tabular-nums" title={stop.timeZoneId ?? undefined}>
            🕐 {formatLocalTime(Number(stop.utcOffsetSeconds))}
            <span className="text-[0.8em] opacity-80">{stop.timeZoneAbbreviation || formatUtcOffset(Number(stop.utcOffsetSeconds))}</span>
          </span>
        )}
      </div>

      {stop.localCurrency && (
        <div className="text-muted-foreground mt-1.5 text-sm">
          💱 {stop.localCurrency}
          {stop.localPerBaseUnit != null
            ? <span className="opacity-85"> · 1 {baseCurrency} ≈ {Number(stop.localPerBaseUnit).toLocaleString()} {stop.localCurrency}</span>
            : stop.localCurrency === baseCurrency
              ? <span className="opacity-85"> · {t('conditions.sameCurrency')}</span>
              : null}
        </div>
      )}

      {stop.weatherAvailable
        ? (
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {stop.days.map(day => <WeatherDay key={day.date} day={day} />)}
          </div>
        )
        : <p className="text-muted-foreground mt-2.5 text-sm">{t('conditions.weatherUnavailable')}</p>}
    </div>
  );
}

function WeatherDay({ day }: { day: DailyConditions }) {
  const { t } = useTranslation();
  const info = weatherCodeInfo(Number(day.weatherCode));
  const max = Math.round(Number(day.temperatureMaxC));
  const min = Math.round(Number(day.temperatureMinC));

  return (
    <div className={cn('bg-muted flex min-w-[5.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg border p-2 text-center', day.source === 'Seasonal' && 'border-dashed opacity-90')}>
      <span className="text-muted-foreground text-[0.72rem]">{formatTripDate(day.date)}</span>
      <span className="text-2xl leading-none" title={t(info.labelKey)}>{info.icon}</span>
      <span className="text-foreground text-[0.85rem] font-semibold tabular-nums">{max}° / {min}°</span>
      {day.precipitationProbability != null && Number(day.precipitationProbability) > 0 && (
        <span className="text-muted-foreground text-[0.72rem]">💧 {Number(day.precipitationProbability)}%</span>
      )}
      {day.source === 'Seasonal' && (
        <span className="text-primary text-[0.62rem] tracking-wide uppercase">{t('conditions.seasonal')}</span>
      )}
    </div>
  );
}
