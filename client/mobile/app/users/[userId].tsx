import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { GalleryItem, UserProfile } from '@explivio/shared';
import {
  getUserProfile, getUserTrips, followUser, unfollowUser, likeTrip, unlikeTrip, cloneTrip,
} from '../../src/api';
import { GalleryCard } from '../../src/components/GalleryCard';
import type { Theme } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/useTheme';

export default function UserProfileScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const id = String(userId);
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([getUserProfile(id), getUserTrips(id)])
      .then(([p, trips]) => { setProfile(p); setItems(trips); setError(null); })
      .catch(() => setError(t('profile.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFollow() {
    if (!profile) return;
    const follow = !profile.followedByMe;
    setProfile({ ...profile, followedByMe: follow, followerCount: Math.max(0, Number(profile.followerCount) + (follow ? 1 : -1)) });
    setItems(xs => xs.map(x => ({ ...x, followedByMe: follow })));
    try {
      await (follow ? followUser(id) : unfollowUser(id));
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
      load();
    }
  }

  async function handleClone(item: GalleryItem) {
    setCloning(item.tripId);
    try {
      const res = await cloneTrip(item.tripId);
      if (res?.id) router.push(`/trips/${res.id}/itinerary`);
    } catch {
      setError(t('gallery.couldNotClone'));
    } finally {
      setCloning(null);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: profile?.displayName || t('profile.title') }} />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error || !profile ? (
        <Text style={[styles.center, styles.error]}>{error ?? t('profile.couldNotLoad')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.tripId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(profile.displayName || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{profile.displayName || t('gallery.someone')}</Text>
              <View style={styles.counts}>
                <Text style={styles.count}><Text style={styles.countNum}>{profile.followerCount}</Text> {t('social.followers')}</Text>
                <Text style={styles.count}><Text style={styles.countNum}>{profile.followingCount}</Text> {t('social.followingCount')}</Text>
              </View>
              {!profile.isMe && (
                <TouchableOpacity
                  style={[styles.follow, profile.followedByMe && styles.followOn]}
                  onPress={toggleFollow}
                >
                  <Text style={[styles.followText, profile.followedByMe && styles.followTextOn]}>
                    {profile.followedByMe ? t('social.following') : t('social.follow')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={<Text style={styles.center}>{t('profile.noTrips')}</Text>}
          renderItem={({ item }) => (
            <GalleryCard
              item={item}
              cloning={cloning === item.tripId}
              onToggleLike={toggleLike}
              onToggleFollow={() => toggleFollow()}
              onClone={handleClone}
            />
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
  header: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: theme.textStrong },
  counts: { flexDirection: 'row', gap: 18 },
  count: { fontSize: 14, color: theme.text },
  countNum: { fontWeight: '700', color: theme.textStrong },
  follow: {
    borderWidth: 1, borderColor: theme.accent, backgroundColor: theme.accent,
    borderRadius: 999, paddingHorizontal: 24, paddingVertical: 8, marginTop: 4,
  },
  followOn: { backgroundColor: theme.card, borderColor: theme.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followTextOn: { color: theme.text },
});
