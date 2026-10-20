import { useState } from 'react';
import type { Activity, Reservation } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { ActivityItem } from './ActivityItem';
import { ReservationCard } from '../../reservations/components/ReservationCard';
import './DaySchedule.css';

interface Props {
  date: string;
  dayNumber: number;
  activities: Activity[];
  onDelete: (id: string) => void;
  onEdit: (activity: Activity) => void;
  // F23: persist the new order of this day's activities (by id). Omitted when dragging is disabled
  // (e.g. a category filter is active).
  onReorder?: (date: string, orderedActivityIds: string[]) => void;
  // F23: bookings that start on this day, surfaced alongside the activities (but not drag-reordered).
  reservations?: Reservation[];
  onEditReservation?: (reservation: Reservation) => void;
  onDeleteReservation?: (id: string) => void;
}

export function DaySchedule({
  date, dayNumber, activities, onDelete, onEdit, onReorder,
  reservations = [], onEditReservation, onDeleteReservation,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function reset() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDrop() {
    if (onReorder && dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const reordered = [...activities];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(overIndex, 0, moved);
      onReorder(date, reordered.map(a => a.id));
    }
    reset();
  }

  return (
    <div className="day-schedule">
      <div className="day-schedule__header">
        <span className="day-schedule__day">Day {dayNumber}</span>
        <span className="day-schedule__date">{formatTripDate(date)}</span>
      </div>
      {reservations.length > 0 && onEditReservation && onDeleteReservation && (
        <div className="day-schedule__bookings">
          {reservations.map(r => (
            <ReservationCard
              key={r.id}
              reservation={r}
              showDate={false}
              onEdit={onEditReservation}
              onDelete={onDeleteReservation}
            />
          ))}
        </div>
      )}
      <div className="day-schedule__activities">
        {activities.length === 0 && reservations.length === 0
          ? <p className="day-schedule__empty">No activities planned</p>
          : activities.map((a, i) => (
              <ActivityItem
                key={a.id}
                activity={a}
                onDelete={onDelete}
                onEdit={onEdit}
                draggable={!!onReorder}
                dragging={dragIndex === i}
                dragOver={overIndex === i && dragIndex !== i}
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => { e.preventDefault(); setOverIndex(i); }}
                onDrop={handleDrop}
                onDragEnd={reset}
              />
            ))
        }
      </div>
    </div>
  );
}
