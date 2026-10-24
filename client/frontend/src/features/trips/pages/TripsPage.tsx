import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, TripStatus } from '@explivio/shared';
import { TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrips } from '../services/tripsApi';
import { TripCard } from '../components/TripCard';
import { CreateTripModal } from '../components/CreateTripModal';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './TripsPage.css';

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

  return (
    <div className="trips-page">
      <div className="trips-page__header">
        <h1>{t('trips.title')}</h1>
        <div className="trips-page__header-actions">
          <Link className="btn btn--ghost" to="/gallery">🌍 {t('trips.gallery')}</Link>
          <LanguageSwitcher />
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            {t('trips.newTrip')}
          </button>
        </div>
      </div>

      {loading && <p className="trips-page__status">{t('common.loading')}</p>}
      {error && <p className="trips-page__status trips-page__status--error">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <div className="trips-page__empty">
          <p>{t('trips.empty')}</p>
        </div>
      )}

      {trips.length > 0 && (
        <div className="trips-page__filters">
          {(['All', ...TRIP_STATUSES] as const).map(s => (
            <button
              key={s}
              className={`trips-page__filter${filter === s ? ' trips-page__filter--active' : ''}`}
              style={filter === s && s !== 'All' ? { backgroundColor: tripStatusColor(s), borderColor: tripStatusColor(s), color: '#fff' } : undefined}
              onClick={() => setFilter(s)}
            >
              {s === 'All' ? t('trips.filterAll') : t(`enums.tripStatus.${s}`)}
            </button>
          ))}
        </div>
      )}

      {trips.length > 0 && visibleTrips.length === 0 && (
        <p className="trips-page__status">{t('trips.noneForFilter', { status: filter === 'All' ? t('trips.filterAll') : t(`enums.tripStatus.${filter}`) })}</p>
      )}

      {visibleTrips.length > 0 && (
        <div className="trips-page__grid">
          {visibleTrips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}

      {showModal && (
        <CreateTripModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
