import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getNotifications } from './api';

// F20: header bell with an unread badge. Polls the unread count and opens the notifications screen.
// Notifications only exist for shared trips, so on a single-user setup the badge stays hidden.
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => getNotifications()
      .then(f => { if (active) setUnread(f.unreadCount); })
      .catch(() => { /* offline — leave the badge as-is */ });
    load();
    const timer = setInterval(load, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={12}>
      <View>
        <Text style={styles.bell}>🔔</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bell: { fontSize: 20 },
  badge: {
    position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
