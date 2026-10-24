import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TripConditions, StopConditions, DailyConditions } from '@explivio/shared';
import { weatherCodeInfo, formatLocalTime, formatUtcOffset, formatTripDate } from '@explivio/shared';
import { getTripConditions } from '../../../src/api';
import { theme } from '../../../src/theme';

// F28: per-stop destination conditions — local time (resolved time zone), local currency + live rate
// against the trip's base currency, and a horizontal strip of per-day weather.
export default function ConditionsScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [data, setData] = useState<TripConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    return getTripConditions(tripId)
      .then(d => { setData(d); setError(null); })
      .catch(() => setError(t('itinerary.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = <Stack.Screen options={{ title: t('conditions.title') }} />;

  if (loading) return <View style={styles.screen}>{header}<ActivityIndicator style={styles.center} color={theme.accent} /></View>;
  if (error || !data) return <View style={styles.screen}>{header}<Text style={[styles.center, styles.error]}>{error ?? t('itinerary.notFound')}</Text></View>;

  const stops = data.stops.filter(s => s.hasLocation && (s.timeZoneId || s.weatherAvailable));

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {stops.length === 0 ? (
          <Text style={styles.empty}>{t('conditions.weatherUnavailable')}</Text>
        ) : (
          stops.map(stop => <StopCard key={stop.stopId} stop={stop} baseCurrency={data.baseCurrency} />)
        )}
      </ScrollView>
    </View>
  );
}

function StopCard({ stop, baseCurrency }: { stop: StopConditions; baseCurrency: string }) {
  const { t } = useTranslation();
  const offset = stop.utcOffsetSeconds != null ? Number(stop.utcOffsetSeconds) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.place}>{stop.place}</Text>
        {offset != null ? (
          <Text style={styles.time}>
            🕐 {formatLocalTime(offset)}
            <Text style={styles.tz}>  {stop.timeZoneAbbreviation || formatUtcOffset(offset)}</Text>
          </Text>
        ) : null}
      </View>

      {stop.localCurrency ? (
        <Text style={styles.currency}>
          💱 {stop.localCurrency}
          {stop.localPerBaseUnit != null
            ? `  ·  1 ${baseCurrency} ≈ ${Number(stop.localPerBaseUnit).toLocaleString()} ${stop.localCurrency}`
            : stop.localCurrency === baseCurrency ? `  ·  ${t('conditions.sameCurrency')}` : ''}
        </Text>
      ) : null}

      {stop.weatherAvailable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weather}>
          {stop.days.map(day => <WeatherDay key={day.date} day={day} />)}
        </ScrollView>
      ) : (
        <Text style={styles.noWeather}>{t('conditions.weatherUnavailable')}</Text>
      )}
    </View>
  );
}

function WeatherDay({ day }: { day: DailyConditions }) {
  const { t } = useTranslation();
  const info = weatherCodeInfo(Number(day.weatherCode));
  const max = Math.round(Number(day.temperatureMaxC));
  const min = Math.round(Number(day.temperatureMinC));
  const precip = day.precipitationProbability != null ? Number(day.precipitationProbability) : 0;

  return (
    <View style={[styles.day, day.source === 'Seasonal' && styles.daySeasonal]}>
      <Text style={styles.dayDate}>{formatTripDate(day.date)}</Text>
      <Text style={styles.dayIcon}>{info.icon}</Text>
      <Text style={styles.dayTemp}>{max}° / {min}°</Text>
      {precip > 0 ? <Text style={styles.dayPrecip}>💧 {precip}%</Text> : null}
      {day.source === 'Seasonal' ? <Text style={styles.dayTag}>{t('conditions.seasonal')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text },
  error: { color: theme.danger },
  empty: { fontSize: 13, color: theme.text, fontStyle: 'italic', marginTop: 8 },
  card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  place: { fontSize: 16, fontWeight: '700', color: theme.textStrong },
  time: { fontSize: 14, color: theme.text },
  tz: { fontSize: 12, color: theme.text },
  currency: { fontSize: 13, color: theme.text, marginTop: 6 },
  weather: { gap: 8, paddingTop: 12 },
  noWeather: { fontSize: 13, color: theme.text, marginTop: 10 },
  day: { minWidth: 92, alignItems: 'center', gap: 3, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 10, backgroundColor: theme.bg },
  daySeasonal: { borderStyle: 'dashed' },
  dayDate: { fontSize: 11, color: theme.text },
  dayIcon: { fontSize: 24 },
  dayTemp: { fontSize: 14, fontWeight: '700', color: theme.textStrong },
  dayPrecip: { fontSize: 11, color: theme.text },
  dayTag: { fontSize: 9, color: theme.accent, textTransform: 'uppercase', letterSpacing: 0.4 },
});
