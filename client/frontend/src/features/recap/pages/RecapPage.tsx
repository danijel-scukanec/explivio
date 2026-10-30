import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, TripRecap, RecapPhoto } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import { getRecap, recapPhotoUrl } from '../services/recapApi';
import { useTripRecap } from '../hooks/useTripRecap';
import { useAuthedBlobUrl } from '../../../shared/hooks/useAuthedBlobUrl';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './RecapPage.css';

// F29: one gallery image. The source is streamed behind trip authorization, so it's loaded as an
// authenticated blob URL (an <img> can't send the auth header itself).
function GalleryImage({ photo }: { photo: RecapPhoto }) {
  const src = useAuthedBlobUrl(recapPhotoUrl(photo.url));
  if (!src) return <div className="recap-photo recap-photo--loading" />;
  return <img className="recap-photo" src={src} alt="" loading="lazy" />;
}

export function RecapPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [recap, setRecap] = useState<TripRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gen = useTripRecap(tripId ?? '');

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      setError(null);
      try {
        const [tripData, recapData] = await Promise.all([getTrip(tripId), getRecap(tripId)]);
        setTrip(tripData);
        setRecap(recapData);
      } catch {
        setError(t('recap.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, t]);

  async function handleGenerate() {
    await gen.generate();
    // Pick up the persisted copy (and its timestamp) after the stream completes.
    if (tripId) {
      try {
        setRecap(await getRecap(tripId));
      } catch {
        /* keep the streamed text on screen */
      }
    }
  }

  // Show the live stream while generating/just generated, otherwise the stored recap.
  const liveText = gen.status === 'streaming' || gen.status === 'done' ? gen.text : null;
  const text = liveText ?? recap?.content ?? null;
  const photos = recap?.photos ?? [];
  const busy = gen.status === 'streaming';

  return (
    <div className="recap-page">
      <header className="recap-header">
        <div>
          <Link to="/trips">← {t('recap.trips')}</Link>
          <h1>{trip?.name ?? t('recap.title')}</h1>
          {trip && <p className="recap-sub">{trip.destination}</p>}
        </div>
        <div className="recap-actions">
          <LanguageSwitcher />
          {tripId && <Link className="btn btn--ghost" to={`/trips/${tripId}/itinerary`}>{t('recap.itinerary')}</Link>}
          <button className="btn btn--primary" onClick={handleGenerate} disabled={busy}>
            {busy
              ? t('recap.generating')
              : recap?.content
                ? `↻ ${t('recap.regenerate')}`
                : `✨ ${t('recap.generate')}`}
          </button>
        </div>
      </header>

      {loading && <p className="recap-muted">{t('recap.loading')}</p>}
      {error && <p className="recap-error">{error}</p>}
      {gen.error && <p className="recap-error">{gen.error}</p>}

      {!loading && (
        <div className="recap-body">
          {photos.length > 0 && (
            <div className="recap-gallery">
              {photos.map((p) => (
                <GalleryImage key={p.url} photo={p} />
              ))}
            </div>
          )}

          {text ? (
            <article className="recap-narrative">
              {text.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {busy && <span className="recap-caret" aria-hidden />}
            </article>
          ) : (
            !busy && <p className="recap-muted">{t('recap.empty')}</p>
          )}

          {!liveText && recap?.generatedAtUtc && (
            <p className="recap-meta">
              {t('recap.generatedOn', { date: formatTripDate(recap.generatedAtUtc) })}
              {recap.model ? ` · ${recap.model}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
