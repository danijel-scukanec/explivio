import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { TripStop, TripStopInput } from '@explivio/shared';
import { getTrip, setTripStops } from '../../../src/api';
import { TripStopsEditor } from '../../../src/TripStopsEditor';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const toInput = (stop: TripStop): TripStopInput => ({
  place: stop.place,
  arriveDate: stop.arriveDate ?? null,
  departDate: stop.departDate ?? null,
  latitude: stop.latitude ?? null,
  longitude: stop.longitude ?? null,
});

// F22: edit a trip's ordered route after creation. Loads the current stops, reuses TripStopsEditor,
// and PUTs the whole list.
export default function EditRouteScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [stops, setStops] = useState<TripStopInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    getTrip(tripId)
      .then(trip => setStops(trip.stops.length > 0 ? trip.stops.map(toInput) : [blankStop()]))
      .catch(() => setError('Could not load the route.'));
  }, [tripId]);

  async function submit() {
    if (!tripId || !stops) return;
    setError(null);
    const cleaned = stops
      .map(stop => ({ ...stop, place: stop.place.trim() }))
      .filter(stop => stop.place.length > 0);
    if (cleaned.length === 0) {
      setError('A trip needs at least one destination.');
      return;
    }

    setSubmitting(true);
    try {
      await setTripStops(tripId, cleaned);
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Edit route' }} />
      {stops === null ? (
        error ? (
          <Text style={[s.error, { textAlign: 'center', marginTop: 40 }]}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
        )
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <TripStopsEditor stops={stops} onChange={setStops} />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
            <Text style={s.submitText}>{submitting ? 'Saving…' : 'Save route'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const blankStop = (): TripStopInput => ({
  place: '',
  arriveDate: null,
  departDate: null,
  latitude: null,
  longitude: null,
});
