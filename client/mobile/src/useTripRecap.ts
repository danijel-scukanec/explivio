import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE } from './api';
import { authEnabled, hubAccessToken } from './auth';

export type RecapStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface TripRecapGeneration {
  status: RecapStatus;
  text: string;
  error: string | null;
  generate: () => Promise<void>;
}

// F29: mobile twin of the web's useTripRecap. Streams the recap narrative over the same SignalR hub
// (/hubs/trip-recap), appending each text chunk so the story reveals as it's written. The server
// persists the finished recap, so the caller refetches afterwards for the stored copy + its timestamp.
export function useTripRecap(tripId: string): TripRecapGeneration {
  const [status, setStatus] = useState<RecapStatus>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const generate = useCallback(async () => {
    setStatus('streaming');
    setText('');
    setError(null);

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(
        `${API_BASE}/hubs/trip-recap`,
        authEnabled
          ? { withCredentials: false, accessTokenFactory: () => hubAccessToken() }
          : { withCredentials: false },
      )
      .build();
    connectionRef.current = connection;

    try {
      await connection.start();
      await new Promise<void>((resolve, reject) => {
        connection.stream('Generate', tripId).subscribe({
          next: (chunk: string) => setText((prev) => prev + chunk),
          complete: () => {
            setStatus('done');
            resolve();
          },
          error: (err: unknown) => reject(err),
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recap generation failed.');
      setStatus('error');
    } finally {
      await connection.stop();
      connectionRef.current = null;
    }
  }, [tripId]);

  return { status, text, error, generate };
}
