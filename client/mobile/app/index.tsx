import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration, tripStatusColor } from '@explivio/shared';
import { getTrips, deleteTrip } from '../src/api';
import { theme } from '../src/theme';

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getTrips()
      .then(setTrips)
      .catch(() => setError('Could not load trips.'))
      .finally(() => setLoading(false));
  }, []);

  // Refetch every time the screen regains focus, so a trip created on the form screen shows on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(trip: Trip) {
    Alert.alert('Delete trip', `Delete “${trip.name}”? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteTrip(trip.id).then(load).catch(() => {}) },
    ]);
  }

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
                onLongPress={() => confirmDelete(item)}
              >
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.status ? (
                    <View style={[styles.statusBadge, { backgroundColor: tripStatusColor(item.status) }]}>
                      <Text style={styles.statusBadgeText}>{item.status}</Text>
                    </View>
                  ) : null}
                </View>
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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.textStrong },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardDestination: { fontSize: 14, color: theme.accent, marginTop: 2 },
  cardMeta: { fontSize: 13, color: theme.text, marginTop: 8 },
});
