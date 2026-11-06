import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Reservation } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getReservations, deleteReservation } from '../services/reservationsApi';
import { ReservationCard } from '../components/ReservationCard';
import { ReservationModal } from '../components/ReservationModal';
import { reservationDateKey } from '../components/reservationMeta';
import { useTrip } from '../../trips/pages/TripLayout';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { Button } from '@/components/ui/button';

export function BookingsPage() {
  const { t } = useTranslation();
  const { trip, tripId, changeSignal } = useTrip();
  const confirm = useConfirm();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = closed, 'new' = add form, otherwise the booking being edited.
  const [editor, setEditor] = useState<Reservation | 'new' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReservations(await getReservations(tripId));
    } catch {
      setError(t('bookings.couldNotLoad'));
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load, changeSignal]);

  async function handleDelete(id: string) {
    if (!(await confirm())) return;
    await deleteReservation(tripId, id);
    load();
  }

  // Group by start day (reservations arrive sorted by StartsAt).
  const groups: { date: string; items: Reservation[] }[] = [];
  for (const r of reservations) {
    const key = reservationDateKey(r.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.date === key) last.items.push(r);
    else groups.push({ date: key, items: [r] });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button onClick={() => setEditor('new')}>{t('bookings.addBooking')}</Button>
      </div>

      {error && <p className="text-destructive mb-3 text-sm">{error}</p>}

      {reservations.length === 0
        ? <p className="text-muted-foreground text-sm">{t('bookings.empty')}</p>
        : (
          <div className="flex flex-col gap-6">
            {groups.map(g => (
              <div key={g.date}>
                <h2 className="text-foreground mb-2.5 text-sm font-semibold">{formatTripDate(g.date)}</h2>
                <div className="flex flex-col gap-2.5">
                  {g.items.map(r => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      showDate={false}
                      onEdit={setEditor}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {editor && (
        <ReservationModal
          tripId={tripId}
          reservation={editor === 'new' ? undefined : editor}
          defaultDate={trip.startDate}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
        />
      )}
    </div>
  );
}
