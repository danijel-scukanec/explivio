import type { Activity } from '@explivio/shared';
import { formatActivityTime } from '@explivio/shared';
import './ActivityItem.css';

interface Props {
  activity: Activity;
  onDelete: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Sightseeing: '🏛',
  Food: '🍽',
  Transport: '🚌',
  Accommodation: '🏨',
  Adventure: '🧗',
  Other: '📌',
};

export function ActivityItem({ activity, onDelete }: Props) {
  const start = formatActivityTime(activity.startTime);
  const end = formatActivityTime(activity.endTime);

  return (
    <div className="activity-item">
      <div className="activity-item__time">
        {start ? <span>{start}{end ? ` – ${end}` : ''}</span> : <span className="activity-item__no-time">No time</span>}
      </div>
      <div className="activity-item__body">
        <div className="activity-item__header">
          <span className="activity-item__icon">{CATEGORY_ICONS[activity.category] ?? '📌'}</span>
          <span className="activity-item__name">{activity.name}</span>
          <span className="activity-item__category">{activity.category}</span>
        </div>
        {activity.location && <p className="activity-item__location">📍 {activity.location}</p>}
        {activity.description && <p className="activity-item__description">{activity.description}</p>}
      </div>
      <button className="activity-item__delete" onClick={() => onDelete(activity.id)} aria-label="Delete activity">✕</button>
    </div>
  );
}
