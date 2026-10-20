import { useTranslation } from 'react-i18next';
import type { Activity } from '@explivio/shared';
import { formatActivityTime } from '@explivio/shared';
import './ActivityItem.css';

interface Props {
  activity: Activity;
  onDelete: (id: string) => void;
  onEdit: (activity: Activity) => void;
  // F23: drag-to-reorder. Wired by DaySchedule, which owns the drag state; omitted when a category
  // filter is active (reordering a partial list would be ambiguous).
  draggable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Sightseeing: '🏛',
  Food: '🍽',
  Transport: '🚌',
  Accommodation: '🏨',
  Adventure: '🧗',
  Other: '📌',
};

export function ActivityItem({
  activity, onDelete, onEdit,
  draggable, dragging, dragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: Props) {
  const { t } = useTranslation();
  const start = formatActivityTime(activity.startTime);
  const end = formatActivityTime(activity.endTime);

  const className = [
    'activity-item',
    dragging ? 'activity-item--dragging' : '',
    dragOver ? 'activity-item--drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <span className="activity-item__grip" aria-hidden="true" title={t('activity.dragToReorder')}>⠿</span>
      )}
      <div className="activity-item__time">
        {start ? <span>{start}{end ? ` – ${end}` : ''}</span> : <span className="activity-item__no-time">{t('itinerary.noTime')}</span>}
      </div>
      <div className="activity-item__body">
        <div className="activity-item__header">
          <span className="activity-item__icon">{CATEGORY_ICONS[activity.category] ?? '📌'}</span>
          <span className="activity-item__name">{activity.name}</span>
          <span className="activity-item__category">{t(`enums.activityCategory.${activity.category}`)}</span>
        </div>
        {activity.location && <p className="activity-item__location">📍 {activity.location}</p>}
        {activity.description && <p className="activity-item__description">{activity.description}</p>}
      </div>
      <div className="activity-item__controls">
        <button className="activity-item__edit" onClick={() => onEdit(activity)} aria-label={t('activity.edit')}>✎</button>
        <button className="activity-item__delete" onClick={() => onDelete(activity.id)} aria-label={t('activity.delete')}>✕</button>
      </div>
    </div>
  );
}
