import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AddExpenseRequest, ExpenseCategory } from '@explivio/shared';
import { addExpense } from '../../../src/api';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORIES: ExpenseCategory[] = ['Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
      setError(t('mobile.enterDescDate'));
      return;
    }
    if (!(amount > 0)) {
      setError(t('addExpense.amountGtZero'));
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
      setError(t('common.somethingWrong'));
      setSubmitting(false);
    }
  }

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t('addExpense.title') }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>{t('addExpense.description')}</Text>
          <TextInput style={s.input} value={form.description} onChangeText={set('description')} placeholder={t('addExpense.descriptionPlaceholder')} placeholderTextColor={theme.border} />
        </View>
        <View style={s.row}>
          <View style={s.rowItem}>
            <Text style={s.label}>{t('addExpense.amount')}</Text>
            <TextInput style={s.input} value={form.amount} onChangeText={set('amount')} placeholder="0.00" placeholderTextColor={theme.border} keyboardType="decimal-pad" />
          </View>
          <View style={s.rowItem}>
            <Text style={s.label}>{t('addExpense.date')}</Text>
            <TextInput style={s.input} value={form.date} onChangeText={set('date')} placeholder="YYYY-MM-DD" placeholderTextColor={theme.border} autoCapitalize="none" />
          </View>
        </View>
        <View>
          <Text style={s.label}>{t('addExpense.currency')}</Text>
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
          <Text style={s.label}>{t('addExpense.category')}</Text>
          <View style={s.chipRow}>
            {CATEGORIES.map(c => {
              const active = form.category === c;
              return (
                <TouchableOpacity key={c} style={[s.chip, active && s.chipActive]} onPress={() => setForm(p => ({ ...p, category: c }))}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{t(`enums.expenseCategory.${c}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? t('addExpense.adding') : t('addExpense.add')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
