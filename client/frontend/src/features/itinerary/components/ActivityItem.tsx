import { useTranslation } from 'react-i18next';
import type { Activity } from '@explivio/shared';
import { formatActivityTime } from '@explivio/shared';
import { cn } from '@/lib/utils';

interface Props {
  activity: Activity;
  onDelete: (id: string) => void;
  onEdit: (activity: Activity) => void;
  // Derived route-stop label + its color (non-destructive — shows which place the activity is in).
  stopLabel?: string | null;
  stopColor?: string;
  // Briefly ringed when its stop is picked from the route sidebar.
  highlighted?: boolean;
  // Offered when the activity is located but not on the route — one click adds its city as a stop.
  onAddStop?: () => void;
  addingStop?: boolean;
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
  activity, onDelete, onEdit, stopLabel, stopColor, highlighted, onAddStop, addingStop,
  draggable, dragging, dragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: Props) {
  const { t } = useTranslation();
  const start = formatActivityTime(activity.startTime);
  const end = formatActivityTime(activity.endTime);
  // Located but unmatched to any route stop → offer to add it.
  const offRoute = !stopLabel && activity.latitude != null && activity.longitude != null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(activity)}
      onKeyDown={e => { if (e.key === 'Enter') onEdit(activity); }}
      className={cn(
        '-mx-2 flex cursor-pointer items-start gap-3 rounded-md border-b px-2 py-3 transition-colors last:border-b-0',
        'hover:bg-muted/50',
        dragging && 'opacity-50',
        dragOver && 'border-t-primary border-t-2',
        highlighted && 'ring-primary bg-primary/5 ring-2',
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={t('activity.edit')}
    >
      {draggable && (
        <span
          className="text-muted-foreground shrink-0 cursor-grab pt-0.5 text-base select-none"
          aria-hidden="true"
          title={t('activity.dragToReorder')}
          onClick={e => e.stopPropagation()}
        >⠿</span>
      )}
      <div className="text-muted-foreground w-[90px] shrink-0 pt-0.5 text-[13px]">
        {start ? <span>{start}{end ? ` – ${end}` : ''}</span> : <span className="text-border">{t('itinerary.noTime')}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-base">{CATEGORY_ICONS[activity.category] ?? '📌'}</span>
          <span className="text-card-foreground text-[15px] font-medium">{activity.name}</span>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">{t(`enums.activityCategory.${activity.category}`)}</span>
          {stopLabel && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${stopColor ?? '#888'}1a`, color: stopColor ?? '#888' }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: stopColor ?? '#888' }} />
              {stopLabel}
            </span>
          )}
          {offRoute && onAddStop && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); if (!addingStop) onAddStop(); }}
              disabled={addingStop}
              title={t('itinerary.addStopHint')}
              className="border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium disabled:opacity-60"
            >
              {addingStop ? t('itinerary.addingStop') : `＋ ${t('itinerary.addStop')}`}
            </button>
          )}
        </div>
        {activity.location && <p className="text-muted-foreground mt-0.5 text-[13px]">📍 {activity.location}</p>}
        {activity.description && <p className="text-muted-foreground mt-0.5 text-[13px]">{activity.description}</p>}
      </div>
      <button
        type="button"
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded px-1.5 py-0.5 text-[13px]"
        onClick={e => { e.stopPropagation(); onDelete(activity.id); }}
        aria-label={t('activity.delete')}
      >✕</button>
    </div>
  );
}
