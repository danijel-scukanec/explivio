import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GalleryItem, UserProfile } from '@explivio/shared';
import {
  getUserProfile, getUserTrips, followUser, unfollowUser, likeTrip, unlikeTrip, cloneTrip,
} from '../services/galleryApi';
import { GalleryCard } from '../components/GalleryCard';
import { Button } from '@/components/ui/button';

export function UserProfilePage() {
  const { userId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getUserProfile(userId), getUserTrips(userId)])
      .then(([p, trips]) => { setProfile(p); setItems(trips); })
      .catch(() => setError(t('profile.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [userId, t]);

  useEffect(() => { load(); }, [load]);

  // Follow/unfollow from the profile header: flips the flag + follower count optimistically.
  async function toggleFollow() {
    if (!profile) return;
    const follow = !profile.followedByMe;
    setProfile({ ...profile, followedByMe: follow, followerCount: Math.max(0, Number(profile.followerCount) + (follow ? 1 : -1)) });
    setItems(xs => xs.map(x => ({ ...x, followedByMe: follow })));
    try {
      await (follow ? followUser(userId) : unfollowUser(userId));
    } catch {
      setProfile(p => p && { ...p, followedByMe: !follow, followerCount: Math.max(0, Number(p.followerCount) + (follow ? -1 : 1)) });
      setItems(xs => xs.map(x => ({ ...x, followedByMe: !follow })));
    }
  }

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

  // The card's own follow button mirrors the header for this one owner.
  function toggleFollowFromCard() { void toggleFollow(); }

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
    <div className="px-5 py-6 text-left sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/gallery" className="text-muted-foreground hover:text-primary text-sm">
          ← {t('profile.backToGallery')}
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : error || !profile ? (
        <p className="text-destructive text-sm">{error ?? t('profile.couldNotLoad')}</p>
      ) : (
        <>
          <header className="mb-7 flex items-center gap-4">
            <div
              className="grid size-16 shrink-0 place-items-center rounded-full text-[28px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), oklch(0.72 0.19 303.9))' }}
              aria-hidden
            >
              {(profile.displayName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-foreground mb-1 text-2xl font-semibold">{profile.displayName || t('gallery.someone')}</h1>
              <div className="text-muted-foreground flex gap-4 text-sm">
                <span><strong className="text-foreground">{profile.followerCount}</strong> {t('social.followers')}</span>
                <span><strong className="text-foreground">{profile.followingCount}</strong> {t('social.followingCount')}</span>
              </div>
            </div>
            {!profile.isMe && (
              <Button
                type="button"
                variant={profile.followedByMe ? 'outline' : 'default'}
                className="shrink-0 rounded-full px-5"
                onClick={toggleFollow}
                aria-pressed={profile.followedByMe}
              >
                {profile.followedByMe ? t('social.following') : t('social.follow')}
              </Button>
            )}
          </header>

          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('profile.noTrips')}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
              {items.map(item => (
                <GalleryCard
                  key={item.tripId}
                  item={item}
                  cloning={cloning === item.tripId}
                  onToggleLike={toggleLike}
                  onToggleFollow={toggleFollowFromCard}
                  onClone={handleClone}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
