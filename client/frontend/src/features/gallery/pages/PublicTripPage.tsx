import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getGalleryTrip, getSharedTrip, cloneTrip } from '../services/galleryApi';
import { Button } from '@/components/ui/button';

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

  if (loading) return <div className="px-5 py-6 sm:px-8 sm:py-10"><p className="text-muted-foreground text-sm">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="px-5 py-6 sm:px-8 sm:py-10"><p className="text-destructive text-sm">{error ?? t('gallery.tripNotFound')}</p></div>;

  return (
    <div className="max-w-[820px] px-5 py-6 text-left sm:px-8 sm:py-10">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link to={mode === 'gallery' ? '/gallery' : '/trips'} className="text-muted-foreground hover:text-primary text-sm">
            ← {mode === 'gallery' ? t('gallery.title') : t('gallery.myTrips')}
          </Link>
          <h1 className="text-foreground text-2xl font-semibold">{trip.name}</h1>
          <span className="text-primary text-base">{trip.destination}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleClone} disabled={cloning}>
            {cloning ? t('gallery.cloning') : `📋 ${t('gallery.cloneToMyTrips')}`}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground mb-5 text-sm">
        {formatTripDate(trip.startDate)} – {formatTripDate(trip.endDate)} · {t('gallery.travelers', { count: Number(trip.travelerCount) })}
      </p>

      <ol className="flex flex-col gap-2">
        {trip.stops.map((s, i) => (
          <li key={s.id} className="bg-card flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <span className="bg-primary grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white">
              {i + 1}
            </span>
            <span className="text-card-foreground flex-1 text-[15px] font-semibold">{s.place}</span>
            {(s.arriveDate || s.departDate) && (
              <span className="text-muted-foreground text-[13px]">
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
