import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type AppNotification, type NotificationsFeed,
} from '../services/notificationsApi';
import { useFeatures, isFeatureOn } from '../hooks/useFeatures';
import {
  isWebPushSupported, getWebPushState, enableWebPush, disableWebPush, type WebPushState,
} from '../push/webPush';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<string, string> = {
  ActivityAdded: '🗺️',
  ActivityRemoved: '🗺️',
  ExpenseAdded: '💰',
  ExpenseRemoved: '💰',
  StatusChanged: '🔖',
  TripPublished: '🌍',
};

// F26 (follow): a "published" notification targets a follower, who isn't a trip member, so it opens the
// public gallery view rather than the member-only itinerary.
function routeFor(n: AppNotification): string {
  return n.kind === 'TripPublished' ? `/gallery/${n.tripId}` : `/trips/${n.tripId}/itinerary`;
}

// F20: the in-app notification bell. Polls the unread count on an interval for the badge and refreshes
// the list when opened. Clicking a notification marks it read and jumps to its trip. Notifications
// only appear for trips shared with others (a solo trip never notifies its sole member), so on a
// single-user setup the bell stays empty — that's expected.
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const features = useFeatures();
  const [feed, setFeed] = useState<NotificationsFeed>({ unreadCount: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // F20 (web push): the opt-in button's state. Only meaningful when the feature is on and the browser
  // supports Web Push; otherwise the button is hidden.
  const pushEnabled = isFeatureOn(features, 'PushNotifications') && isWebPushSupported();
  const [pushState, setPushState] = useState<WebPushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setFeed(await getNotifications());
    } catch { /* offline or not signed in — leave the bell as-is */ }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Close the panel on an outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Load the web-push state when the panel first opens (and the feature is available).
  useEffect(() => {
    if (open && pushEnabled && pushState === null) {
      getWebPushState().then(setPushState).catch(() => { /* ignore */ });
    }
  }, [open, pushEnabled, pushState]);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const next = pushState?.subscribed ? await disableWebPush() : await enableWebPush();
      setPushState(next);
    } catch { /* leave the current state; the button stays actionable */ }
    finally { setPushBusy(false); }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) refresh();
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.isRead) {
      await markNotificationRead(n.id);
      refresh();
    }
    navigate(routeFor(n));
  }

  async function markAll() {
    await markAllNotificationsRead();
    refresh();
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-lg"
        onClick={toggle}
        aria-label={t('notifications.title')}
      >
        🔔
        {feed.unreadCount > 0 && (
          <span className="bg-destructive absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-lg px-1 text-[10px] font-bold text-white">
            {feed.unreadCount > 9 ? '9+' : feed.unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="bg-popover absolute top-[calc(100%+8px)] right-0 z-50 max-h-[420px] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border shadow-lg">
          <div className="bg-popover sticky top-0 flex items-center justify-between border-b px-3.5 py-2.5">
            <strong className="text-popover-foreground text-sm">{t('notifications.title')}</strong>
            {feed.items.some(n => !n.isRead) && (
              <button className="text-primary text-xs" onClick={markAll}>{t('notifications.markAllRead')}</button>
            )}
          </div>

          {pushEnabled && pushState && (
            <div className="bg-popover border-b px-3.5 py-2">
              {pushState.permission === 'denied' && !pushState.subscribed ? (
                <span className="text-muted-foreground block text-center text-[11px]">{t('notifications.pushBlocked')}</span>
              ) : (
                <button
                  className="border-primary text-primary hover:bg-accent w-full rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                  onClick={togglePush}
                  disabled={pushBusy}
                >
                  {pushState.subscribed ? t('notifications.disablePush') : t('notifications.enablePush')}
                </button>
              )}
            </div>
          )}

          {feed.items.length === 0 ? (
            <p className="text-muted-foreground px-3.5 py-6 text-center text-[13px]">{t('notifications.empty')}</p>
          ) : (
            <ul>
              {feed.items.map(n => (
                <li key={n.id}>
                  <button
                    className={cn(
                      'hover:bg-accent flex w-full gap-2.5 border-b px-3.5 py-2.5 text-left',
                      !n.isRead && 'bg-primary/5',
                    )}
                    onClick={() => openItem(n)}
                  >
                    <span className="shrink-0 text-lg">{KIND_ICON[n.kind] ?? '🔔'}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-popover-foreground text-[13px] font-semibold">{n.tripName}</span>
                      <span className="text-muted-foreground text-xs">
                        {t(`notifications.kind.${n.kind}`, { defaultValue: n.kind })}
                        {n.detail ? ` · ${n.detail}` : ''}
                      </span>
                      <span className="text-muted-foreground text-[11px]">{relativeTime(n.createdAt, i18n.language)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string, locale: string): string {
  // The server stores UTC but SQL round-trips it without a zone designator, so treat a zone-less
  // timestamp as UTC rather than letting the browser read it as local time (which skews "x ago").
  const utc = /[Zz]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const diffMs = Date.now() - new Date(utc).getTime();
  const mins = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}
