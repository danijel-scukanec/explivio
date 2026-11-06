import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GalleryItem } from '@explivio/shared';
import {
  getGallery, getFollowingGallery, likeTrip, unlikeTrip, cloneTrip, followUser, unfollowUser,
} from '../services/galleryApi';
import { GalleryCard } from '../components/GalleryCard';
import { cn } from '@/lib/utils';

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

  const tabs: Tab[] = ['all', 'following'];

  return (
    <div className="px-4 py-8 text-left sm:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t('gallery.title')}</h1>
          <span className="text-primary text-sm">{t('gallery.subtitle')}</span>
        </div>
      </div>

      <div className="mb-5 flex gap-2" role="tablist">
        {tabs.map(tb => (
          <button
            key={tb}
            type="button"
            role="tab"
            aria-selected={tab === tb}
            onClick={() => setTab(tb)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              tab === tb
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-foreground hover:border-primary',
            )}
          >
            {t(`gallery.tabs.${tb}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {tab === 'following' ? t('gallery.followingEmpty') : t('gallery.empty')}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
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
