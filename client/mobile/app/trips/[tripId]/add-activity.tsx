import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ActivityCategory, CreateActivityRequest } from '@explivio/shared';
import { createActivity } from '../../../src/api';
import { PlaceSearch, type PlaceResult } from '../../../src/PlaceSearch';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORIES: ActivityCategory[] = ['Sightseeing', 'Food', 'Transport', 'Accommodation', 'Adventure', 'Other'];

export default function AddActivityScreen() {
  const router = useRouter();
  const { tripId, startDate } = useLocalSearchParams<{ tripId: string; startDate?: string }>();
  const [form, setForm] = useState({
    name: '',
    date: startDate ?? '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    category: 'Sightseeing' as ActivityCategory,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  function handlePlace(place: PlaceResult) {
    setForm(prev => ({
      ...prev,
      location: place.address,
      name: prev.name || place.name,
      lat: place.lat,
      lng: place.lng,
    }));
  }

  async function submit() {
    setError(null);
    if (!form.name || !form.date) {
      setError('Please enter a name and date.');
      return;
    }
    setSubmitting(true);
    const data: CreateActivityRequest = {
      tripId: tripId!,
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
      await createActivity(tripId!, data);
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Add activity' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Search for a place</Text>
          <PlaceSearch onSelect={handlePlace} />
          {form.location ? <Text style={s.hint}>📍 {form.location}</Text> : null}
        </View>
        <View>
          <Text style={s.label}>Activity name</Text>
          <TextInput style={s.input} value={form.name} onChangeText={set('name')} placeholder="e.g. Visit Belém Tower" placeholderTextColor={theme.border} />
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
                <TouchableOpacity key={c} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => ({ ...p, category: c }))}>
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
          <Text style={s.submitText}>{submitting ? 'Adding…' : 'Add activity'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
