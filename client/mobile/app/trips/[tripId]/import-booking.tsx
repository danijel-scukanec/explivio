import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import type { Trip, ExtractedBookings, ExtractedBookingItem } from '@explivio/shared';
import { getTrip, parseBooking, createActivity, createReservation } from '../../../src/api';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const KIND_ICON: Record<string, string> = {
  Flight: '✈️', Accommodation: '🏨', CarRental: '🚗', Restaurant: '🍽️', Transport: '🚆', Tour: '🎟️', Other: '📌',
};

export default function ImportBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [result, setResult] = useState<ExtractedBookings | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) getTrip(tripId).then(setTrip).catch(() => {});
  }, [tripId]);

  async function pick() {
    if (!tripId) return;
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const parsed = await parseBooking(tripId, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      setResult(parsed);
      setSelected(new Set(parsed.items.map((_, i) => i)));
    } catch {
      setError(t('import.parseFailed'));
    } finally {
      setParsing(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function startsAt(date?: string | null, time?: string | null): string {
    return `${date ?? trip?.startDate ?? '2026-01-01'}T${time ?? '00:00'}:00`;
  }

  async function addItem(item: ExtractedBookingItem) {
    if (item.kind === 'Reservation') {
      await createReservation(tripId!, {
        tripId: tripId!,
        type: item.reservationType ?? 'Other',
        title: item.title,
        provider: item.provider ?? null,
        confirmationNumber: item.confirmationNumber ?? null,
        startsAt: startsAt(item.date, item.startTime),
        endsAt: item.endDate ? startsAt(item.endDate, item.endTime) : null,
        status: 'Confirmed',
        bookingUrl: item.bookingUrl ?? null,
        notes: item.description ?? null,
        cost: item.cost ?? null,
        currency: item.currency ?? trip?.baseCurrency ?? 'EUR',
      });
    } else {
      await createActivity(tripId!, {
        tripId: tripId!,
        name: item.title,
        description: item.description ?? null,
        location: item.location ?? null,
        date: item.date ?? trip?.startDate ?? '2026-01-01',
        startTime: item.startTime ? `${item.startTime}:00` : null,
        endTime: item.endTime ? `${item.endTime}:00` : null,
        category: item.category ?? 'Other',
        latitude: null,
        longitude: null,
      });
    }
  }

  async function addAll() {
    if (!result) return;
    setAdding(true);
    setError(null);

    // Add each selected item independently so one failure doesn't abort the rest.
    const succeeded = new Set<number>();
    const failed = new Set<number>();
    for (let i = 0; i < result.items.length; i++) {
      if (!selected.has(i)) continue;
      try {
        await addItem(result.items[i]);
        succeeded.add(i);
      } catch {
        failed.add(i);
      }
    }

    if (failed.size === 0) {
      router.back();
      return;
    }

    // Some failed: drop the added items (so a retry can't duplicate them), keep the rest, and
    // pre-select the failed ones so the next "Add" re-tries exactly those.
    const remaining: ExtractedBookingItem[] = [];
    const reselect = new Set<number>();
    for (let i = 0; i < result.items.length; i++) {
      if (succeeded.has(i)) continue;
      if (failed.has(i)) reselect.add(remaining.length);
      remaining.push(result.items[i]);
    }
    setResult({ ...result, items: remaining });
    setSelected(reselect);
    setError(t('import.partialFail', { added: succeeded.size, failed: failed.size }));
    setAdding(false);
  }

  const busy = parsing || adding;

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t('import.title') }} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={{ color: theme.text, fontSize: 14, opacity: 0.8 }}>{t('import.hint')}</Text>

        <TouchableOpacity style={[s.submit, busy && s.submitDisabled]} onPress={pick} disabled={busy}>
          <Text style={s.submitText}>{parsing ? t('import.parsing') : `📧 ${t('import.chooseFile')}`}</Text>
        </TouchableOpacity>

        {parsing ? <ActivityIndicator color={theme.accent} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {result ? (
          <View style={{ gap: 10 }}>
            {result.summary ? <Text style={{ color: theme.text, fontSize: 14 }}>{result.summary}</Text> : null}
            {result.items.map((item, i) => {
              const isRes = item.kind === 'Reservation';
              const icon = isRes ? (KIND_ICON[item.reservationType ?? 'Other'] ?? '📌') : '📍';
              const on = selected.has(i);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggle(i)}
                  style={{
                    flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1,
                    borderColor: on ? theme.accent : theme.border,
                    backgroundColor: on ? theme.accentBg : 'transparent',
                  }}
                >
                  <Text style={{ color: on ? theme.accent : theme.border, fontSize: 18 }}>{on ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: theme.textStrong }}>
                      {icon} {item.title}{'  '}
                      <Text style={{ fontSize: 11, color: theme.accent }}>
                        {isRes ? (item.reservationType ?? t('import.reservation')) : t('import.activity')}
                      </Text>
                    </Text>
                    <Text style={{ color: theme.text, fontSize: 12, marginTop: 2, opacity: 0.75 }}>
                      {item.date}{item.startTime ? ` · ${item.startTime}` : ''}
                      {item.provider ? ` · ${item.provider}` : ''}
                      {item.confirmationNumber ? ` · ${item.confirmationNumber}` : ''}
                      {item.cost != null ? ` · ${item.cost} ${item.currency ?? ''}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[s.submit, (adding || selected.size === 0) && s.submitDisabled]}
              onPress={addAll}
              disabled={adding || selected.size === 0}
            >
              <Text style={s.submitText}>{adding ? t('import.adding') : t('import.add', { count: selected.size })}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
