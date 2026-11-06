import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { GalleryItem } from '@explivio/shared';
import {
  getGallery, getFollowingGallery, likeTrip, unlikeTrip, cloneTrip, followUser, unfollowUser,
} from '../../src/api';
import { GalleryCard } from '../../src/components/GalleryCard';
import type { Theme } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/useTheme';

type Tab = 'all' | 'following';

export default function GalleryScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback((which: Tab) => {
    setLoading(true);
    return (which === 'following' ? getFollowingGallery() : getGallery())
      .then(data => { setItems(data); setError(null); })
      .catch(() => setError(t('gallery.couldNotLoad')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(tab); }, [load, tab]));

  async function toggleLike(item: GalleryItem) {
    const liked = !item.likedByMe;
    setItems(xs => xs.map(x => x.tripId === item.tripId
      ? { ...x, likedByMe: liked, likeCount: Math.max(0, Number(x.likeCount) + (liked ? 1 : -1)) }
      : x));
    try {
      await (liked ? likeTrip(item.tripId) : unlikeTrip(item.tripId));
    } catch {
      load(tab);
    }
  }

  // F26 (follow): follow/unfollow the trip's owner; updates every card by that owner optimistically.
  async function toggleFollow(item: GalleryItem) {
    const follow = !item.followedByMe;
    setItems(xs => xs.map(x => x.ownerUserId === item.ownerUserId ? { ...x, followedByMe: follow } : x));
    try {
      await (follow ? followUser(item.ownerUserId) : unfollowUser(item.ownerUserId));
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
      <View style={styles.tabs}>
        {(['all', 'following'] as Tab[]).map(which => (
          <TouchableOpacity
            key={which}
            style={[styles.tab, tab === which && styles.tabActive]}
            onPress={() => setTab(which)}
          >
            <Text style={[styles.tabText, tab === which && styles.tabTextActive]}>
              {t(`gallery.tabs.${which}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error && items.length === 0 ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.center}>{tab === 'following' ? t('gallery.followingEmpty') : t('gallery.empty')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.tripId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <GalleryCard
              item={item}
              cloning={cloning === item.tripId}
              onToggleLike={toggleLike}
              onToggleFollow={toggleFollow}
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
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  tabActive: { borderColor: theme.accent, backgroundColor: theme.card },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.text },
  tabTextActive: { color: theme.accent },
  list: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
});
