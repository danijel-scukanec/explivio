import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, Copy } from 'lucide-react';
import { formatTripDate, type GalleryItem } from '@explivio/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A stable gradient per trip, derived from its id — stands in for a cover photo (the cover endpoint is
// member-gated, so public viewers can't load it).
function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h = hash % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}

interface Props {
  item: GalleryItem;
  cloning: boolean;
  onToggleLike: (item: GalleryItem) => void;
  onToggleFollow: (item: GalleryItem) => void;
  onClone: (item: GalleryItem) => void;
}

// F26: one public-trip card, shared by the gallery feeds and a user's profile. Shows who made the trip
// (linking to their profile) with a Follow/Following button, plus like + clone.
export function GalleryCard({ item, cloning, onToggleLike, onToggleFollow, onClone }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Link
        to={`/gallery/${item.tripId}`}
        className="flex h-28 items-end p-3.5"
        style={{ background: gradientFor(item.tripId) }}
      >
        <span className="text-[17px] leading-tight font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.35)]">
          {item.name}
        </span>
      </Link>

      <div className="flex flex-col gap-1.5 p-3.5">
        <span className="text-card-foreground text-sm font-semibold">{item.destination}</span>
        <span className="text-muted-foreground text-[13px]">
          {formatTripDate(item.startDate)} – {formatTripDate(item.endDate)}
        </span>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <Link
            to={`/users/${item.ownerUserId}`}
            className="text-muted-foreground hover:text-primary min-w-0 truncate text-[13px] hover:underline"
          >
            {t('gallery.by', { name: item.ownerDisplayName || t('gallery.someone') })}
          </Link>
          {!item.isMine && (
            <Button
              type="button"
              variant={item.followedByMe ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 shrink-0 rounded-full px-3 text-xs"
              onClick={() => onToggleFollow(item)}
              aria-pressed={item.followedByMe}
            >
              {item.followedByMe ? t('social.following') : t('social.follow')}
            </Button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onToggleLike(item)}
            aria-pressed={item.likedByMe}
            className={cn(
              'hover:border-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm tabular-nums transition-colors',
              item.likedByMe ? 'border-rose-400 text-rose-500' : 'text-card-foreground',
            )}
          >
            <Heart className={cn('size-4', item.likedByMe && 'fill-current')} />
            {item.likeCount}
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onClone(item)} disabled={cloning}>
            <Copy />
            {cloning ? t('gallery.cloning') : t('gallery.clone')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
