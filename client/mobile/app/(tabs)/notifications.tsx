import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification,
} from '../../src/api';
import type { Theme } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/useTheme';

const KIND_ICON: Record<string, string> = {
  ActivityAdded: '🗺️', ActivityRemoved: '🗺️', ExpenseAdded: '💰', ExpenseRemoved: '💰', StatusChanged: '🔖',
  TripPublished: '🌍',
};

// F20: the current user's notifications. Tap one to mark it read and jump to its trip.
export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return getNotifications()
      .then(f => { setItems(f.items); setHasUnread(f.unreadCount > 0); })
      .catch(() => { /* offline — show whatever was cached */ })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function open(n: AppNotification) {
    if (!n.isRead) await markNotificationRead(n.id);
    // F26 (follow): a "published" notification targets a follower (not a trip member) → open the gallery.
    router.push(n.kind === 'TripPublished' ? '/gallery' : `/trips/${n.tripId}/itinerary`);
  }

  async function markAll() {
    await markAllNotificationsRead();
    load();
  }

  return (
    <View style={styles.screen}>
      {hasUnread && !loading && (
        <TouchableOpacity onPress={markAll} hitSlop={8} style={styles.markAllRow}>
          <Text style={styles.markAll}>{t('notifications.markAllRead')}</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t('notifications.empty')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          renderItem={({ item: n }) => (
            <TouchableOpacity style={[styles.item, !n.isRead && styles.unread]} onPress={() => open(n)}>
              <Text style={styles.icon}>{KIND_ICON[n.kind] ?? '🔔'}</Text>
              <View style={styles.text}>
                <Text style={styles.title}>{n.tripName}</Text>
                <Text style={styles.detail}>
                  {t(`notifications.kind.${n.kind}`, { defaultValue: n.kind })}{n.detail ? ` · ${n.detail}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  center: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: theme.text },
  markAllRow: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12 },
  markAll: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  unread: { backgroundColor: '#f3f1ff' },
  icon: { fontSize: 20 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: theme.textStrong },
  detail: { fontSize: 13, color: theme.text },
});
