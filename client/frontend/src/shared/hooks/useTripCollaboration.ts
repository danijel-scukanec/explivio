import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { devUserQuery } from '../devUser';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5298';

export interface TripCollaboration {
  presentUserIds: string[];
}

// F15 Phase B: joins the trip's live collaboration group. Tracks who else is viewing (presence) and
// calls onChange whenever a member edits the trip, so the page can refetch. In-process SignalR; the
// push is immediate (not routed through the 5s outbox). Collaboration is best-effort — if the hub is
// unreachable the page still works, it just won't update live. Lives in shared/ because both the
// itinerary and budget pages use it.
export function useTripCollaboration(
  tripId: string | undefined,
  onChange: () => void,
): TripCollaboration {
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);

  // Keep the latest onChange without re-opening the connection on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!tripId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/trip-collaboration${devUserQuery()}`, { withCredentials: false })
      .withAutomaticReconnect()
      .build();

    connection.on('PresenceChanged', (payload: { tripId: string; userIds: string[] }) => {
      if (payload.tripId === tripId) setPresentUserIds(payload.userIds);
    });

    connection.on('TripChanged', (payload: { tripId: string }) => {
      if (payload.tripId === tripId) onChangeRef.current();
    });

    // Group membership is per-connection, so rejoin after an automatic reconnect.
    connection.onreconnected(() => {
      connection.invoke('JoinTrip', tripId).catch(() => {});
    });

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
