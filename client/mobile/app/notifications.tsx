import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification,
} from '../src/api';
import { theme } from '../src/theme';

const KIND_ICON: Record<string, string> = {
  ActivityAdded: '🗺️', ActivityRemoved: '🗺️', ExpenseAdded: '💰', ExpenseRemoved: '💰', StatusChanged: '🔖',
};

// F20: the current user's notifications. Tap one to mark it read and jump to its trip.
export default function NotificationsScreen() {
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
    router.push(`/trips/${n.tripId}/itinerary`);
  }

  async function markAll() {
    await markAllNotificationsRead();
    load();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{
        title: t('notifications.title'),
        headerRight: () => hasUnread
          ? <TouchableOpacity onPress={markAll} hitSlop={12}><Text style={styles.markAll}>{t('notifications.markAllRead')}</Text></TouchableOpacity>
          : undefined,
      }} />

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  center: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: theme.text },
  markAll: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  unread: { backgroundColor: '#f3f1ff' },
  icon: { fontSize: 20 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: theme.textStrong },
  detail: { fontSize: 13, color: theme.text },
});
