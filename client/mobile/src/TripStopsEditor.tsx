import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TripStopInput } from '@explivio/shared';
import { PlaceSearch } from './PlaceSearch';
import { formStyles as s } from './formStyles';
import { theme } from './theme';

interface Props {
  stops: TripStopInput[];
  onChange: (stops: TripStopInput[]) => void;
}

const EMPTY_STOP: TripStopInput = {
  place: '',
  arriveDate: null,
  departDate: null,
  latitude: null,
  longitude: null,
};

// F22: edits a trip's ordered route — add/remove/reorder stops, each with a place (optionally picked
// from Google Places so it gets map coordinates) and optional arrive/depart dates. Reused by the
// new-trip and edit-route screens. Mirrors the web TripStopsEditor.
export function TripStopsEditor({ stops, onChange }: Props) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<TripStopInput>) =>
    onChange(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));

  const add = () => onChange([...stops, { ...EMPTY_STOP }]);

  const remove = (index: number) => onChange(stops.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      {stops.map((stop, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <TextInput
              style={[s.input, styles.place]}
              value={stop.place}
              onChangeText={text => update(i, { place: text })}
              placeholder={t('stops.cityPlace')}
              placeholderTextColor={theme.border}
            />
            <TouchableOpacity style={styles.ctrl} onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}>
              <Text style={[styles.ctrlText, i === 0 && styles.ctrlDisabled]}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrl} onPress={() => move(i, 1)} disabled={i === stops.length - 1} hitSlop={6}>
              <Text style={[styles.ctrlText, i === stops.length - 1 && styles.ctrlDisabled]}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrl} onPress={() => remove(i)} disabled={stops.length === 1} hitSlop={6}>
              <Text style={[styles.ctrlText, stops.length === 1 && styles.ctrlDisabled]}>✕</Text>
            </TouchableOpacity>
          </View>

          <PlaceSearch
            onSelect={place =>
              update(i, {
                place: place.name,
                latitude: place.lat || null,
                longitude: place.lng || null,
              })
            }
          />

          <View style={s.row}>
            <View style={s.rowItem}>
              <Text style={s.label}>{t('stops.arrive')}</Text>
              <TextInput
                style={s.input}
                value={stop.arriveDate ?? ''}
                onChangeText={text => update(i, { arriveDate: text || null })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.border}
                autoCapitalize="none"
              />
            </View>
            <View style={s.rowItem}>
              <Text style={s.label}>{t('stops.depart')}</Text>
              <TextInput
                style={s.input}
                value={stop.departDate ?? ''}
                onChangeText={text => update(i, { departDate: text || null })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.border}
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={add}>
        <Text style={styles.addText}>{t('stops.addStop')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: theme.accentBg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  place: { flex: 1 },
  ctrl: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  ctrlText: { fontSize: 15, color: theme.textStrong },
  ctrlDisabled: { color: theme.border },
  addBtn: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addText: { color: theme.accent, fontSize: 14, fontWeight: '600' },
});
