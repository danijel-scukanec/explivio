import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, TripStatus } from '@explivio/shared';
import { TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrips } from '../services/tripsApi';
import { TripCard } from '../components/TripCard';
import { CreateTripModal } from '../components/CreateTripModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function TripsPage() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<TripStatus | 'All'>('All');

  async function loadTrips() {
    setError(null);
    try {
      const data = await getTrips();
      setTrips(data);
    } catch {
      setError(t('trips.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrips(); }, []);

  function handleCreated() {
    setShowModal(false);
    loadTrips();
  }

  const visibleTrips = filter === 'All' ? trips : trips.filter(t => t.status === filter);
  const filters = ['All', ...TRIP_STATUSES] as const;

  return (
    <div className="px-5 py-6 text-left sm:px-8 sm:py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t('trips.title')}</h1>
        <div className="flex items-center gap-2.5">
          <Button asChild variant="ghost" size="sm">
            <Link to="/gallery">🌍 {t('trips.gallery')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/ai-usage">📊 {t('trips.aiUsage')}</Link>
          </Button>
          <Button onClick={() => setShowModal(true)}>{t('trips.newTrip')}</Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">{t('common.loading')}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <div className="text-muted-foreground rounded-xl border border-dashed p-12 text-center">
          <p>{t('trips.empty')}</p>
        </div>
      )}

      {trips.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map(s => {
            const active = filter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                style={active && s !== 'All'
                  ? { backgroundColor: tripStatusColor(s), borderColor: tripStatusColor(s), color: '#fff' }
                  : undefined}
                className={cn(
                  'rounded-full border px-3.5 py-1 text-[13px] font-semibold transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-foreground hover:border-primary',
                )}
              >
                {s === 'All' ? t('trips.filterAll') : t(`enums.tripStatus.${s}`)}
              </button>
            );
          })}
        </div>
      )}

      {trips.length > 0 && visibleTrips.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t('trips.noneForFilter', { status: filter === 'All' ? t('trips.filterAll') : t(`enums.tripStatus.${filter}`) })}
        </p>
      )}

      {visibleTrips.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {visibleTrips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}

      {showModal && (
        <CreateTripModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
