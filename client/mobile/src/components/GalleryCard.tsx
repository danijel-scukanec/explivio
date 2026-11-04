import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatTripDate, type GalleryItem } from '@explivio/shared';
import { theme } from '../theme';

// A stable accent per trip id — stands in for a cover photo (the cover endpoint is member-gated).
function hueFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 55%)`;
}

interface Props {
  item: GalleryItem;
  cloning: boolean;
  onToggleLike: (item: GalleryItem) => void;
  onToggleFollow: (item: GalleryItem) => void;
  onClone: (item: GalleryItem) => void;
}

// F26: one public-trip card, shared by the gallery feeds and a user's profile. Shows who made the trip
// (tap → their profile) with a Follow/Following button, plus like + clone.
export function GalleryCard({ item, cloning, onToggleLike, onToggleFollow, onClone }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.card}>
      <View style={[styles.banner, { backgroundColor: hueFor(item.tripId) }]}>
        <Text style={styles.bannerName}>{item.name}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.route}>{item.destination}</Text>
        <Text style={styles.dates}>
          {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
        </Text>

        <View style={styles.owner}>
          <TouchableOpacity style={styles.byWrap} onPress={() => router.push(`/users/${item.ownerUserId}`)}>
            <Text style={styles.by} numberOfLines={1}>
              {t('gallery.by', { name: item.ownerDisplayName || t('gallery.someone') })}
            </Text>
          </TouchableOpacity>
          {!item.isMine && (
            <TouchableOpacity
              style={[styles.follow, item.followedByMe && styles.followOn]}
              onPress={() => onToggleFollow(item)}
            >
              <Text style={[styles.followText, item.followedByMe && styles.followTextOn]}>
                {item.followedByMe ? t('social.following') : t('social.follow')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.like, item.likedByMe && styles.likeOn]}
            onPress={() => onToggleLike(item)}
          >
            <Text style={styles.likeText}>{item.likedByMe ? '❤️' : '🤍'} {item.likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clone} onPress={() => onClone(item)} disabled={cloning}>
            <Text style={styles.cloneText}>{cloning ? t('gallery.cloning') : t('gallery.clone')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 14, overflow: 'hidden',
    backgroundColor: theme.card, marginBottom: 14,
  },
  banner: { height: 90, justifyContent: 'flex-end', padding: 12 },
  bannerName: { color: '#fff', fontWeight: '700', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
  body: { padding: 12, gap: 6 },
  route: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  dates: { fontSize: 13, color: theme.text },
  owner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 8 },
  byWrap: { flexShrink: 1 },
  by: { fontSize: 13, color: theme.accent },
  follow: { borderWidth: 1, borderColor: theme.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  followOn: { borderColor: theme.border },
  followText: { fontSize: 12, fontWeight: '700', color: theme.accent },
  followTextOn: { color: theme.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  like: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  likeOn: { borderColor: '#e5567a' },
  likeText: { fontSize: 14, color: theme.textStrong },
  clone: { borderWidth: 1, borderColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  cloneText: { color: theme.accent, fontWeight: '700', fontSize: 13 },
});
