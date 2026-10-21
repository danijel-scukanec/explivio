import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AddExpenseRequest, ExpenseCategory, ExpenseShareInput, TripMember } from '@explivio/shared';
import { addExpense, getTrip, getTripMembers } from '../../../src/api';
import { formStyles as s } from '../../../src/formStyles';
import { theme } from '../../../src/theme';

const CATEGORIES: ExpenseCategory[] = ['Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

function memberName(m: TripMember): string {
  return m.displayName?.trim() || `User ${m.userId.slice(0, 4)}`;
}

// Splits `amount` into `n` equal shares (2dp); the last share takes the rounding remainder.
function equalShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((amount / n) * 100) / 100;
  const out = Array(n).fill(each);
  out[n - 1] = Math.round((amount - each * (n - 1)) * 100) / 100;
  return out;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'EUR',
    category: 'Food' as ExpenseCategory,
    date: '',
  });
  const [members, setMembers] = useState<TripMember[]>([]);
  const [split, setSplit] = useState(false);
  const [paidBy, setPaidBy] = useState('');
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    getTrip(tripId).then(trip => setForm(p => ({ ...p, currency: trip.baseCurrency }))).catch(() => {});
    getTripMembers(tripId).then(m => {
      setMembers(m);
      setSelected(new Set(m.map(x => x.userId)));
      setPaidBy(m[0]?.userId ?? '');
    }).catch(() => {});
  }, [tripId]);

  const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const amount = Number(form.amount) || 0;
  const canSplit = members.length > 1;
  const selectedIds = useMemo(() => members.filter(m => selected.has(m.userId)).map(m => m.userId), [members, selected]);

  const shares = useMemo<Record<string, number>>(() => {
    if (mode === 'equal') {
      const amounts = equalShares(amount, selectedIds.length);
      return Object.fromEntries(selectedIds.map((id, i) => [id, amounts[i] ?? 0]));
    }
    return Object.fromEntries(selectedIds.map(id => [id, Number(custom[id]) || 0]));
  }, [mode, amount, selectedIds, custom]);

  const sharesTotal = selectedIds.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  const splitBalanced = Math.abs(sharesTotal - amount) <= 0.01;

  function toggleMember(userId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!form.description || !form.date) { setError(t('mobile.enterDescDate')); return; }
    if (!(amount > 0)) { setError(t('addExpense.amountGtZero')); return; }

    let paidByUserId: string | undefined;
    let splits: ExpenseShareInput[] | undefined;
    if (split) {
      if (selectedIds.length === 0) { setError(t('addExpense.pickSomeone')); return; }
      if (!paidBy) { setError(t('addExpense.pickPayer')); return; }
      if (!splitBalanced) { setError(t('addExpense.sharesMustSum')); return; }
      paidByUserId = paidBy;
      splits = selectedIds.map(id => ({ userId: id, amount: shares[id] }));
    }

    setSubmitting(true);
    const data: AddExpenseRequest = {
      tripId: tripId!,
      description: form.description,
      amount,
      currency: form.currency,
      category: form.category,
      date: form.date,
      paidByUserId,
      splits,
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

        {canSplit ? (
          <View style={styles.split}>
            <View style={styles.splitToggle}>
              <Text style={s.label}>{t('addExpense.splitExpense')}</Text>
              <Switch value={split} onValueChange={setSplit} trackColor={{ true: theme.accent }} />
            </View>

            {split ? (
              <>
                <Text style={s.label}>{t('addExpense.paidBy')}</Text>
                <View style={s.chipRow}>
                  {members.map(m => {
                    const active = paidBy === m.userId;
                    return (
                      <TouchableOpacity key={m.userId} style={[s.chip, active && s.chipActive]} onPress={() => setPaidBy(m.userId)}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{memberName(m)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.label}>{t('addExpense.splitMode')}</Text>
                <View style={s.chipRow}>
                  {(['equal', 'custom'] as const).map(mo => {
                    const active = mode === mo;
                    return (
                      <TouchableOpacity key={mo} style={[s.chip, active && s.chipActive]} onPress={() => setMode(mo)}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{t(mo === 'equal' ? 'addExpense.splitEqual' : 'addExpense.splitCustom')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {members.map(m => {
                  const on = selected.has(m.userId);
                  return (
                    <View key={m.userId} style={[styles.splitMember, on && styles.splitMemberOn]}>
                      <TouchableOpacity style={styles.splitPick} onPress={() => toggleMember(m.userId)}>
                        <Text style={styles.splitCheck}>{on ? '☑' : '☐'}</Text>
                        <Text style={styles.splitName}>{memberName(m)}</Text>
                      </TouchableOpacity>
                      {on ? (
                        mode === 'equal' ? (
                          <Text style={styles.splitShare}>{(shares[m.userId] ?? 0).toFixed(2)}</Text>
                        ) : (
                          <TextInput
                            style={styles.splitInput}
                            value={custom[m.userId] ?? ''}
                            onChangeText={v => setCustom(p => ({ ...p, [m.userId]: v }))}
                            placeholder="0.00" placeholderTextColor={theme.border} keyboardType="decimal-pad"
                          />
                        )
                      ) : null}
                    </View>
                  );
                })}

                <Text style={[styles.splitSummary, !splitBalanced && styles.splitSummaryOff]}>
                  {t('addExpense.splitTotal', { total: sharesTotal.toFixed(2), amount: amount.toFixed(2), currency: form.currency })}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.submit, submitting && s.submitDisabled]} onPress={submit} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? t('addExpense.adding') : t('addExpense.add')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, gap: 6 },
  splitToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  splitMember: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginTop: 6, opacity: 0.6 },
  splitMemberOn: { opacity: 1, borderColor: theme.accent },
  splitPick: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitCheck: { fontSize: 16, color: theme.accent },
  splitName: { fontSize: 14, color: theme.textStrong },
  splitShare: { fontSize: 14, color: theme.text },
  splitInput: { width: 90, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, color: theme.textStrong, textAlign: 'right' },
  splitSummary: { fontSize: 13, color: theme.text, marginTop: 8 },
  splitSummaryOff: { color: theme.danger },
});
