import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Reservation } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { getTrip, getReservations, deleteReservation } from '../../../src/api';
import { TYPE_ICONS, reservationStatusColor, formatReservationTime, reservationDateKey } from '../../../src/reservationMeta';
import { theme } from '../../../src/theme';

interface DaySection { title: string; data: Reservation[] }

export default function BookingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [tripName, setTripName] = useState('Bookings');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getReservations(tripId)])
      .then(([trip, data]) => { setTripName(trip.name); setReservations(data); setError(null); })
      .catch(() => setError(t('bookings.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteReservation(tripId, id);
    load();
  }

  // Reservations arrive sorted by StartsAt; group into consecutive day sections.
  const sections = useMemo<DaySection[]>(() => {
    const out: DaySection[] = [];
    for (const r of reservations) {
      const key = reservationDateKey(r.startsAt);
      const last = out[out.length - 1];
      if (last && last.title === key) last.data.push(r);
      else out.push({ title: key, data: [r] });
    }
    return out;
  }, [reservations]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: tripName,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/add-booking`)} hitSlop={10}>
              <Text style={styles.headerButton}>{t('mobile.addShort')}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : reservations.length === 0 ? (
        <Text style={styles.center}>{t('bookings.empty')}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.dayDate}>{formatTripDate(section.title)}</Text>
          )}
          renderItem={({ item: r }) => (
            <View style={[styles.card, r.status === 'Cancelled' && styles.cardCancelled]}>
              <Text style={styles.icon}>{TYPE_ICONS[r.type]}</Text>
              <View style={styles.body}>
                <View style={styles.headerRow}>
                  <Text style={[styles.title, r.status === 'Cancelled' && styles.titleCancelled]}>{r.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: reservationStatusColor(r.status) }]}>
                    <Text style={styles.statusText}>{t(`enums.reservationStatus.${r.status}`)}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {t(`enums.reservationType.${r.type}`)} · {formatReservationTime(r.startsAt)}
                  {r.provider ? ` · ${r.provider}` : ''}
                  {r.confirmationNumber ? ` · #${r.confirmationNumber}` : ''}
                  {r.cost != null ? ` · ${formatCurrency(Number(r.cost), r.currency)}` : ''}
                </Text>
                {r.notes ? <Text style={styles.meta}>{r.notes}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/add-booking?bookingId=${r.id}`)} hitSlop={8}>
                  <Text style={styles.edit}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(r.id)} hitSlop={8}>
                  <Text style={styles.delete}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
  headerButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dayDate: { fontSize: 14, fontWeight: '700', color: theme.textStrong, marginTop: 16, marginBottom: 8 },
  card: {
    flexDirection: 'row', gap: 10, padding: 12, marginBottom: 10, borderRadius: 8,
    borderWidth: 1, borderColor: theme.border, borderLeftWidth: 3, borderLeftColor: theme.accent,
    backgroundColor: theme.accentBg,
  },
  cardCancelled: { opacity: 0.6 },
  icon: { fontSize: 18 },
  body: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  titleCancelled: { textDecorationLine: 'line-through' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: theme.text, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  edit: { color: theme.accent, fontSize: 15 },
  delete: { color: theme.danger, fontSize: 15 },
});
