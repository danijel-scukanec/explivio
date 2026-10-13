import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { GeneratedActivity, GeneratedItinerary } from '@explivio/shared';
import { generateItinerary, createActivity } from '../../../src/api';
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
  const { tripId, startDate, days: daysParam } = useLocalSearchParams<{ tripId: string; startDate?: string; days?: string }>();
  const [prompt, setPrompt] = useState('');
  const [days, setDays] = useState(daysParam ?? '3');
  const [result, setResult] = useState<GeneratedItinerary | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'adding'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setResult(null);
    setStatus('generating');
    try {
      const data = await generateItinerary(tripId!, { tripId: tripId!, prompt, days: Number(days) || 3, style: null, budget: null });
      setResult(data);
    } catch {
      setError('Generation failed. Try again.');
    } finally {
      setStatus('idle');
    }
  }

  async function addAll() {
    if (!result || !startDate) return;
    setStatus('adding');
    try {
      for (const a of result.activities as GeneratedActivity[]) {
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
      setError('Could not add all activities.');
      setStatus('idle');
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Generate with AI' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Describe your trip</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. 3 relaxed days in Lisbon, food and history"
            placeholderTextColor={theme.border}
            multiline
          />
        </View>
        <View style={{ width: 120 }}>
          <Text style={s.label}>Days</Text>
          <TextInput style={s.input} value={days} onChangeText={setDays} keyboardType="number-pad" />
        </View>

        <TouchableOpacity style={[s.submit, status !== 'idle' && s.submitDisabled]} onPress={generate} disabled={status !== 'idle'}>
          <Text style={s.submitText}>{status === 'generating' ? 'Generating…' : '✨ Generate'}</Text>
        </TouchableOpacity>

        {status === 'generating' ? <ActivityIndicator color={theme.accent} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {result ? (
          <View style={{ gap: 10 }}>
            {result.summary ? <Text style={{ color: theme.text, fontSize: 14 }}>{result.summary}</Text> : null}
            {(result.activities as GeneratedActivity[]).map((a, i) => (
              <View key={i} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontWeight: '700', color: theme.textStrong }}>
                  {CATEGORY_ICONS[a.category] ?? '📌'} {a.name}
                </Text>
                <Text style={{ color: theme.text, fontSize: 13, marginTop: 2 }}>
                  Day {a.day}{a.suggestedStartTime ? ` · ${a.suggestedStartTime}` : ''}
                </Text>
                {a.description ? <Text style={{ color: theme.text, fontSize: 13, marginTop: 4 }}>{a.description}</Text> : null}
              </View>
            ))}
            <TouchableOpacity style={[s.submit, status === 'adding' && s.submitDisabled]} onPress={addAll} disabled={status === 'adding'}>
              <Text style={s.submitText}>{status === 'adding' ? 'Adding…' : `Add all ${result.activities.length} to itinerary`}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
