import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GalleryItem } from '@explivio/shared';
import {
  getGallery, getFollowingGallery, likeTrip, unlikeTrip, cloneTrip, followUser, unfollowUser,
} from '../services/galleryApi';
import { GalleryCard } from '../components/GalleryCard';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './GalleryPage.css';

type Tab = 'all' | 'following';

export function GalleryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback((which: Tab) => {
    setLoading(true);
    setError(null);
    (which === 'following' ? getFollowingGallery() : getGallery())
      .then(setItems)
      .catch(() => setError(t('gallery.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(tab); }, [tab, load]);

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

  // F26 (follow): follow/unfollow the trip's owner. Updates every card by the same owner, optimistically.
  async function toggleFollow(item: GalleryItem) {
    const follow = !item.followedByMe;
    setItems(xs => xs.map(x => x.ownerUserId === item.ownerUserId ? { ...x, followedByMe: follow } : x));
    try {
      await (follow ? followUser(item.ownerUserId) : unfollowUser(item.ownerUserId));
      // On the Following tab, an unfollow should drop that owner's trips from the view.
      if (!follow && tab === 'following') {
        setItems(xs => xs.filter(x => x.ownerUserId !== item.ownerUserId));
      }
    } catch {
      setItems(xs => xs.map(x => x.ownerUserId === item.ownerUserId ? { ...x, followedByMe: !follow } : x));
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

      <div className="gallery-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`gallery-page__tab${tab === 'all' ? ' gallery-page__tab--active' : ''}`}
          onClick={() => setTab('all')}
        >
          {t('gallery.tabs.all')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'following'}
          className={`gallery-page__tab${tab === 'following' ? ' gallery-page__tab--active' : ''}`}
          onClick={() => setTab('following')}
        >
          {t('gallery.tabs.following')}
        </button>
      </div>

      {loading ? (
        <p className="gallery-page__status">{t('common.loading')}</p>
      ) : error ? (
        <p className="gallery-page__status gallery-page__status--error">{error}</p>
      ) : items.length === 0 ? (
        <p className="gallery-page__empty">
          {tab === 'following' ? t('gallery.followingEmpty') : t('gallery.empty')}
        </p>
      ) : (
        <div className="gallery-page__grid">
          {items.map(item => (
            <GalleryCard
              key={item.tripId}
              item={item}
              cloning={cloning === item.tripId}
              onToggleLike={toggleLike}
              onToggleFollow={toggleFollow}
              onClone={handleClone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
