import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE } from './api';
import { authEnabled, hubAccessToken } from './auth';

// F15 / F31: mobile twin of the web's useTripCollaboration. Joins the trip's live group, tracks who
// else is viewing (presence), and calls onChange when a member edits the trip so the screen refetches.
// In-process SignalR over the same hub as the web client. Best-effort — if the hub is unreachable the
// screen still works, it just won't update live.
export function useTripCollaboration(tripId: string | undefined, onChange: () => void): { presentUserIds: string[] } {
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!tripId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${API_BASE}/hubs/trip-collaboration`,
        authEnabled
          ? { withCredentials: false, accessTokenFactory: () => hubAccessToken() }
          : { withCredentials: false },
      )
      .withAutomaticReconnect()
      .build();

    connection.on('PresenceChanged', (payload: { tripId: string; userIds: string[] }) => {
      if (payload.tripId === tripId) setPresentUserIds(payload.userIds);
    });
    connection.on('TripChanged', (payload: { tripId: string }) => {
      if (payload.tripId === tripId) onChangeRef.current();
    });
    connection.onreconnected(() => { connection.invoke('JoinTrip', tripId).catch(() => {}); });

    connection
      .start()
      .then(() => connection.invoke('JoinTrip', tripId))
      .catch(() => {});

    return () => {
      setPresentUserIds([]);
      connection.stop().catch(() => {});
    };
  }, [tripId]);

  return { presentUserIds };
}
