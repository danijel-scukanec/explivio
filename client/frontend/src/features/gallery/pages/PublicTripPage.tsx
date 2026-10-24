import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getGalleryTrip, getSharedTrip, cloneTrip } from '../services/galleryApi';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './PublicTripPage.css';

// F26: a read-only view of a trip reached from the gallery (/gallery/:tripId) or a share link
// (/shared/:token). Same component, two sources. Anyone viewing can clone it into their own trips.
export function PublicTripPage({ mode }: { mode: 'gallery' | 'shared' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripId, token } = useParams<{ tripId: string; token: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    const load = mode === 'gallery'
      ? (tripId ? getGalleryTrip(tripId) : Promise.reject())
      : (token ? getSharedTrip(token) : Promise.reject());
    load
      .then(setTrip)
      .catch(() => setError(t('gallery.tripNotFound')))
      .finally(() => setLoading(false));
  }, [mode, tripId, token]);

  async function handleClone() {
    if (!trip) return;
    setCloning(true);
    try {
      const newId = await cloneTrip(trip.id);
      navigate(`/trips/${newId}/itinerary`);
    } catch {
      setError(t('gallery.couldNotClone'));
      setCloning(false);
    }
  }

  if (loading) return <div className="public-trip"><p className="public-trip__status">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="public-trip"><p className="public-trip__status public-trip__status--error">{error ?? t('gallery.tripNotFound')}</p></div>;

  return (
    <div className="public-trip">
      <div className="public-trip__header">
        <div className="public-trip__back">
          <Link to={mode === 'gallery' ? '/gallery' : '/trips'}>
            ← {mode === 'gallery' ? t('gallery.title') : t('gallery.myTrips')}
          </Link>
          <h1>{trip.name}</h1>
          <span className="public-trip__route">{trip.destination}</span>
        </div>
        <div className="public-trip__actions">
          <LanguageSwitcher />
          <button className="btn btn--primary" onClick={handleClone} disabled={cloning}>
            {cloning ? t('gallery.cloning') : `📋 ${t('gallery.cloneToMyTrips')}`}
          </button>
        </div>
      </div>

      <p className="public-trip__meta">
        {formatTripDate(trip.startDate)} – {formatTripDate(trip.endDate)} · {t('gallery.travelers', { count: Number(trip.travelerCount) })}
      </p>

      <ol className="public-trip__stops">
        {trip.stops.map((s, i) => (
          <li key={s.id} className="public-trip__stop">
            <span className="public-trip__stop-num">{i + 1}</span>
            <span className="public-trip__stop-place">{s.place}</span>
            {(s.arriveDate || s.departDate) && (
              <span className="public-trip__stop-dates">
                {s.arriveDate ? formatTripDate(s.arriveDate) : ''}
                {s.departDate ? ` – ${formatTripDate(s.departDate)}` : ''}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
