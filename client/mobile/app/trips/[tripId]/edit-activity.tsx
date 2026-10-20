import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ActivityCategory, UpdateActivityRequest } from '@explivio/shared';
import { getActivities, updateActivity } from '../../../src/api';
import { PlaceSearch, type PlaceResult } from '../../../src/PlaceSearch';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORIES: ActivityCategory[] = ['Sightseeing', 'Food', 'Transport', 'Accommodation', 'Adventure', 'Other'];

// API times are "HH:mm:ss"; the form edits "HH:mm".
const toInputTime = (t: string | null) => (t ? t.slice(0, 5) : '');

export default function EditActivityScreen() {
  const router = useRouter();
  const { tripId, activityId } = useLocalSearchParams<{ tripId: string; activityId: string }>();
  const [form, setForm] = useState<{
    name: string; date: string; startTime: string; endTime: string;
    location: string; description: string; category: ActivityCategory;
    lat: number | null; lng: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // No single-activity endpoint — fetch the day list and find it.
  useEffect(() => {
    if (!tripId || !activityId) return;
    getActivities(tripId)
      .then(list => {
        const a = list.find(x => x.id === activityId);
        if (!a) { setError('Activity not found.'); return; }
        setForm({
          name: a.name,
          date: a.date,
          startTime: toInputTime(a.startTime),
          endTime: toInputTime(a.endTime),
          location: a.location ?? '',
          description: a.description ?? '',
          category: a.category,
          lat: a.latitude == null ? null : Number(a.latitude),
          lng: a.longitude == null ? null : Number(a.longitude),
        });
      })
      .catch(() => setError('Could not load the activity.'));
  }, [tripId, activityId]);

  const set = (key: keyof NonNullable<typeof form>) => (value: string) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  function handlePlace(place: PlaceResult) {
    setForm(prev => (prev ? {
      ...prev,
      location: place.address,
      name: prev.name || place.name,
      lat: place.lat,
      lng: place.lng,
    } : prev));
  }

  async function submit() {
    if (!form || !tripId || !activityId) return;
    setError(null);
    if (!form.name || !form.date) {
      setError('Please enter a name and date.');
      return;
    }
    setSubmitting(true);
    const data: UpdateActivityRequest = {
      tripId,
      id: activityId,
      name: form.name,
      date: form.date,
      startTime: form.startTime ? `${form.startTime}:00` : null,
      endTime: form.endTime ? `${form.endTime}:00` : null,
      location: form.location || null,
      description: form.description || null,
      category: form.category,
      latitude: form.lat,
      longitude: form.lng,
    };
    try {
      await updateActivity(tripId, activityId, data);
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Edit activity' }} />
      {!form ? (
        error ? <Text style={[s.error, { padding: 16 }]}>{error}</Text>
              : <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={s.label}>Change place</Text>
            <PlaceSearch onSelect={handlePlace} />
            {form.location ? <Text style={s.hint}>📍 {form.location}</Text> : null}
          </View>
          <View>
            <Text style={s.label}>Activity name</Text>
            <TextInput style={s.input} value={form.name} onChangeText={set('name')} placeholderTextColor={theme.border} />
          </View>
          <View>
            <Text style={s.label}>Date</Text>
            <TextInput style={s.input} value={form.date} onChangeText={set('date')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
          </View>
          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>Start time</Text>
              <TextInput style={s.input} value={form.startTime} onChangeText={set('startTime')} placeholder="HH:mm" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>End time</Text>
              <TextInput style={s.input} value={form.endTime} onChangeText={set('endTime')} placeholder="HH:mm" placeholderTextColor={theme.border} autoCapitalize="none" />
            </View>
          </View>
          <View>
            <Text style={s.label}>Location</Text>
            <TextInput style={s.input} value={form.location} onChangeText={set('location')} placeholder="Optional" placeholderTextColor={theme.border} />
          </View>
          <View>
            <Text style={s.label}>Category</Text>
            <View style={s.chipRow}>
              {CATEGORIES.map(c => {
                const active = form.category === c;
                return (
                  <TouchableOpacity key={c} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => (p ? { ...p, category: c } : p))}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={s.label}>Notes</Text>
            <TextInput style={s.input} value={form.description} onChangeText={set('description')} placeholder="Optional" placeholderTextColor={theme.border} />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
            <Text style={s.submitText}>{submitting ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
