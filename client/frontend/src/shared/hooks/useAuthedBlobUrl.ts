import { useEffect, useState } from 'react';
import { authHeaders } from '../auth';

// P-Auth: loads an authenticated binary resource (e.g. a trip cover streamed behind trip authorization)
// as an object URL, attaching the auth header via fetch — because an <img>/<a> can't send an
// Authorization header. Works in both dev-identity and real-auth modes (authHeaders handles each).
// Returns null while loading, on error, or when `url` is null (so callers can skip rendering). `dep`
// forces a re-fetch when it changes (e.g. a cover-version bump after re-upload).
export function useAuthedBlobUrl(url: string | null, dep?: unknown): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }
    let active = true;
    let created: string | null = null;

    (async () => {
      try {
        const res = await fetch(url, { headers: await authHeaders() });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const blob = await res.blob();
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      } catch {
        if (active) setObjectUrl(null);
      }
    })();

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, dep]);

  return objectUrl;
}
