import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, ExtractedBookings, ExtractedBookingItem } from '@explivio/shared';
import { parseBooking } from '../services/importApi';
import { createActivity } from '../../itinerary/services/itineraryApi';
import { createReservation } from '../../reservations/services/reservationsApi';
import '../../trips/components/CreateTripModal.css';
import './ImportBookingModal.css';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{t('import.title')}</h2>
          <button className="modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <div className="modal__form">
          <p className="import__hint">{t('import.hint')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".eml,.txt,.html,message/rfc822,text/plain,text/html,image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || adding}
          >
            {parsing ? t('import.parsing') : `📧 ${t('import.chooseFile')}`}
          </button>

          {result && (
            <>
              {result.summary && <p className="import__summary">{result.summary}</p>}
              <div className="import__list">
                {result.items.map((item, i) => {
                  const isRes = item.kind === 'Reservation';
                  const icon = isRes ? (KIND_ICON[item.reservationType ?? 'Other'] ?? '📌') : '📍';
                  return (
                    <label className={`import__item${selected.has(i) ? ' import__item--on' : ''}`} key={i}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                      <div className="import__item-body">
                        <div className="import__item-title">
                          {icon} {item.title}
                          <span className="import__badge">
                            {isRes ? (item.reservationType ?? t('import.reservation')) : t('import.activity')}
                          </span>
                        </div>
                        <div className="import__item-meta">
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

          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={adding}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={adding || !result || selected.size === 0}
            >
              {adding ? t('import.adding') : t('import.add', { count: selected.size })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
