import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Trip, TripRecap } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getTrip, getRecap, recapPhotoUrl, authHeader } from '../../../src/api';
import { useTripRecap } from '../../../src/useTripRecap';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

export default function RecapScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [recap, setRecap] = useState<TripRecap | null>(null);
  const [imgHeaders, setImgHeaders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gen = useTripRecap(tripId!);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      setError(null);
      try {
        const [tripData, recapData, headers] = await Promise.all([getTrip(tripId), getRecap(tripId), authHeader()]);
        setTrip(tripData);
        setRecap(recapData);
        setImgHeaders(headers);
      } catch {
        setError(t('recap.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, t]);

  async function handleGenerate() {
    await gen.generate();
    if (tripId) {
      try {
        setRecap(await getRecap(tripId));
      } catch {
        /* keep the streamed text */
      }
    }
  }

  const liveText = gen.status === 'streaming' || gen.status === 'done' ? gen.text : null;
  const text = liveText ?? recap?.content ?? null;
  const photos = recap?.photos ?? [];
  const busy = gen.status === 'streaming';

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: trip?.name ?? t('recap.title') }} />
      <ScrollView contentContainerStyle={s.content}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {photos.map((p) => (
                <Image
                  key={p.url}
                  source={{ uri: recapPhotoUrl(p.url), headers: imgHeaders }}
                  style={{ width: 160, height: 120, borderRadius: 10, backgroundColor: theme.border }}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        <TouchableOpacity style={[s.submit, busy && s.submitDisabled]} onPress={handleGenerate} disabled={busy}>
          <Text style={s.submitText}>
            {busy ? t('recap.generating') : recap?.content ? t('recap.regenerate') : t('recap.generate')}
          </Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator color={theme.accent} /> : null}
        {busy ? <ActivityIndicator color={theme.accent} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        {gen.error ? <Text style={s.error}>{gen.error}</Text> : null}

        {text ? (
          <View style={{ gap: 12 }}>
            {text.split('\n\n').map((para, i) => (
              <Text key={i} style={{ color: theme.text, fontSize: 15, lineHeight: 23 }}>
                {para}
              </Text>
            ))}
          </View>
        ) : !busy && !loading ? (
          <Text style={{ color: theme.text, opacity: 0.7 }}>{t('recap.empty')}</Text>
        ) : null}

        {!liveText && recap?.generatedAtUtc ? (
          <Text style={{ color: theme.text, opacity: 0.6, fontSize: 12, marginTop: 8 }}>
            {t('recap.generatedOn', { date: formatTripDate(recap.generatedAtUtc) })}
            {recap.model ? ` · ${recap.model}` : ''}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
