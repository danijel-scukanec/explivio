import { useTranslation } from 'react-i18next';
import type { Reservation } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { TYPE_ICONS, reservationStatusColor, formatReservationTime, reservationDateKey } from './reservationMeta';
import { cn } from '@/lib/utils';

interface Props {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (id: string) => void;
  // In the itinerary day view the date is implied by the day, so hide the start date there.
  showDate?: boolean;
}

export function ReservationCard({ reservation: r, onEdit, onDelete, showDate = true }: Props) {
  const { t } = useTranslation();
  const start = formatReservationTime(r.startsAt);
  const spansDays = r.endsAt != null && reservationDateKey(r.endsAt) !== reservationDateKey(r.startsAt);
  const typeLabel = t(`enums.reservationType.${r.type}`);
  const cancelled = r.status === 'Cancelled';

  return (
    <div className={cn('border-primary bg-primary/5 flex items-start gap-3 rounded-lg border border-l-[3px] px-3.5 py-3', cancelled && 'opacity-60')}>
      <span className="shrink-0 pt-px text-lg" title={typeLabel}>{TYPE_ICONS[r.type]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-card-foreground text-[15px] font-semibold', cancelled && 'line-through')}>{r.title}</span>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase" style={{ backgroundColor: reservationStatusColor(r.status) }}>
            {t(`enums.reservationStatus.${r.status}`)}
          </span>
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          <span className="text-primary font-semibold">{typeLabel}</span>
          <span>
            {showDate ? `${formatTripDate(reservationDateKey(r.startsAt))}, ` : ''}{start}
            {spansDays && r.endsAt ? ` → ${formatTripDate(reservationDateKey(r.endsAt))}` : ''}
          </span>
          {r.provider && <span>{r.provider}</span>}
          {r.confirmationNumber && <span>#{r.confirmationNumber}</span>}
          {r.cost != null && <span className="text-card-foreground font-semibold">{formatCurrency(Number(r.cost), r.currency)}</span>}
        </div>
        {r.notes && <p className="text-muted-foreground mt-1.5 text-[13px]">{r.notes}</p>}
        {r.bookingUrl && (
          <a className="text-primary mt-1.5 inline-block text-[13px] hover:underline" href={r.bookingUrl} target="_blank" rel="noopener noreferrer">
            {t('reservation.openBooking')}
          </a>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button className="text-muted-foreground hover:text-primary rounded px-1.5 py-0.5 text-[13px] hover:bg-black/5" onClick={() => onEdit(r)} aria-label={t('reservation.edit')}>✎</button>
        <button className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded px-1.5 py-0.5 text-[13px]" onClick={() => onDelete(r.id)} aria-label={t('reservation.delete')}>✕</button>
      </div>
    </div>
  );
}
