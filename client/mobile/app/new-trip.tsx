import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { CreateTripRequest, TripStopInput } from '@explivio/shared';
import { createTrip } from '../src/api';
import { TripStopsEditor } from '../src/TripStopsEditor';
import { formStyles as s } from '../src/formStyles';
import { theme } from '../src/theme';

// The backend overrides this with the authenticated caller; it's just a placeholder for the body.
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

// F25: currencies a trip's budget can be reported in.
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

export default function NewTripScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', travelerCount: '1', baseCurrency: 'EUR' });
  // F22: a trip is an ordered route of stops; start with one empty stop.
  const [stops, setStops] = useState<TripStopInput[]>([
    { place: '', arriveDate: null, departDate: null, latitude: null, longitude: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit() {
    setError(null);
    const cleanedStops = stops
      .map(stop => ({ ...stop, place: stop.place.trim() }))
      .filter(stop => stop.place.length > 0);

    if (!form.name || !form.startDate || !form.endDate) {
      setError(t('mobile.fillNameDates'));
      return;
    }
    if (cleanedStops.length === 0) {
      setError(t('createTrip.needDestination'));
      return;
    }

    setSubmitting(true);
    const data: CreateTripRequest = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      travelerCount: Number(form.travelerCount) || 1,
      stops: cleanedStops,
      userId: PLACEHOLDER_USER_ID,
      baseCurrency: form.baseCurrency,
    };
    try {
      await createTrip(data);
      router.back();
    } catch {
      setError(t('common.somethingWrong'));
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t('createTrip.title') }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>{t('createTrip.name')}</Text>
          <TextInput style={s.input} value={form.name} onChangeText={set('name')} placeholder={t('createTrip.namePlaceholder')} placeholderTextColor={theme.border} />
        </View>
        <View style={s.row}>
          <View style={s.rowItem}>
            <Text style={s.label}>{t('createTrip.startDate')}</Text>
            <TextInput style={s.input} value={form.startDate} onChangeText={set('startDate')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
          </View>
          <View style={s.rowItem}>
            <Text style={s.label}>{t('createTrip.endDate')}</Text>
            <TextInput style={s.input} value={form.endDate} onChangeText={set('endDate')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
          </View>
        </View>
        <View>
          <Text style={s.label}>{t('createTrip.travellers')}</Text>
          <TextInput style={s.input} value={form.travelerCount} onChangeText={set('travelerCount')} keyboardType="number-pad" />
        </View>

        <View>
          <Text style={s.label}>{t('createTrip.baseCurrency')}</Text>
          <View style={s.chipRow}>
            {CURRENCIES.map(c => {
              const active = form.baseCurrency === c;
              return (
                <TouchableOpacity key={c} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => ({ ...p, baseCurrency: c }))}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={s.label}>{t('createTrip.destinations')}</Text>
          <TripStopsEditor stops={stops} onChange={setStops} />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? t('createTrip.creating') : t('createTrip.create')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
