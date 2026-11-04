import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatTripDate, type GalleryItem } from '@explivio/shared';
import './GalleryCard.css';

// A stable gradient per trip, derived from its id — stands in for a cover photo (the cover endpoint is
// member-gated, so public viewers can't load it).
function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h = hash % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}

interface Props {
  item: GalleryItem;
  cloning: boolean;
  onToggleLike: (item: GalleryItem) => void;
  onToggleFollow: (item: GalleryItem) => void;
  onClone: (item: GalleryItem) => void;
}

// F26: one public-trip card, shared by the gallery feeds and a user's profile. Shows who made the trip
// (linking to their profile) with a Follow/Following button, plus like + clone.
export function GalleryCard({ item, cloning, onToggleLike, onToggleFollow, onClone }: Props) {
  const { t } = useTranslation();

  return (
    <article className="gallery-card">
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

        <div className="gallery-card__owner">
          <Link to={`/users/${item.ownerUserId}`} className="gallery-card__by">
            {t('gallery.by', { name: item.ownerDisplayName || t('gallery.someone') })}
          </Link>
          {!item.isMine && (
            <button
              type="button"
              className={`gallery-card__follow${item.followedByMe ? ' gallery-card__follow--on' : ''}`}
              onClick={() => onToggleFollow(item)}
              aria-pressed={item.followedByMe}
            >
              {item.followedByMe ? t('social.following') : t('social.follow')}
            </button>
          )}
        </div>

        <div className="gallery-card__actions">
          <button
            type="button"
            className={`gallery-card__like${item.likedByMe ? ' gallery-card__like--on' : ''}`}
            onClick={() => onToggleLike(item)}
            aria-pressed={item.likedByMe}
          >
            {item.likedByMe ? '❤️' : '🤍'} {item.likeCount}
          </button>
          <button
            type="button"
            className="btn btn--ghost gallery-card__clone"
            onClick={() => onClone(item)}
            disabled={cloning}
          >
            {cloning ? t('gallery.cloning') : t('gallery.clone')}
          </button>
        </div>
      </div>
    </article>
  );
}
