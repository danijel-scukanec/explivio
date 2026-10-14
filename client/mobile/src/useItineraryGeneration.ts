import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  parsePartialItinerary,
  type GeneratedActivity,
  type GenerateItineraryRequest,
} from '@explivio/shared';
import { API_BASE } from './api';

export type GenerationStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface ItineraryGeneration {
  status: GenerationStatus;
  summary: string | null;
  activities: GeneratedActivity[];
  error: string | null;
  generate: (request: GenerateItineraryRequest) => Promise<void>;
  reset: () => void;
}

// F31: mobile twin of the web's useItineraryGeneration. Streams itinerary generation over the same
// SignalR hub (/hubs/itinerary-generation), invoking the server streaming method and re-parsing the
// accumulating structured-JSON text on every chunk so activity cards reveal progressively as each one
// completes — the phone gets the same card-by-card reveal as the web client instead of one blocking
// request. @microsoft/signalr runs in RN over the built-in WebSocket (same as useTripCollaboration).
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
        .withUrl(`${API_BASE}/hubs/itinerary-generation`, { withCredentials: false })
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
