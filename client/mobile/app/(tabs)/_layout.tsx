import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, type ColorValue } from 'react-native';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getNotifications } from '../../src/api';
import { useTheme } from '../../src/useTheme';

// The app's primary sections as a bottom tab bar (the native pattern). Trip detail, the new-trip form
// and user profiles push OVER these tabs as full screens (they live in the parent Stack).
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Keep the Alerts badge current while the tabs are on screen.
  useFocusEffect(useCallback(() => {
    let active = true;
    const load = () => getNotifications()
      .then(f => { if (active) setUnread(f.unreadCount); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []));

  const tabIcon = (emoji: string) => ({ color }: { color: ColorValue }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.accent },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.text,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('mobile.tripsTitle'),
          tabBarLabel: t('nav.trips'),
          tabBarIcon: tabIcon('🧳'),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/new-trip')} hitSlop={12} style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('mobile.newShort')}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{ title: t('gallery.title'), tabBarLabel: t('nav.explore'), tabBarIcon: tabIcon('🌍') }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications.title'),
          tabBarLabel: t('nav.notifications'),
          tabBarIcon: tabIcon('🔔'),
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('settings.title'), tabBarLabel: t('nav.profile'), tabBarIcon: tabIcon('👤') }}
      />
    </Tabs>
  );
}
