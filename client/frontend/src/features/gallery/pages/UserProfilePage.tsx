import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GalleryItem, UserProfile } from '@explivio/shared';
import {
  getUserProfile, getUserTrips, followUser, unfollowUser, likeTrip, unlikeTrip, cloneTrip,
} from '../services/galleryApi';
import { GalleryCard } from '../components/GalleryCard';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './UserProfilePage.css';

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
    <div className="profile-page">
      <div className="profile-page__topbar">
        <Link to="/gallery">← {t('profile.backToGallery')}</Link>
        <LanguageSwitcher />
      </div>

      {loading ? (
        <p className="profile-page__status">{t('common.loading')}</p>
      ) : error || !profile ? (
        <p className="profile-page__status profile-page__status--error">{error ?? t('profile.couldNotLoad')}</p>
      ) : (
        <>
          <header className="profile-page__header">
            <div className="profile-page__avatar" aria-hidden>
              {(profile.displayName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="profile-page__meta">
              <h1>{profile.displayName || t('gallery.someone')}</h1>
              <div className="profile-page__counts">
                <span><strong>{profile.followerCount}</strong> {t('social.followers')}</span>
                <span><strong>{profile.followingCount}</strong> {t('social.followingCount')}</span>
              </div>
            </div>
            {!profile.isMe && (
              <button
                type="button"
                className={`profile-page__follow${profile.followedByMe ? ' profile-page__follow--on' : ''}`}
                onClick={toggleFollow}
                aria-pressed={profile.followedByMe}
              >
                {profile.followedByMe ? t('social.following') : t('social.follow')}
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <p className="profile-page__empty">{t('profile.noTrips')}</p>
          ) : (
            <div className="profile-page__grid">
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
