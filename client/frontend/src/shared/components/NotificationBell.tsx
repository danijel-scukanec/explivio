import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type AppNotification, type NotificationsFeed,
} from '../services/notificationsApi';
import './NotificationBell.css';

const KIND_ICON: Record<string, string> = {
  ActivityAdded: '🗺️',
  ActivityRemoved: '🗺️',
  ExpenseAdded: '💰',
  ExpenseRemoved: '💰',
  StatusChanged: '🔖',
};

// F20: the in-app notification bell. Polls the unread count on an interval for the badge and refreshes
// the list when opened. Clicking a notification marks it read and jumps to its trip. Notifications
// only appear for trips shared with others (a solo trip never notifies its sole member), so on a
// single-user setup the bell stays empty — that's expected.
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<NotificationsFeed>({ unreadCount: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    navigate(`/trips/${n.tripId}/itinerary`);
  }

  async function markAll() {
    await markAllNotificationsRead();
    refresh();
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="notif__bell btn btn--ghost"
        onClick={toggle}
        aria-label={t('notifications.title')}
      >
        🔔
        {feed.unreadCount > 0 && (
          <span className="notif__badge">{feed.unreadCount > 9 ? '9+' : feed.unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif__panel">
          <div className="notif__head">
            <strong>{t('notifications.title')}</strong>
            {feed.items.some(n => !n.isRead) && (
              <button className="notif__markall" onClick={markAll}>{t('notifications.markAllRead')}</button>
            )}
          </div>

          {feed.items.length === 0 ? (
            <p className="notif__empty">{t('notifications.empty')}</p>
          ) : (
            <ul className="notif__list">
              {feed.items.map(n => (
                <li key={n.id}>
                  <button
                    className={`notif__item${n.isRead ? '' : ' notif__item--unread'}`}
                    onClick={() => openItem(n)}
                  >
                    <span className="notif__icon">{KIND_ICON[n.kind] ?? '🔔'}</span>
                    <span className="notif__text">
                      <span className="notif__title">{n.tripName}</span>
                      <span className="notif__detail">
                        {t(`notifications.kind.${n.kind}`, { defaultValue: n.kind })}
                        {n.detail ? ` · ${n.detail}` : ''}
                      </span>
                      <span className="notif__time">{relativeTime(n.createdAt, i18n.language)}</span>
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
