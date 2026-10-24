import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GalleryItem } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getGallery, likeTrip, unlikeTrip, cloneTrip } from '../services/galleryApi';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './GalleryPage.css';

// A stable gradient per trip, derived from its id — stands in for a cover photo (the cover endpoint
// is member-gated, so public viewers can't load it).
function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h = hash % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}

export function GalleryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    getGallery()
      .then(setItems)
      .catch(() => setError(t('gallery.couldNotLoad')))
      .finally(() => setLoading(false));
  }, []);

  async function toggleLike(item: GalleryItem) {
    const liked = !item.likedByMe;
    setItems(xs => xs.map(x => x.tripId === item.tripId
      ? { ...x, likedByMe: liked, likeCount: Math.max(0, Number(x.likeCount) + (liked ? 1 : -1)) }
      : x));
    try {
      await (liked ? likeTrip(item.tripId) : unlikeTrip(item.tripId));
    } catch {
      setItems(xs => xs.map(x => x.tripId === item.tripId
        ? { ...x, likedByMe: !liked, likeCount: Math.max(0, Number(x.likeCount) + (liked ? -1 : 1)) }
        : x));
    }
  }

  async function handleClone(item: GalleryItem) {
    setCloning(item.tripId);
    try {
      const newId = await cloneTrip(item.tripId);
      navigate(`/trips/${newId}/itinerary`);
    } catch {
      setError(t('gallery.couldNotClone'));
      setCloning(null);
    }
  }

  return (
    <div className="gallery-page">
      <div className="gallery-page__header">
        <div className="gallery-page__back">
          <Link to="/trips">← {t('gallery.myTrips')}</Link>
          <h1>{t('gallery.title')}</h1>
          <span className="gallery-page__subtitle">{t('gallery.subtitle')}</span>
        </div>
        <LanguageSwitcher />
      </div>

      {loading ? (
        <p className="gallery-page__status">{t('common.loading')}</p>
      ) : error ? (
        <p className="gallery-page__status gallery-page__status--error">{error}</p>
      ) : items.length === 0 ? (
        <p className="gallery-page__empty">{t('gallery.empty')}</p>
      ) : (
        <div className="gallery-page__grid">
          {items.map(item => (
            <article className="gallery-card" key={item.tripId}>
              <Link
                to={`/gallery/${item.tripId}`}
                className="gallery-card__banner"
                style={{ background: gradientFor(item.tripId) }}
              >
                <span className="gallery-card__banner-name">{item.name}</span>
              </Link>
              <div className="gallery-card__body">
                <span className="gallery-card__route">{item.destination}</span>
                <span className="gallery-card__dates">
                  {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
                </span>
                <div className="gallery-card__actions">
                  <button
                    type="button"
                    className={`gallery-card__like${item.likedByMe ? ' gallery-card__like--on' : ''}`}
                    onClick={() => toggleLike(item)}
                    aria-pressed={item.likedByMe}
                  >
                    {item.likedByMe ? '❤️' : '🤍'} {item.likeCount}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost gallery-card__clone"
                    onClick={() => handleClone(item)}
                    disabled={cloning === item.tripId}
                  >
                    {cloning === item.tripId ? t('gallery.cloning') : t('gallery.clone')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
