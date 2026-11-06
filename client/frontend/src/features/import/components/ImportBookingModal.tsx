import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, ExtractedBookings, ExtractedBookingItem } from '@explivio/shared';
import { parseBooking } from '../services/importApi';
import { createActivity } from '../../itinerary/services/itineraryApi';
import { createReservation } from '../../reservations/services/reservationsApi';
import { Modal, ModalBody, ModalActions } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  tripId: string;
  trip: Trip | null;
  onClose: () => void;
  onAdded: () => void;
}

const KIND_ICON: Record<string, string> = {
  Flight: '✈️', Accommodation: '🏨', CarRental: '🚗', Restaurant: '🍽️', Transport: '🚆', Tour: '🎟️', Other: '📌',
};

export function ImportBookingModal({ tripId, trip, onClose, onAdded }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ExtractedBookings | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const parsed = await parseBooking(tripId, file);
      setResult(parsed);
      setSelected(new Set(parsed.items.map((_, i) => i)));
    } catch {
      setError(t('import.parseFailed'));
    } finally {
      setParsing(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function startsAt(date?: string | null, time?: string | null): string {
    return `${date ?? trip?.startDate ?? '2026-01-01'}T${time ?? '00:00'}:00`;
  }

  async function addItem(item: ExtractedBookingItem) {
    if (item.kind === 'Reservation') {
      await createReservation(tripId, {
        tripId,
        type: item.reservationType ?? 'Other',
        title: item.title,
        provider: item.provider ?? null,
        confirmationNumber: item.confirmationNumber ?? null,
        startsAt: startsAt(item.date, item.startTime),
        endsAt: item.endDate ? startsAt(item.endDate, item.endTime) : null,
        status: 'Confirmed',
        bookingUrl: item.bookingUrl ?? null,
        notes: item.description ?? null,
        cost: item.cost ?? null,
        currency: item.currency ?? trip?.baseCurrency ?? 'EUR',
      });
    } else {
      await createActivity(tripId, {
        tripId,
        name: item.title,
        description: item.description ?? null,
        location: item.location ?? null,
        date: item.date ?? trip?.startDate ?? '2026-01-01',
        startTime: item.startTime ? `${item.startTime}:00` : null,
        endTime: item.endTime ? `${item.endTime}:00` : null,
        category: item.category ?? 'Other',
        latitude: null,
        longitude: null,
      });
    }
  }

  async function handleAdd() {
    if (!result) return;
    setAdding(true);
    setError(null);

    // Add each selected item independently so one failure doesn't abort the rest. Track which
    // succeeded and which failed, by index.
    const succeeded = new Set<number>();
    const failed = new Set<number>();
    for (let i = 0; i < result.items.length; i++) {
      if (!selected.has(i)) continue;
      try {
        await addItem(result.items[i]);
        succeeded.add(i);
      } catch {
        failed.add(i);
      }
    }

    // Reflect anything that was added in the parent (itinerary/bookings refresh).
    if (succeeded.size > 0) onAdded();

    if (failed.size === 0) {
      onClose();
      return;
    }

    // Some failed: drop the items that were added (so a retry can't duplicate them), keep the rest,
    // and pre-select the failed ones so the next "Add" re-tries exactly those.
    const remaining: ExtractedBookingItem[] = [];
    const reselect = new Set<number>();
    for (let i = 0; i < result.items.length; i++) {
      if (succeeded.has(i)) continue;
      if (failed.has(i)) reselect.add(remaining.length);
      remaining.push(result.items[i]);
    }
    setResult({ ...result, items: remaining });
    setSelected(reselect);
    setError(t('import.partialFail', { added: succeeded.size, failed: failed.size }));
    setAdding(false);
  }

  return (
    <Modal title={t('import.title')} onClose={onClose}>
      <ModalBody>
        <p className="text-muted-foreground text-sm">{t('import.hint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml,.txt,.html,message/rfc822,text/plain,text/html,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing || adding}
        >
          {parsing ? t('import.parsing') : `📧 ${t('import.chooseFile')}`}
        </Button>

        {result && (
          <>
            {result.summary && <p className="text-muted-foreground text-sm">{result.summary}</p>}
            <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
              {result.items.map((item, i) => {
                const isRes = item.kind === 'Reservation';
                const icon = isRes ? (KIND_ICON[item.reservationType ?? 'Other'] ?? '📌') : '📍';
                return (
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5',
                      selected.has(i) ? 'border-primary bg-primary/5' : '',
                    )}
                    key={i}
                  >
                    <input type="checkbox" className="accent-primary mt-1 size-4" checked={selected.has(i)} onChange={() => toggle(i)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-card-foreground flex flex-wrap items-center gap-2 font-semibold">
                        {icon} {item.title}
                        <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase">
                          {isRes ? (item.reservationType ?? t('import.reservation')) : t('import.activity')}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[0.82rem]">
                        {item.date}{item.startTime ? ` · ${item.startTime}` : ''}
                        {item.provider ? ` · ${item.provider}` : ''}
                        {item.confirmationNumber ? ` · ${item.confirmationNumber}` : ''}
                        {item.cost != null ? ` · ${item.cost} ${item.currency ?? ''}` : ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </ModalBody>

      <ModalActions>
        <Button type="button" variant="secondary" onClick={onClose} disabled={adding}>
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={adding || !result || selected.size === 0}
        >
          {adding ? t('import.adding') : t('import.add', { count: selected.size })}
        </Button>
      </ModalActions>
    </Modal>
  );
}
