import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { authEnabled, hubAccessToken, devUserQuery } from '../../../shared/auth';

const HUB_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/hubs/trip-recap`;

export type RecapStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface TripRecapGeneration {
  status: RecapStatus;
  text: string;
  error: string | null;
  generate: () => Promise<void>;
}

// F29: drives recap generation over SignalR. Opens the hub, invokes the server streaming method, and
// appends each text chunk so the narrative reveals as it's written. The server persists the finished
// recap, so the caller refetches afterwards to pick up the stored copy + its timestamp.
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
        `${HUB_URL}${authEnabled ? '' : devUserQuery()}`,
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
