import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { GalleryItem } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getGallery, likeTrip, unlikeTrip, cloneTrip } from '../src/api';
import { theme } from '../src/theme';

// A stable accent per trip id — stands in for a cover photo (the cover endpoint is member-gated).
function hueFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 55%)`;
}

export default function GalleryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback(() => {
    return getGallery()
      .then(data => { setItems(data); setError(null); })
      .catch(() => setError(t('gallery.couldNotLoad')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
      <Stack.Screen options={{ title: t('gallery.title') }} />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error && items.length === 0 ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.center}>{t('gallery.empty')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.tripId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.banner, { backgroundColor: hueFor(item.tripId) }]}>
                <Text style={styles.bannerName}>{item.name}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.route}>{item.destination}</Text>
                <Text style={styles.dates}>
                  {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.like, item.likedByMe && styles.likeOn]}
                    onPress={() => toggleLike(item)}
                  >
                    <Text style={styles.likeText}>{item.likedByMe ? '❤️' : '🤍'} {item.likeCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.clone}
                    onPress={() => handleClone(item)}
                    disabled={cloning === item.tripId}
                  >
                    <Text style={styles.cloneText}>
                      {cloning === item.tripId ? t('gallery.cloning') : t('gallery.clone')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
  card: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 14, overflow: 'hidden',
    backgroundColor: theme.card, marginBottom: 14,
  },
  banner: { height: 90, justifyContent: 'flex-end', padding: 12 },
  bannerName: { color: '#fff', fontWeight: '700', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
  body: { padding: 12, gap: 6 },
  route: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  dates: { fontSize: 13, color: theme.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  like: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  likeOn: { borderColor: '#e5567a' },
  likeText: { fontSize: 14, color: theme.textStrong },
  clone: { borderWidth: 1, borderColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  cloneText: { color: theme.accent, fontWeight: '700', fontSize: 13 },
});
