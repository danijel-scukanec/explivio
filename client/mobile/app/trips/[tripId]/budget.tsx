import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { BudgetSummary, BudgetBalances, Expense, TripMember } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { getBudget, getBudgetBalances, getTripMembers, setTripBaseCurrency, deleteExpense, fetchBudgetCsv } from '../../../src/api';
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

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

function nameFor(members: TripMember[], userId: string | null | undefined): string {
  if (!userId) return '—';
  const m = members.find(x => x.userId === userId);
  return m?.displayName?.trim() || `User ${userId.slice(0, 4)}`;
}

export default function BudgetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [balances, setBalances] = useState<BudgetBalances | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getBudget(tripId), getBudgetBalances(tripId), getTripMembers(tripId)])
      .then(([b, bal, mem]) => { setBudget(b); setBalances(bal); setMembers(mem); setError(null); })
      .catch(() => setError(t('budget.couldNotLoad')))
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

  async function changeBase(currency: string) {
    if (!tripId || currency === budget?.baseCurrency) return;
    await setTripBaseCurrency(tripId, currency);
    load();
  }

  async function exportCsv() {
    if (!tripId) return;
    try {
      const csv = await fetchBudgetCsv(tripId);
      await Share.share({ message: csv, title: t('budget.exportCsv') });
    } catch {
      setError(t('common.somethingWrong'));
    }
  }

  const header = (
    <Stack.Screen
      options={{
        title: t('budget.title'),
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/add-expense`)} hitSlop={10}>
            <Text style={styles.headerButton}>{t('mobile.addShort')}</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (loading) return <View style={styles.screen}>{header}<ActivityIndicator style={styles.center} color={theme.accent} /></View>;
  if (error || !budget) return <View style={styles.screen}>{header}<Text style={[styles.center, styles.error]}>{error ?? t('itinerary.notFound')}</Text></View>;

  const base = budget.baseCurrency;
  const total = Number(budget.total);
  const categories = [...budget.byCategory]
    .map(c => ({ category: c.category, total: Number(c.total) }))
    .sort((a, b) => b.total - a.total);
  const maxCategory = categories.reduce((m, c) => Math.max(m, c.total), 0);
  const byCurrency = budget.byCurrency.map(c => ({ currency: c.currency, total: Number(c.total) }));
  const mixedCurrency = byCurrency.length > 1 || (byCurrency[0] && byCurrency[0].currency !== base);
  const expenses = budget.expenses as Expense[];

  return (
    <View style={styles.screen}>
      {header}
      {othersViewing > 0 ? (
        <View style={styles.presence}>
          <View style={styles.presenceDot} />
          <Text style={styles.presenceText}>{t('itinerary.othersViewing', { count: othersViewing })}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View style={styles.totalHead}>
            <Text style={styles.totalLabel}>{t('budget.totalSpend')}</Text>
            <Text style={styles.baseLabel}>{t('budget.baseCurrency')}</Text>
          </View>
          <Text style={styles.totalValue}>{formatCurrency(total, base)}</Text>

          <View style={styles.baseChips}>
            {CURRENCIES.map(c => {
              const active = c === base;
              return (
                <TouchableOpacity key={c} style={[styles.baseChip, active && styles.baseChipActive]} onPress={() => changeBase(c)}>
                  <Text style={[styles.baseChipText, active && styles.baseChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!budget.conversionAvailable ? (
            <Text style={styles.fxWarning}>{t('budget.fxUnavailable')}</Text>
          ) : null}

          {mixedCurrency ? (
            <View style={styles.currencyChips}>
              {byCurrency.map(c => (
                <Text style={styles.currencyChip} key={c.currency}>{formatCurrency(c.total, c.currency)}</Text>
              ))}
            </View>
          ) : null}

          {categories.map(c => (
            <View style={styles.catRow} key={c.category}>
              <Text style={styles.catLabel}>{t(`enums.expenseCategory.${c.category}`)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: maxCategory > 0 ? `${(c.total / maxCategory) * 100}%` : '0%' }]} />
              </View>
              <Text style={styles.catValue}>{formatCurrency(c.total, base)}</Text>
            </View>
          ))}
        </View>

        {balances && balances.settlements.length > 0 ? (
          <View style={styles.balances}>
            <Text style={styles.sectionTitle}>{t('budget.balancesTitle')}</Text>
            <View style={styles.balanceMembers}>
              {balances.balances.map(b => {
                const net = Number(b.net);
                const color = net > 0 ? '#16a34a' : net < 0 ? theme.danger : theme.text;
                return (
                  <View style={styles.balanceMember} key={b.userId}>
                    <Text style={styles.balanceName}>{b.displayName}</Text>
                    <Text style={[styles.balanceNet, { color }]}>{net > 0 ? '+' : ''}{formatCurrency(net, base)}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.settleTitle}>{t('budget.settleUp')}</Text>
            {balances.settlements.map((sx, i) => (
              <View style={styles.transfer} key={i}>
                <Text style={styles.transferText}>{sx.fromName} → {sx.toName}</Text>
                <Text style={styles.transferAmount}>{formatCurrency(Number(sx.amount), base)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.expensesHead}>
          <Text style={styles.sectionTitle}>{t('budget.expenses')}</Text>
          {expenses.length > 0 ? (
            <TouchableOpacity onPress={exportCsv} hitSlop={8}>
              <Text style={styles.exportLink}>{t('budget.exportCsv')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {expenses.length === 0 ? (
          <Text style={styles.empty}>{t('budget.empty')}</Text>
        ) : (
          expenses.map(e => {
            // F23: expenses created from a booking's cost are managed from the booking, not here.
            const fromBooking = e.reservationId != null;
            const converted = e.amountInBase != null && e.currency !== base ? Number(e.amountInBase) : null;
            const shares = e.shares ?? [];
            return (
              <View style={styles.expense} key={e.id}>
                <Text style={styles.expenseIcon}>{CATEGORY_ICONS[e.category] ?? '📌'}</Text>
                <View style={styles.expenseBody}>
                  <View style={styles.expenseDescRow}>
                    <Text style={styles.expenseDesc}>{e.description}</Text>
                    {fromBooking ? <Text style={styles.bookingTag}>{t('expense.fromBooking')}</Text> : null}
                    {shares.length > 0 ? <Text style={styles.splitTag}>{t('expense.splitWays', { count: shares.length })}</Text> : null}
                  </View>
                  <Text style={styles.expenseMeta}>
                    {t(`enums.expenseCategory.${e.category}`)} · {formatTripDate(e.date)}
                    {e.paidByUserId ? ` · ${t('expense.paidBy', { name: nameFor(members, e.paidByUserId) })}` : ''}
                  </Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.expenseAmount}>{formatCurrency(Number(e.amount), e.currency)}</Text>
                  {converted != null ? <Text style={styles.expenseConverted}>≈ {formatCurrency(converted, base)}</Text> : null}
                </View>
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
  totalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 12, color: theme.text, letterSpacing: 0.5 },
  baseLabel: { fontSize: 11, color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 30, fontWeight: '700', color: theme.textStrong, marginTop: 2, marginBottom: 10 },
  baseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  baseChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: theme.border },
  baseChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  baseChipText: { fontSize: 12, color: theme.text },
  baseChipTextActive: { color: '#fff', fontWeight: '600' },
  fxWarning: { fontSize: 12, color: '#d97706', marginBottom: 10 },
  currencyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  currencyChip: { fontSize: 12, color: theme.textStrong, backgroundColor: theme.accentBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  catLabel: { width: 96, fontSize: 13, color: theme.text },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: theme.accentBg, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: theme.accent },
  catValue: { width: 80, fontSize: 13, color: theme.textStrong, textAlign: 'right' },
  balances: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16, marginBottom: 20 },
  balanceMembers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 14 },
  balanceMember: { minWidth: 110, padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 10 },
  balanceName: { fontSize: 13, color: theme.text },
  balanceNet: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  settleTitle: { fontSize: 12, color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  transfer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  transferText: { fontSize: 14, color: theme.textStrong },
  transferAmount: { fontSize: 14, fontWeight: '600', color: theme.textStrong },
  expensesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exportLink: { fontSize: 14, color: theme.accent, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textStrong },
  empty: { fontSize: 13, color: theme.text, fontStyle: 'italic', marginTop: 8 },
  expense: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  expenseIcon: { fontSize: 18 },
  expenseBody: { flex: 1 },
  expenseDescRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  expenseDesc: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  bookingTag: { fontSize: 11, color: theme.accent, backgroundColor: theme.accentBg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  splitTag: { fontSize: 11, color: theme.textStrong, backgroundColor: theme.border, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  locked: { fontSize: 13, paddingHorizontal: 2, opacity: 0.6 },
  expenseMeta: { fontSize: 12, color: theme.text, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: theme.textStrong },
  expenseConverted: { fontSize: 12, color: theme.text },
  delete: { paddingHorizontal: 2 },
  deleteText: { color: theme.border, fontSize: 15 },
});
