import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import type { GeneratedActivity, GenerateItineraryRequest } from '@explivio/shared';
import { parsePartialItinerary } from '../utils/streamingItinerary';

const HUB_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/hubs/itinerary-generation`;

export type GenerationStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface ItineraryGeneration {
  status: GenerationStatus;
  summary: string | null;
  activities: GeneratedActivity[];
  error: string | null;
  generate: (request: GenerateItineraryRequest) => Promise<void>;
  reset: () => void;
}

// F13: drives streaming itinerary generation over SignalR. Opens a hub connection, invokes the
// server streaming method, and re-parses the accumulating structured-JSON text on every chunk so
// activity cards can be revealed progressively as each one completes.
export function useItineraryGeneration(tripId: string): ItineraryGeneration {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [summary, setSummary] = useState<string | null>(null);
  const [activities, setActivities] = useState<GeneratedActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setSummary(null);
    setActivities([]);
    setError(null);
  }, []);

  const generate = useCallback(
    async (request: GenerateItineraryRequest) => {
      setStatus('streaming');
      setSummary(null);
      setActivities([]);
      setError(null);

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { withCredentials: false })
        .build();
      connectionRef.current = connection;

      let buffer = '';

      try {
        await connection.start();

        await new Promise<void>((resolve, reject) => {
          connection.stream('Generate', { ...request, tripId }).subscribe({
            next: (chunk: string) => {
              buffer += chunk;
              const parsed = parsePartialItinerary(buffer);
              setSummary(parsed.summary);
              setActivities(parsed.activities);
            },
            complete: () => {
              // Final parse in case the last object completed on the closing chunk.
              const parsed = parsePartialItinerary(buffer);
              setSummary(parsed.summary);
              setActivities(parsed.activities);
              setStatus('done');
              resolve();
            },
            error: (err: unknown) => reject(err),
          });
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed.');
        setStatus('error');
      } finally {
        await connection.stop();
        connectionRef.current = null;
      }
    },
    [tripId],
  );

  return { status, summary, activities, error, generate, reset };
}
