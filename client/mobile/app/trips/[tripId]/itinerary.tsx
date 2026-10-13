import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Trip, Activity } from '@explivio/shared';
import { formatActivityTime, formatTripDate, getDaysInRange } from '@explivio/shared';
import { getTrip, getActivities, deleteActivity } from '../../../src/api';
import { useTripCollaboration } from '../../../src/useTripCollaboration';
import { theme } from '../../../src/theme';

const CATEGORY_ICONS: Record<string, string> = {
  Sightseeing: '🏛',
  Food: '🍽',
  Transport: '🚌',
  Accommodation: '🏨',
  Adventure: '🧗',
  Other: '📌',
};

interface DaySection {
  title: string;
  dayNumber: number;
  data: Activity[];
}

export default function ItineraryScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getActivities(tripId)])
      .then(([tripData, activityData]) => { setTrip(tripData); setActivities(activityData); setError(null); })
      .catch(() => setError('Could not load itinerary.'))
      .finally(() => setLoading(false));
  }, [tripId]);

  // Refetch on focus so additions/deletions made on the form screen show on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // F15/F31: live collaboration — refetch when another member edits, and show who else is viewing.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteActivity(tripId, id);
    load();
  }

  const sections = useMemo<DaySection[]>(() => {
    if (!trip) return [];
    return getDaysInRange(trip.startDate, trip.endDate).map((date, i) => ({
      title: date,
      dayNumber: i + 1,
      data: activities.filter(a => a.date === date),
    }));
  }, [trip, activities]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: trip?.name ?? 'Itinerary',
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/budget`)} hitSlop={10}>
                <Text style={styles.headerButton}>Budget</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/trips/${tripId}/add-activity?startDate=${trip?.startDate ?? ''}`)}
                hitSlop={10}
              >
                <Text style={styles.headerButton}>+ Add</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {othersViewing > 0 ? (
        <View style={styles.presence}>
          <View style={styles.presenceDot} />
          <Text style={styles.presenceText}>{othersViewing} other{othersViewing > 1 ? 's' : ''} viewing</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error || !trip ? (
        <Text style={[styles.center, styles.error]}>{error ?? 'Trip not found.'}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayNumber}>Day {section.dayNumber}</Text>
              <Text style={styles.dayDate}>{formatTripDate(section.title)}</Text>
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? <Text style={styles.empty}>No activities planned</Text> : null
          }
          renderItem={({ item }) => {
            const start = formatActivityTime(item.startTime);
            const end = formatActivityTime(item.endTime);
            return (
              <View style={styles.activity}>
                <Text style={styles.time}>{start ? `${start}${end ? ` – ${end}` : ''}` : 'No time'}</Text>
                <View style={styles.activityBody}>
                  <Text style={styles.activityName}>
                    {CATEGORY_ICONS[item.category] ?? '📌'} {item.name}
                  </Text>
                  {item.location ? <Text style={styles.activityMeta}>📍 {item.location}</Text> : null}
                  {item.description ? <Text style={styles.activityMeta}>{item.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={10} style={styles.delete}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text },
  error: { color: theme.danger },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.accentBg },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  presenceText: { fontSize: 13, color: theme.accent, fontWeight: '500' },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16, marginBottom: 4 },
  dayNumber: { fontSize: 15, fontWeight: '700', color: theme.textStrong },
  dayDate: { fontSize: 13, color: theme.text },
  empty: { fontSize: 13, color: theme.text, paddingVertical: 8, fontStyle: 'italic' },
  activity: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  time: { width: 92, fontSize: 13, color: theme.text },
  activityBody: { flex: 1 },
  activityName: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  activityMeta: { fontSize: 13, color: theme.text, marginTop: 2 },
  delete: { paddingHorizontal: 4 },
  deleteText: { color: theme.border, fontSize: 15 },
});
