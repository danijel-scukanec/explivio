import type { Activity } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { ActivityItem } from './ActivityItem';
import './DaySchedule.css';

interface Props {
  date: string;
  dayNumber: number;
  activities: Activity[];
  onDelete: (id: string) => void;
}

export function DaySchedule({ date, dayNumber, activities, onDelete }: Props) {
  return (
    <div className="day-schedule">
      <div className="day-schedule__header">
        <span className="day-schedule__day">Day {dayNumber}</span>
        <span className="day-schedule__date">{formatTripDate(date)}</span>
      </div>
      <div className="day-schedule__activities">
        {activities.length === 0
          ? <p className="day-schedule__empty">No activities planned</p>
          : activities.map(a => <ActivityItem key={a.id} activity={a} onDelete={onDelete} />)
        }
      </div>
    </div>
  );
}
