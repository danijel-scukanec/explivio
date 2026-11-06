import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity, Reservation } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { ActivityItem } from './ActivityItem';
import { ReservationCard } from '../../reservations/components/ReservationCard';

interface StopInfo { name: string; color: string }

interface Props {
  id?: string;
  date: string;
  dayNumber: number;
  activities: Activity[];
  onDelete: (id: string) => void;
  onEdit: (activity: Activity) => void;
  // Derived route-stop for an activity (place label + color), and which stop is currently highlighted
  // from the route sidebar. Both optional — the itinerary supplies them, nothing else does.
  stopFor?: (activity: Activity) => StopInfo | null;
  highlightStopName?: string | null;
  // Add an off-route activity's city to the route (one per activity); addingStopId marks the busy one.
  onAddStop?: (activity: Activity) => void;
  addingStopId?: string | null;
  // Add a new activity to this specific day (pre-fills the day's date).
  onAddActivity?: (date: string) => void;
  // F23: persist the new order of this day's activities (by id). Omitted when dragging is disabled
  // (e.g. a category filter is active).
  onReorder?: (date: string, orderedActivityIds: string[]) => void;
  // F23: bookings that start on this day, surfaced alongside the activities (but not drag-reordered).
  reservations?: Reservation[];
  onEditReservation?: (reservation: Reservation) => void;
  onDeleteReservation?: (id: string) => void;
}

export function DaySchedule({
  id, date, dayNumber, activities, onDelete, onEdit, stopFor, highlightStopName, onAddStop, addingStopId, onAddActivity, onReorder,
  reservations = [], onEditReservation, onDeleteReservation,
}: Props) {
  const { t } = useTranslation();
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

  // The day header names the city/cities it touches (in first-seen order) — the route↔day connection.
  const cities: string[] = [];
  if (stopFor) {
    for (const a of activities) {
      const s = stopFor(a);
      if (s && !cities.includes(s.name)) cities.push(s.name);
    }
  }

  return (
    <div id={id} className="overflow-hidden rounded-[10px] border">
      <div className="bg-muted flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3">
        <span className="text-foreground text-[15px] font-semibold">{t('itinerary.day', { number: dayNumber })}</span>
        <span className="text-muted-foreground text-sm">{formatTripDate(date)}</span>
        {cities.length > 0 && (
          <span className="text-primary text-sm font-medium">· {cities.join(' → ')}</span>
        )}
      </div>
      {reservations.length > 0 && onEditReservation && onDeleteReservation && (
        <div className="flex flex-col gap-2 border-b px-5 py-3">
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
      <div className="px-5 py-1">
        {activities.map((a, i) => {
          const s = stopFor?.(a) ?? null;
          return (
            <ActivityItem
              key={a.id}
              activity={a}
              onDelete={onDelete}
              onEdit={onEdit}
              stopLabel={s?.name}
              stopColor={s?.color}
              highlighted={!!highlightStopName && s?.name === highlightStopName}
              onAddStop={onAddStop ? () => onAddStop(a) : undefined}
              addingStop={addingStopId === a.id}
              draggable={!!onReorder}
              dragging={dragIndex === i}
              dragOver={overIndex === i && dragIndex !== i}
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => { e.preventDefault(); setOverIndex(i); }}
              onDrop={handleDrop}
              onDragEnd={reset}
            />
          );
        })}

        {onAddActivity ? (
          activities.length === 0 ? (
            // Empty day → the add action *is* the content (replaces a dead "No activities planned").
            <button
              type="button"
              onClick={() => onAddActivity(date)}
              className="text-muted-foreground hover:border-primary hover:text-primary my-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-3 text-sm transition-colors"
            >
              {t('itinerary.addActivity')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAddActivity(date)}
              className="text-muted-foreground hover:text-primary flex w-full items-center gap-1.5 py-2.5 text-sm transition-colors"
            >
              {t('itinerary.addActivity')}
            </button>
          )
        ) : (
          activities.length === 0 && reservations.length === 0 && (
            <p className="text-muted-foreground py-3 text-sm">{t('itinerary.noActivities')}</p>
          )
        )}
      </div>
    </div>
  );
}
