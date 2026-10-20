import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createActivity } from '../../../src/api';
import { useItineraryGeneration } from '../../../src/useItineraryGeneration';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORY_ICONS: Record<string, string> = {
  Sightseeing: '🏛', Food: '🍽', Transport: '🚌', Accommodation: '🏨', Adventure: '🧗', Other: '📌',
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function GenerateScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId, startDate, days: daysParam } = useLocalSearchParams<{ tripId: string; startDate?: string; days?: string }>();
  const [prompt, setPrompt] = useState('');
  const [days, setDays] = useState(daysParam ?? '3');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // F31: streams the itinerary over SignalR so activity cards reveal one by one, like the web client.
  const gen = useItineraryGeneration(tripId!);

  function generate() {
    setAddError(null);
    gen.generate({ tripId: tripId!, prompt, days: Number(days) || 3, style: null, budget: null });
  }

  async function addAll() {
    if (!gen.activities.length || !startDate) return;
    setAdding(true);
    setAddError(null);
    try {
      for (const a of gen.activities) {
        await createActivity(tripId!, {
          tripId: tripId!,
          name: a.name,
          description: a.description ?? null,
          location: null,
          date: addDays(startDate, Math.max(0, Number(a.day) - 1)),
          startTime: a.suggestedStartTime ? `${a.suggestedStartTime}:00` : null,
          endTime: null,
          category: a.category,
          latitude: null,
          longitude: null,
        });
      }
      router.back();
    } catch {
      setAddError(t('mobile.couldNotAddActivities'));
      setAdding(false);
    }
  }

  const streaming = gen.status === 'streaming';
  const busy = streaming || adding;

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t('mobile.generateTitle') }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>{t('mobile.describeTrip')}</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={t('mobile.generatePromptPlaceholder')}
            placeholderTextColor={theme.border}
            multiline
            editable={!busy}
          />
        </View>
        <View style={{ width: 120 }}>
          <Text style={s.label}>{t('generate.days')}</Text>
          <TextInput style={s.input} value={days} onChangeText={setDays} keyboardType="number-pad" editable={!busy} />
        </View>

        <TouchableOpacity style={[s.submit, busy && s.submitDisabled]} onPress={generate} disabled={busy}>
          <Text style={s.submitText}>{streaming ? t('generate.generating') : t('mobile.generateBtn')}</Text>
        </TouchableOpacity>

        {streaming ? <ActivityIndicator color={theme.accent} /> : null}
        {gen.status === 'error' ? <Text style={s.error}>{gen.error ?? t('mobile.generationFailed')}</Text> : null}
        {addError ? <Text style={s.error}>{addError}</Text> : null}

        {gen.summary || gen.activities.length > 0 ? (
          <View style={{ gap: 10 }}>
            {gen.summary ? <Text style={{ color: theme.text, fontSize: 14 }}>{gen.summary}</Text> : null}
            {gen.activities.map((a, i) => (
              <View key={i} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontWeight: '700', color: theme.textStrong }}>
                  {CATEGORY_ICONS[a.category] ?? '📌'} {a.name}
                </Text>
                <Text style={{ color: theme.text, fontSize: 13, marginTop: 2 }}>
                  {t('generate.day', { number: a.day })}{a.suggestedStartTime ? ` · ${a.suggestedStartTime}` : ''}
                </Text>
                {a.description ? <Text style={{ color: theme.text, fontSize: 13, marginTop: 4 }}>{a.description}</Text> : null}
              </View>
            ))}
            {gen.status === 'done' && gen.activities.length > 0 ? (
              <TouchableOpacity style={[s.submit, adding && s.submitDisabled]} onPress={addAll} disabled={adding}>
                <Text style={s.submitText}>{adding ? t('generate.adding') : t('generate.addAll', { count: gen.activities.length })}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
