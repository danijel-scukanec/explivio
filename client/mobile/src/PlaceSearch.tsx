import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';

// Native place search over the SAME Google Places (New) API the web client uses — called via REST
// (the web's <gmp-place-autocomplete> is an HTML element that can't run in React Native). Autocomplete
// gives predictions; selecting one fetches its coordinates so activities get lat/lng (for the map).
const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Prediction {
  placeId: string;
  text: string;
}

interface Props {
  onSelect: (place: PlaceResult) => void;
}

export function PlaceSearch({ onSelect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(text: string) {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!KEY || text.trim().length < 3) {
      setPredictions([]);
      return;
    }
    debounce.current = setTimeout(() => void fetchPredictions(text), 300);
  }

  async function fetchPredictions(input: string) {
    setLoading(true);
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY! },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      const list: Prediction[] = (data.suggestions ?? [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({ placeId: s.placePrediction.placeId, text: s.placePrediction.text?.text ?? '' }));
      setPredictions(list);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  async function select(p: Prediction) {
    setQuery(p.text);
    setPredictions([]);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${p.placeId}`, {
        headers: { 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'displayName,formattedAddress,location' },
      });
      const d = await res.json();
      onSelect({
        name: d.displayName?.text ?? p.text,
        address: d.formattedAddress ?? p.text,
        lat: d.location?.latitude ?? 0,
        lng: d.location?.longitude ?? 0,
      });
    } catch {
      // Details failed — fall back to the prediction text with no coordinates.
      onSelect({ name: p.text, address: p.text, lat: 0, lng: 0 });
    }
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onChange}
        placeholder={KEY ? t('addActivity.searchPlaceholder') : t('mobile.placeSearchUnavailable')}
        placeholderTextColor={theme.border}
        editable={!!KEY}
      />
      {loading ? <ActivityIndicator style={styles.loading} color={theme.accent} /> : null}
      {predictions.length > 0 ? (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={p => p.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => select(item)}>
                <Text style={styles.rowText}>{item.text}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textStrong,
    backgroundColor: theme.bg,
  },
  loading: { marginTop: 8 },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.bg,
    maxHeight: 220,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowText: { fontSize: 14, color: theme.textStrong },
});
