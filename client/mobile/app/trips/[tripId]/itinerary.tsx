import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Trip, Activity, ActivityCategory, Reservation, TripStatus } from '@explivio/shared';
import { formatActivityTime, formatCurrency, formatTripDate, getDaysInRange, TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrip, getActivities, getReservations, deleteActivity, deleteReservation, reorderActivities, setTripStatus } from '../../../src/api';
import { TYPE_ICONS, reservationStatusColor, formatReservationTime, reservationDateKey } from '../../../src/reservationMeta';
import { useTripCollaboration } from '../../../src/useTripCollaboration';
import { ItineraryMap } from '../../../src/ItineraryMap';
import { theme } from '../../../src/theme';

const CATEGORY_ICONS: Record<string, string> = {
  Sightseeing: '🏛', Food: '🍽', Transport: '🚌', Accommodation: '🏨', Adventure: '🧗', Other: '📌',
};
const CATEGORIES: ActivityCategory[] = ['Sightseeing', 'Food', 'Transport', 'Accommodation', 'Adventure', 'Other'];

// A day's rows: its bookings first, then its (optionally filtered) activities.
type Row =
  | { kind: 'reservation'; r: Reservation }
  | { kind: 'activity'; a: Activity };
interface DaySection { title: string; dayNumber: number; data: Row[] }

