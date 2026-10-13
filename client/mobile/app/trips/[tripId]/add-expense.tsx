import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { AddExpenseRequest, ExpenseCategory } from '@explivio/shared';
import { addExpense } from '../../../src/api';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORIES: ExpenseCategory[] = ['Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'USD',
    category: 'Food' as ExpenseCategory,
    date: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit() {
    setError(null);
    const amount = Number(form.amount);
    if (!form.description || !form.date) {
      setError('Please enter a description and date.');
      return;
    }
    if (!(amount > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    const data: AddExpenseRequest = {
      tripId: tripId!,
      description: form.description,
      amount,
      currency: form.currency,
      category: form.category,
      date: form.date,
    };
    try {
      await addExpense(tripId!, data);
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Add expense' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Description</Text>
          <TextInput style={s.input} value={form.description} onChangeText={set('description')} placeholder="e.g. Train tickets" placeholderTextColor={theme.border} />
        </View>
        <View style={s.row}>
          <View style={s.rowItem}>
            <Text style={s.label}>Amount</Text>
            <TextInput style={s.input} value={form.amount} onChangeText={set('amount')} placeholder="0.00" placeholderTextColor={theme.border} keyboardType="decimal-pad" />
          </View>
          <View style={s.rowItem}>
            <Text style={s.label}>Date</Text>
            <TextInput style={s.input} value={form.date} onChangeText={set('date')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
          </View>
        </View>
        <View>
          <Text style={s.label}>Currency</Text>
          <View style={s.chipRow}>
            {CURRENCIES.map(c => {
              const active = form.currency === c;
              return (
                <TouchableOpacity key={c} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => ({ ...p, currency: c }))}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
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

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? 'Adding…' : 'Add expense'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
