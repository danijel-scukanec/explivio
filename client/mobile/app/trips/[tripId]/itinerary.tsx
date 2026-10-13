import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { Trip, Activity } from '@explivio/shared';
import { formatActivityTime, formatTripDate, getDaysInRange } from '@explivio/shared';
import { getTrip, getActivities } from '../../../src/api';
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
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    Promise.all([getTrip(tripId), getActivities(tripId)])
      .then(([tripData, activityData]) => {
        if (!active) return;
        setTrip(tripData);
        setActivities(activityData);
      })
      .catch(() => { if (active) setError('Could not load itinerary.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tripId]);

  // Build one section per trip day, each holding that day's activities (ordered as returned).
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
      <Stack.Screen options={{ title: trip?.name ?? 'Itinerary' }} />

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
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  dayNumber: { fontSize: 15, fontWeight: '700', color: theme.textStrong },
  dayDate: { fontSize: 13, color: theme.text },
  empty: { fontSize: 13, color: theme.text, paddingVertical: 8, fontStyle: 'italic' },
  activity: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  time: { width: 92, fontSize: 13, color: theme.text },
  activityBody: { flex: 1 },
  activityName: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  activityMeta: { fontSize: 13, color: theme.text, marginTop: 2 },
});
