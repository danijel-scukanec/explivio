// F15: dev-only user impersonation. Real auth is still deferred, so to exercise sharing and
// collaboration locally we act as different users by setting localStorage 'devUser' to a GUID (two
// browser profiles → two users). REST calls send it as the X-Dev-User header; the SignalR hub sends
// it as a ?devUser= query param, because browsers can't set custom headers on a WebSocket upgrade.
// The API's dev-identity middleware (Development only) turns it into the 'sub' claim. In production
// this does nothing — the sub comes from a real token.

export function getDevUser(): string | null {
  try {
    // A ?devUser= query param wins, so two tabs in one browser (which share localStorage) can act as
    // two different users. Falls back to localStorage for a sticky choice across navigation.
    const fromUrl = new URLSearchParams(window.location.search).get('devUser');
    return fromUrl || localStorage.getItem('devUser');
  } catch {
    return null;
  }
}

// Merge X-Dev-User into request headers when a dev user is selected.
export function withDevUser(headers: Record<string, string> = {}): Record<string, string> {
  const devUser = getDevUser();
  return devUser ? { ...headers, 'X-Dev-User': devUser } : headers;
}

// The ?devUser= suffix for a SignalR hub URL (empty string when none is selected).
export function devUserQuery(): string {
  const devUser = getDevUser();
  return devUser ? `?devUser=${encodeURIComponent(devUser)}` : '';
}
