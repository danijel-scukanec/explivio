import { withDevUser } from '../devUser';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F20: the current user's in-app notifications. Shape mirrors the API's NotificationsResponse.
export interface AppNotification {
  id: string;
  tripId: string;
  tripName: string;
  kind: string;
  detail: string | null;
  actorUserId: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationsFeed {
  unreadCount: number;
  items: AppNotification[];
}

export async function getNotifications(): Promise<NotificationsFeed> {
  const res = await fetch(`${API_URL}/notifications`, { headers: withDevUser() });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/${id}/read`, {
    method: 'POST',
    headers: withDevUser(),
  });
  if (!res.ok && res.status !== 404) throw new Error('Failed to mark notification read');
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/read-all`, {
    method: 'POST',
    headers: withDevUser(),
  });
  if (!res.ok) throw new Error('Failed to mark notifications read');
}
