import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { BudgetSummary, Expense } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { getBudget, deleteExpense } from '../../../src/api';
import { useTripCollaboration } from '../../../src/useTripCollaboration';
import { theme } from '../../../src/theme';

const CATEGORY_ICONS: Record<string, string> = {
  Transport: '🚌',
  Accommodation: '🏨',
  Food: '🍽',
  Activities: '🎟',
  Shopping: '🛍',
  Other: '📌',
};

export default function BudgetScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    return getBudget(tripId)
      .then(data => { setBudget(data); setError(null); })
      .catch(() => setError('Could not load budget.'))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // F15/F31: live collaboration — refetch when another member changes expenses, and show presence.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteExpense(tripId, id);
    load();
  }

  const header = (
    <Stack.Screen
      options={{
        title: 'Budget',
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/add-expense`)} hitSlop={10}>
            <Text style={styles.headerButton}>+ Add</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (loading) return <View style={styles.screen}>{header}<ActivityIndicator style={styles.center} color={theme.accent} /></View>;
  if (error || !budget) return <View style={styles.screen}>{header}<Text style={[styles.center, styles.error]}>{error ?? 'Not found.'}</Text></View>;

  const total = Number(budget.total);
  const categories = [...budget.byCategory]
    .map(c => ({ category: c.category, total: Number(c.total) }))
    .sort((a, b) => b.total - a.total);
  const maxCategory = categories.reduce((m, c) => Math.max(m, c.total), 0);
  const expenses = budget.expenses as Expense[];
  const currency = expenses[0]?.currency ?? 'USD';

  return (
    <View style={styles.screen}>
      {header}
      {othersViewing > 0 ? (
        <View style={styles.presence}>
          <View style={styles.presenceDot} />
          <Text style={styles.presenceText}>{othersViewing} other{othersViewing > 1 ? 's' : ''} viewing</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.totalLabel}>TOTAL SPEND</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
          {categories.map(c => (
            <View style={styles.catRow} key={c.category}>
              <Text style={styles.catLabel}>{c.category}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: maxCategory > 0 ? `${(c.total / maxCategory) * 100}%` : '0%' }]} />
              </View>
              <Text style={styles.catValue}>{formatCurrency(c.total, currency)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Expenses</Text>
        {expenses.length === 0 ? (
          <Text style={styles.empty}>No expenses yet. Tap “+ Add”.</Text>
        ) : (
          expenses.map(e => {
            // F23: expenses created from a booking's cost are managed from the booking, not here.
            const fromBooking = e.reservationId != null;
            return (
              <View style={styles.expense} key={e.id}>
                <Text style={styles.expenseIcon}>{CATEGORY_ICONS[e.category] ?? '📌'}</Text>
                <View style={styles.expenseBody}>
                  <View style={styles.expenseDescRow}>
                    <Text style={styles.expenseDesc}>{e.description}</Text>
                    {fromBooking ? <Text style={styles.bookingTag}>from booking</Text> : null}
                  </View>
                  <Text style={styles.expenseMeta}>{e.category} · {formatTripDate(e.date)}</Text>
                </View>
                <Text style={styles.expenseAmount}>{formatCurrency(Number(e.amount), e.currency)}</Text>
                {fromBooking ? (
                  <Text style={styles.locked}>🔒</Text>
                ) : (
                  <TouchableOpacity onPress={() => handleDelete(e.id)} hitSlop={10} style={styles.delete}>
                    <Text style={styles.deleteText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text },
  error: { color: theme.danger },
  headerButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.accentBg },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  presenceText: { fontSize: 13, color: theme.accent, fontWeight: '500' },
  summary: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16, marginBottom: 20 },
  totalLabel: { fontSize: 12, color: theme.text, letterSpacing: 0.5 },
  totalValue: { fontSize: 30, fontWeight: '700', color: theme.textStrong, marginTop: 2, marginBottom: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  catLabel: { width: 96, fontSize: 13, color: theme.text },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: theme.accentBg, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: theme.accent },
  catValue: { width: 80, fontSize: 13, color: theme.textStrong, textAlign: 'right' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textStrong, marginBottom: 4 },
  empty: { fontSize: 13, color: theme.text, fontStyle: 'italic', marginTop: 8 },
  expense: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  expenseIcon: { fontSize: 18 },
  expenseBody: { flex: 1 },
  expenseDescRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  expenseDesc: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  bookingTag: { fontSize: 11, color: theme.accent, backgroundColor: theme.accentBg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  locked: { fontSize: 13, paddingHorizontal: 2, opacity: 0.6 },
  expenseMeta: { fontSize: 12, color: theme.text, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: theme.textStrong },
  delete: { paddingHorizontal: 2 },
  deleteText: { color: theme.border, fontSize: 15 },
});
