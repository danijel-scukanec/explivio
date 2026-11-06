import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExpenseCategory, AddExpenseRequest, ExpenseShareInput, TripMember } from '@explivio/shared';
import { addExpense, scanReceipt, uploadReceipt } from '../services/budgetApi';
import { useFeatures, isFeatureOn } from '../../../shared/hooks/useFeatures';
import { memberName } from '../memberNames';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = [
  'Transport', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Other',
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

interface Props {
  tripId: string;
  defaultDate: string;
  defaultCurrency: string;
  members: TripMember[];
  onClose: () => void;
  onCreated: () => void;
}

// Splits `amount` into `n` equal shares (2dp), giving the last share the rounding remainder so the
// shares always sum exactly to the amount.
function equalShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((amount / n) * 100) / 100;
  const shares = Array(n).fill(each);
  shares[n - 1] = Math.round((amount - each * (n - 1)) * 100) / 100;
  return shares;
}

export function AddExpenseModal({ tripId, defaultDate, defaultCurrency, members, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: defaultCurrency,
    category: 'Food' as ExpenseCategory,
    date: defaultDate,
  });
  const [split, setSplit] = useState(false);
  const [paidBy, setPaidBy] = useState(members[0]?.userId ?? '');
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map(m => m.userId)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // F17: a scanned receipt — pre-fills the form on scan, and is attached to the expense after it's created.
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canScan = isFeatureOn(useFeatures(), 'AiReceiptScanning');

  const amount = Number(form.amount) || 0;
  const selectedIds = useMemo(() => members.filter(m => selected.has(m.userId)).map(m => m.userId), [members, selected]);
  const canSplit = members.length > 1;

  // The share each selected member is assigned, by mode.
  const shares = useMemo<Record<string, number>>(() => {
    if (mode === 'equal') {
      const amounts = equalShares(amount, selectedIds.length);
      return Object.fromEntries(selectedIds.map((id, i) => [id, amounts[i] ?? 0]));
    }
    return Object.fromEntries(selectedIds.map(id => [id, Number(customAmounts[id]) || 0]));
  }, [mode, amount, selectedIds, customAmounts]);

  const sharesTotal = selectedIds.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  const splitBalanced = Math.abs(sharesTotal - amount) <= 0.01;

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  // F17: scan a chosen receipt image → pre-fill the form with the extracted draft (the user reviews it).
  async function handleReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setScanning(true);
    setError(null);
    try {
      const draft = await scanReceipt(tripId, file);
      setForm(prev => ({
        ...prev,
        description: draft.description ?? prev.description,
        amount: draft.amount != null ? String(draft.amount) : prev.amount,
        currency: draft.currency ?? prev.currency,
        category: (draft.category as ExpenseCategory) ?? prev.category,
        date: draft.date ?? prev.date,
      }));
    } catch {
      setError(t('addExpense.scanFailed'));
    } finally {
      setScanning(false);
    }
  }

  function toggleMember(userId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!(amount > 0)) {
      setError(t('addExpense.amountGtZero'));
      return;
    }

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
      tripId,
      description: form.description,
      amount,
      currency: form.currency,
      category: form.category,
      date: form.date,
      paidByUserId,
      splits,
    };

    try {
      const id = await addExpense(tripId, data);
      // F17: attach the scanned receipt image after the expense exists (create → attach). Keep the
      // expense even if the image upload fails — the data is already saved.
      if (receiptFile) {
        try { await uploadReceipt(tripId, id, receiptFile); } catch { /* non-fatal */ }
      }
      onCreated();
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t('addExpense.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          {canScan && (
            <div className="flex items-center gap-2.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handleReceipt}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? t('addExpense.scanning') : t('addExpense.scanReceipt')}
              </Button>
              {receiptFile && !scanning && (
                <span className="text-muted-foreground truncate text-[13px]">📎 {receiptFile.name}</span>
              )}
            </div>
          )}

          <Field label={t('addExpense.description')}>
            <Input name="description" value={form.description} onChange={handleChange} required maxLength={300} placeholder={t('addExpense.descriptionPlaceholder')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('addExpense.amount')}>
              <Input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" step="0.01" placeholder="0.00" />
            </Field>
            <Field label={t('addExpense.currency')}>
              <Select name="currency" value={form.currency} onChange={handleChange}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('addExpense.category')}>
              <Select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`enums.expenseCategory.${c}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('addExpense.date')}>
              <Input type="date" name="date" value={form.date} onChange={handleChange} required />
            </Field>
          </div>

          {canSplit && (
            <div className="border-t pt-3">
              <label className="text-card-foreground flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary size-4" checked={split} onChange={e => setSplit(e.target.checked)} />
                {t('addExpense.splitExpense')}
              </label>

              {split && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('addExpense.paidBy')}>
                      <Select value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                        {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m)}</option>)}
                      </Select>
                    </Field>
                    <Field label={t('addExpense.splitMode')}>
                      <Select value={mode} onChange={e => setMode(e.target.value as 'equal' | 'custom')}>
                        <option value="equal">{t('addExpense.splitEqual')}</option>
                        <option value="custom">{t('addExpense.splitCustom')}</option>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {members.map(m => {
                      const isSelected = selected.has(m.userId);
                      return (
                        <div className={cn('flex items-center justify-between gap-2.5 rounded-lg border px-2.5 py-1.5', isSelected ? 'border-primary' : 'opacity-60')} key={m.userId}>
                          <label className="text-card-foreground flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" className="accent-primary size-4" checked={isSelected} onChange={() => toggleMember(m.userId)} />
                            {memberName(m)}
                          </label>
                          {isSelected && (
                            mode === 'equal'
                              ? <span className="text-muted-foreground text-sm tabular-nums">{(shares[m.userId] ?? 0).toFixed(2)}</span>
                              : <Input
                                  className="h-8 w-24 text-right"
                                  type="number" min="0" step="0.01"
                                  value={customAmounts[m.userId] ?? ''}
                                  onChange={e => setCustomAmounts(prev => ({ ...prev, [m.userId]: e.target.value }))}
                                  placeholder="0.00"
                                />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className={cn('text-[13px] tabular-nums', splitBalanced ? 'text-muted-foreground' : 'text-destructive')}>
                    {t('addExpense.splitTotal', {
                      total: sharesTotal.toFixed(2),
                      amount: amount.toFixed(2),
                      currency: form.currency,
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </ModalBody>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('addExpense.adding') : t('addExpense.add')}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
