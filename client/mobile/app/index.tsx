import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration } from '@explivio/shared';
import { getTrips } from '../src/api';
import { theme } from '../src/theme';

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetch every time the screen regains focus, so a trip created on the form screen shows on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      getTrips()
        .then(data => { if (active) setTrips(data); })
        .catch(() => { if (active) setError('Could not load trips.'); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Trips',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/new-trip')} hitSlop={12}>
              <Text style={styles.headerButton}>+ New</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.center}>No trips yet. Tap “+ New”.</Text>}
          renderItem={({ item }) => {
            const nights = getTripDuration(item.startDate, item.endDate);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/trips/${item.id}/itinerary`)}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardDestination}>{item.destination}</Text>
                <Text style={styles.cardMeta}>
                  {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
                  {nights > 0 ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16, gap: 12 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text },
  error: { color: theme.danger },
  headerButton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.textStrong },
  cardDestination: { fontSize: 14, color: theme.accent, marginTop: 2 },
  cardMeta: { fontSize: 13, color: theme.text, marginTop: 8 },
});
