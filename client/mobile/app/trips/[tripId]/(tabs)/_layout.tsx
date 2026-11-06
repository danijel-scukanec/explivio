import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../src/useTheme';

// The core planning sections of a trip as bottom tabs. The parent Stack (../_layout) owns the action
// screens (add/edit forms, members, share, export, conditions, recap, generate, assistant, import),
// which push over the whole tab UI with a back button — reached from the Itinerary screen's actions.
export default function TripTabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

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
      <Tabs.Screen name="itinerary" options={{ title: t('itinerary.title'), tabBarIcon: tabIcon('🗺️') }} />
      <Tabs.Screen name="bookings" options={{ title: t('bookings.title'), tabBarIcon: tabIcon('🎫') }} />
      <Tabs.Screen name="budget" options={{ title: t('budget.title'), tabBarIcon: tabIcon('💰') }} />
      <Tabs.Screen name="checklists" options={{ title: t('checklists.title'), tabBarIcon: tabIcon('✅') }} />
      <Tabs.Screen name="documents" options={{ title: t('documents.title'), tabBarIcon: tabIcon('📎') }} />
    </Tabs>
  );
}