export default function ItineraryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Set<ActivityCategory>>(new Set());

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getActivities(tripId), getReservations(tripId)])
      .then(([tripData, activityData, reservationData]) => {
        setTrip(tripData); setActivities(activityData); setReservations(reservationData); setError(null);
      })
      .catch(() => setError(t('itinerary.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteActivity(tripId, id);
    load();
  }

  async function handleDeleteReservation(id: string) {
    if (!tripId) return;
    await deleteReservation(tripId, id);
    setReservations(prev => prev.filter(r => r.id !== id));
  }

  // F23: reorder within a day via ↑/↓, then persist; revert to server truth on failure.
  async function handleReorder(date: string, orderedIds: string[]) {
    if (!tripId) return;
    setActivities(prev => {
      const reordered = orderedIds.map(id => prev.find(a => a.id === id)).filter((a): a is Activity => !!a);
      let k = 0;
      return prev.map(a => (a.date === date ? reordered[k++] : a));
    });
    try {
      await reorderActivities(tripId, orderedIds);
    } catch {
      load();
    }
  }

  function move(a: Activity, dir: -1 | 1) {
    const day = activities.filter(x => x.date === a.date);
    const i = day.findIndex(x => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= day.length) return;
    const ids = day.map(x => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    handleReorder(a.date, ids);
  }

  function toggleCategory(c: ActivityCategory) {
    setCategoryFilter(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  async function handleStatusChange(status: TripStatus) {
    if (!tripId || !trip) return;
    setTrip({ ...trip, status });
    try {
      await setTripStatus(tripId, status);
    } catch {
      load();
    }
  }

  const days = useMemo(() => (trip ? getDaysInRange(trip.startDate, trip.endDate) : []), [trip]);
  const filterActive = categoryFilter.size > 0;

  const sections = useMemo<DaySection[]>(() =>
    days.map((date, i) => {
      const dayActivities = activities.filter(a => a.date === date && (!filterActive || categoryFilter.has(a.category)));
      const dayReservations = filterActive ? [] : reservations.filter(r => reservationDateKey(r.startsAt) === date);
      const data: Row[] = [
        ...dayReservations.map(r => ({ kind: 'reservation' as const, r })),
        ...dayActivities.map(a => ({ kind: 'activity' as const, a })),
      ];
      return { title: date, dayNumber: i + 1, data };
    }),
    [days, activities, reservations, filterActive, categoryFilter],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: trip?.name ?? t('itinerary.title'),
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/edit-route`)} hitSlop={10}>
                <Text style={styles.headerButton}>🧭</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/bookings`)} hitSlop={10}>
                <Text style={styles.headerButton}>🎫</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/budget`)} hitSlop={10}>
                <Text style={styles.headerButton}>💰</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/conditions`)} hitSlop={10}>
                <Text style={styles.headerButton}>🌦</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/checklists`)} hitSlop={10}>
                <Text style={styles.headerButton}>✅</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/documents`)} hitSlop={10}>
                <Text style={styles.headerButton}>📎</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/share`)} hitSlop={10}>
                <Text style={styles.headerButton}>🔗</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/export`)} hitSlop={10}>
                <Text style={styles.headerButton}>📅</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/trips/${tripId}/generate?startDate=${trip?.startDate ?? ''}&days=${days.length}`)}
                hitSlop={10}
              >
                <Text style={styles.headerButton}>✨</Text>
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
          <Text style={styles.presenceText}>{t('itinerary.othersViewing', { count: othersViewing })}</Text>
        </View>
      ) : null}

      {trip && trip.stops.length > 0 ? (
        <View style={styles.routeRow}>
          {trip.stops.map((stop, i) => (
            <View key={stop.id} style={styles.routeChip}>
              <View style={styles.routeNum}><Text style={styles.routeNumText}>{i + 1}</Text></View>
              <Text style={styles.routePlace}>{stop.place}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {trip ? (
        <View style={styles.statusRow}>
          {TRIP_STATUSES.map(st => {
            const active = trip.status === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.statusChip, active && { backgroundColor: tripStatusColor(st), borderColor: tripStatusColor(st) }]}
                onPress={() => handleStatusChange(st)}
              >
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{t(`enums.tripStatus.${st}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error || !trip ? (
        <Text style={[styles.center, styles.error]}>{error ?? t('itinerary.notFound')}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => (item.kind === 'activity' ? `a_${item.a.id}` : `r_${item.r.id}`)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View>
              <ItineraryMap activities={activities} days={days} />
              <View style={styles.filterRow}>
                {CATEGORIES.map(c => {
                  const on = categoryFilter.has(c);
                  return (
                    <TouchableOpacity key={c} style={[styles.filterChip, on && styles.filterChipOn]} onPress={() => toggleCategory(c)}>
                      <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{CATEGORY_ICONS[c]} {t(`enums.activityCategory.${c}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
                {filterActive ? (
                  <TouchableOpacity onPress={() => setCategoryFilter(new Set())}><Text style={styles.filterClear}>{t('itinerary.clear')}</Text></TouchableOpacity>
                ) : null}
              </View>
              {filterActive ? <Text style={styles.filterHint}>{t('itinerary.clearToReorder')}</Text> : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayNumber}>{t('itinerary.day', { number: section.dayNumber })}</Text>
              <Text style={styles.dayDate}>{formatTripDate(section.title)}</Text>
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? <Text style={styles.empty}>{t('itinerary.noActivities')}</Text> : null
          }
          renderItem={({ item }) => {
            if (item.kind === 'reservation') {
              const r = item.r;
              return (
                <View style={[styles.booking, r.status === 'Cancelled' && styles.bookingCancelled]}>
                  <Text style={styles.bookingIcon}>{TYPE_ICONS[r.type]}</Text>
                  <View style={styles.activityBody}>
                    <Text style={styles.bookingTitle}>{r.title}</Text>
                    <Text style={styles.activityMeta}>
                      {t(`enums.reservationType.${r.type}`)} · {formatReservationTime(r.startsAt)} · {t(`enums.reservationStatus.${r.status}`)}
                      {r.cost != null ? ` · ${formatCurrency(Number(r.cost), r.currency)}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/add-booking?bookingId=${r.id}`)} hitSlop={8}><Text style={styles.edit}>✎</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteReservation(r.id)} hitSlop={8}><Text style={styles.deleteText}>✕</Text></TouchableOpacity>
                  </View>
                </View>
              );
            }
            const a = item.a;
            const start = formatActivityTime(a.startTime);
            const end = formatActivityTime(a.endTime);
            const day = activities.filter(x => x.date === a.date);
            const idx = day.findIndex(x => x.id === a.id);
            return (
              <View style={styles.activity}>
                {!filterActive ? (
                  <View style={styles.reorder}>
                    <TouchableOpacity onPress={() => move(a, -1)} disabled={idx === 0} hitSlop={6}>
                      <Text style={[styles.reorderBtn, idx === 0 && styles.reorderDisabled]}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(a, 1)} disabled={idx === day.length - 1} hitSlop={6}>
                      <Text style={[styles.reorderBtn, idx === day.length - 1 && styles.reorderDisabled]}>↓</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <Text style={styles.time}>{start ? `${start}${end ? ` – ${end}` : ''}` : t('itinerary.noTime')}</Text>
                <View style={styles.activityBody}>
                  <Text style={styles.activityName}>{CATEGORY_ICONS[a.category] ?? '📌'} {a.name}</Text>
                  {a.location ? <Text style={styles.activityMeta}>📍 {a.location}</Text> : null}
                  {a.description ? <Text style={styles.activityMeta}>{a.description}</Text> : null}
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/edit-activity?activityId=${a.id}`)} hitSlop={8}><Text style={styles.edit}>✎</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(a.id)} hitSlop={8}><Text style={styles.deleteText}>✕</Text></TouchableOpacity>
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
  headerActions: { flexDirection: 'row', gap: 14 },
  headerButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.accentBg },
  routeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  routeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  routeNum: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  routeNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  routePlace: { fontSize: 13, fontWeight: '600', color: theme.textStrong },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  statusChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 12, fontWeight: '600', color: theme.text },
  statusChipTextActive: { color: '#fff' },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  presenceText: { fontSize: 13, color: theme.accent, fontWeight: '500' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 },
  filterChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  filterChipOn: { backgroundColor: theme.accentBg, borderColor: theme.accent },
  filterChipText: { fontSize: 12, color: theme.text },
  filterChipTextOn: { color: theme.accent, fontWeight: '600' },
  filterClear: { color: theme.accent, fontSize: 12, paddingHorizontal: 6, paddingVertical: 4 },
  filterHint: { fontSize: 12, color: theme.text, marginTop: 4, fontStyle: 'italic' },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16, marginBottom: 4 },
  dayNumber: { fontSize: 15, fontWeight: '700', color: theme.textStrong },
  dayDate: { fontSize: 13, color: theme.text },
  empty: { fontSize: 13, color: theme.text, paddingVertical: 8, fontStyle: 'italic' },
  activity: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'flex-start' },
  reorder: { width: 20, alignItems: 'center' },
  reorderBtn: { fontSize: 16, color: theme.accent, lineHeight: 18 },
  reorderDisabled: { color: theme.border },
  time: { width: 84, fontSize: 13, color: theme.text },
  activityBody: { flex: 1 },
  activityName: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  activityMeta: { fontSize: 13, color: theme.text, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 10 },
  edit: { color: theme.accent, fontSize: 15 },
  deleteText: { color: theme.text, fontSize: 15 },
  booking: {
    flexDirection: 'row', gap: 10, padding: 10, marginVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: theme.border, borderLeftWidth: 3, borderLeftColor: theme.accent, backgroundColor: theme.accentBg,
  },
  bookingCancelled: { opacity: 0.6 },
  bookingIcon: { fontSize: 16 },
  bookingTitle: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
});
