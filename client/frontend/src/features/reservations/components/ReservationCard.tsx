import type { Reservation } from '@explivio/shared';
import { formatCurrency, formatTripDate } from '@explivio/shared';
import { TYPE_ICONS, TYPE_LABELS, reservationStatusColor, formatReservationTime, reservationDateKey } from './reservationMeta';
import './ReservationCard.css';

interface Props {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (id: string) => void;
  // In the itinerary day view the date is implied by the day, so hide the start date there.
  showDate?: boolean;
}

export function ReservationCard({ reservation: r, onEdit, onDelete, showDate = true }: Props) {
  const start = formatReservationTime(r.startsAt);
  const spansDays = r.endsAt != null && reservationDateKey(r.endsAt) !== reservationDateKey(r.startsAt);

  return (
    <div className={`reservation-card${r.status === 'Cancelled' ? ' reservation-card--cancelled' : ''}`}>
      <span className="reservation-card__icon" title={TYPE_LABELS[r.type]}>{TYPE_ICONS[r.type]}</span>
      <div className="reservation-card__body">
        <div className="reservation-card__header">
          <span className="reservation-card__title">{r.title}</span>
          <span className="reservation-card__status" style={{ backgroundColor: reservationStatusColor(r.status) }}>
            {r.status}
          </span>
        </div>
        <div className="reservation-card__meta">
          <span className="reservation-card__type">{TYPE_LABELS[r.type]}</span>
          <span className="reservation-card__time">
            {showDate ? `${formatTripDate(reservationDateKey(r.startsAt))}, ` : ''}{start}
            {spansDays && r.endsAt ? ` → ${formatTripDate(reservationDateKey(r.endsAt))}` : ''}
          </span>
          {r.provider && <span className="reservation-card__provider">{r.provider}</span>}
          {r.confirmationNumber && <span className="reservation-card__conf">#{r.confirmationNumber}</span>}
          {r.cost != null && <span className="reservation-card__cost">{formatCurrency(Number(r.cost), r.currency)}</span>}
        </div>
        {r.notes && <p className="reservation-card__notes">{r.notes}</p>}
        {r.bookingUrl && (
          <a className="reservation-card__link" href={r.bookingUrl} target="_blank" rel="noopener noreferrer">
            Open booking ↗
          </a>
        )}
      </div>
      <div className="reservation-card__controls">
        <button className="reservation-card__edit" onClick={() => onEdit(r)} aria-label="Edit booking">✎</button>
        <button className="reservation-card__delete" onClick={() => onDelete(r.id)} aria-label="Delete booking">✕</button>
      </div>
    </div>
  );
}
