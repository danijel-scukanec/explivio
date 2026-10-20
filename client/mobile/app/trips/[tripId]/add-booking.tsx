import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReservationType, ReservationStatus, CreateReservationRequest } from '@explivio/shared';
import { getReservations, createReservation, updateReservation } from '../../../src/api';
import { RESERVATION_TYPES, RESERVATION_STATUSES, TYPE_LABELS } from '../../../src/reservationMeta';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

// Compose/parse "YYYY-MM-DD" + "HH:mm" against the API's zone-less ISO date-time.
const toIso = (date: string, time: string) => `${date}T${(time || '00:00')}:00`;
const dOf = (iso: string) => iso.slice(0, 10);
const tOf = (iso: string) => iso.slice(11, 16);

type FormState = {
  type: ReservationType; status: ReservationStatus; title: string;
  startDate: string; startTime: string; endDate: string; endTime: string;
  provider: string; confirmationNumber: string; cost: string; currency: string;
  bookingUrl: string; notes: string;
};

export default function AddBookingScreen() {
  const router = useRouter();
  const { tripId, bookingId, startDate } = useLocalSearchParams<{ tripId: string; bookingId?: string; startDate?: string }>();
  const editing = !!bookingId;
  const [form, setForm] = useState<FormState | null>(
    editing ? null : {
      type: 'Flight', status: 'Reserved', title: '',
      startDate: startDate ?? '', startTime: '09:00', endDate: '', endTime: '',
      provider: '', confirmationNumber: '', cost: '', currency: 'USD', bookingUrl: '', notes: '',
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit mode: no single-booking endpoint, so fetch the list and find it.
  useEffect(() => {
    if (!editing || !tripId || !bookingId) return;
    getReservations(tripId)
      .then(list => {
        const r = list.find(x => x.id === bookingId);
        if (!r) { setError('Booking not found.'); return; }
        setForm({
          type: r.type, status: r.status, title: r.title,
          startDate: dOf(r.startsAt), startTime: tOf(r.startsAt),
          endDate: r.endsAt ? dOf(r.endsAt) : '', endTime: r.endsAt ? tOf(r.endsAt) : '',
          provider: r.provider ?? '', confirmationNumber: r.confirmationNumber ?? '',
          cost: r.cost != null ? String(r.cost) : '', currency: r.currency,
          bookingUrl: r.bookingUrl ?? '', notes: r.notes ?? '',
        });
      })
      .catch(() => setError('Could not load the booking.'));
  }, [editing, tripId, bookingId]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  async function submit() {
    if (!form || !tripId) return;
    setError(null);
    if (!form.title || !form.startDate) {
      setError('Please enter a title and start date.');
      return;
    }
    setSubmitting(true);
    const data: CreateReservationRequest = {
      tripId,
      type: form.type,
      title: form.title,
      provider: form.provider || null,
      confirmationNumber: form.confirmationNumber || null,
      startsAt: toIso(form.startDate, form.startTime),
      endsAt: form.endDate ? toIso(form.endDate, form.endTime) : null,
      status: form.status,
      bookingUrl: form.bookingUrl || null,
      notes: form.notes || null,
      cost: form.cost.trim() === '' ? null : Number(form.cost),
      currency: form.currency || 'USD',
    };
    try {
      if (editing) await updateReservation(tripId, bookingId!, { ...data, id: bookingId! });
      else await createReservation(tripId, data);
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: editing ? 'Edit booking' : 'Add booking' }} />
      {!form ? (
        error ? <Text style={[s.error, { padding: 16 }]}>{error}</Text>
              : <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={s.label}>Type</Text>
            <View style={s.chipRow}>
              {RESERVATION_TYPES.map(t => {
                const active = form.type === t;
                return (
                  <TouchableOpacity key={t} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => (p ? { ...p, type: t } : p))}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={s.label}>Status</Text>
            <View style={s.chipRow}>
              {RESERVATION_STATUSES.map(st => {
                const active = form.status === st;
                return (
                  <TouchableOpacity key={st} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => (p ? { ...p, status: st } : p))}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={s.label}>Title</Text>
            <TextInput style={s.input} value={form.title} onChangeText={set('title')} placeholder="e.g. TAP TP1234 LIS→OPO" placeholderTextColor={theme.border} />
          </View>
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Start date</Text>
              <TextInput style={s.input} value={form.startDate} onChangeText={set('startDate')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>Start time</Text>
              <TextInput style={s.input} value={form.startTime} onChangeText={set('startTime')} placeholder="HH:mm" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>End date</Text>
              <TextInput style={s.input} value={form.endDate} onChangeText={set('endDate')} placeholder="Optional" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>End time</Text>
              <TextInput style={s.input} value={form.endTime} onChangeText={set('endTime')} placeholder="Optional" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Provider</Text>
              <TextInput style={s.input} value={form.provider} onChangeText={set('provider')} placeholder="e.g. Hilton" placeholderTextColor={theme.border} />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>Confirmation #</Text>
              <TextInput style={s.input} value={form.confirmationNumber} onChangeText={set('confirmationNumber')} placeholder="e.g. ABC123" placeholderTextColor={theme.border} autoCapitalize="characters" />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Cost</Text>
              <TextInput style={s.input} value={form.cost} onChangeText={set('cost')} placeholder="Optional" placeholderTextColor={theme.border} keyboardType="decimal-pad" />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>Currency</Text>
              <TextInput style={s.input} value={form.currency} onChangeText={set('currency')} placeholder="USD" placeholderTextColor={theme.border} autoCapitalize="characters" maxLength={3} />
            </View>
          </View>
          <Text style={s.hint}>Adding a cost records a matching expense in the trip budget.</Text>
          <View>
            <Text style={s.label}>Booking link</Text>
            <TextInput style={s.input} value={form.bookingUrl} onChangeText={set('bookingUrl')} placeholder="https://…" placeholderTextColor={theme.border} autoCapitalize="none" keyboardType="url" />
          </View>
          <View>
            <Text style={s.label}>Notes</Text>
            <TextInput style={s.input} value={form.notes} onChangeText={set('notes')} placeholder="Optional" placeholderTextColor={theme.border} />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
            <Text style={s.submitText}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Add booking'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
