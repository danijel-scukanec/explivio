import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration, tripStatusColor } from '@explivio/shared';
import { getTrips, deleteTrip } from '../../src/api';
import type { Theme } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/useTheme';
import { coverColor } from '../../src/coverImage';

export default function TripsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getTrips()
      .then(setTrips)
      .catch(() => setError(t('trips.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [t]);

  // Refetch every time the screen regains focus, so a trip created on the form screen shows on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(trip: Trip) {
    Alert.alert(t('mobile.deleteTripTitle'), t('mobile.deleteTripConfirm', { name: trip.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mobile.delete'), style: 'destructive', onPress: () => void deleteTrip(trip.id).then(load).catch(() => {}) },
    ]);
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={trip => trip.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.center}>{t('mobile.tripsEmpty')}</Text>}
          renderItem={({ item }) => {
            const nights = getTripDuration(item.startDate, item.endDate);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/trips/${item.id}/itinerary`)}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={[styles.cover, { backgroundColor: coverColor(item.id) }]}>
                  {item.status ? (
                    <View style={[styles.statusBadge, { backgroundColor: tripStatusColor(item.status) }]}>
                      <Text style={styles.statusBadgeText}>{t(`enums.tripStatus.${item.status}`)}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardDestination}>{item.destination}</Text>
                  <Text style={styles.cardMeta}>
                    {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
                    {nights > 0 ? ` · ${t('mobile.nights', { count: nights })}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16, gap: 12 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text },
  error: { color: theme.danger },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Every card gets a coloured cover band; the status badge sits on it, top-right.
  cover: { height: 96, padding: 10, alignItems: 'flex-end' },
  cardBody: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.textStrong },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardDestination: { fontSize: 14, color: theme.accent, marginTop: 2 },
  cardMeta: { fontSize: 13, color: theme.text, marginTop: 8 },
});
