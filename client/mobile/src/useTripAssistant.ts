import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE } from './api';
import { authEnabled, hubAccessToken } from './auth';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AssistantStatus = 'idle' | 'streaming' | 'error';

export interface TripAssistant {
  messages: ChatMessage[];
  status: AssistantStatus;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

// F16: mobile twin of the web's useTripAssistant. Streams the AI trip assistant over the same
// SignalR hub (/hubs/trip-assistant); each send ships the running transcript and accumulates the
// reply deltas into the latest assistant message. @microsoft/signalr runs in RN over the built-in
// WebSocket (same as the generation + collaboration hooks). Edits the assistant makes surface through
// the itinerary screen's collaboration refetch.
export function useTripAssistant(tripId: string): TripAssistant {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const streamingRef = useRef(false);

  const reset = useCallback(() => {
    setMessages([]);
    setStatus('idle');
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streamingRef.current) return;
      streamingRef.current = true;

      const history = [...messagesRef.current, { role: 'user', content: trimmed } as ChatMessage];
      setMessages([...history, { role: 'assistant', content: '' }]);
      setStatus('streaming');

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(
          `${API_BASE}/hubs/trip-assistant`,
          authEnabled
            ? { withCredentials: false, accessTokenFactory: () => hubAccessToken() }
            : { withCredentials: false },
        )
        .build();

      let acc = '';

      try {
        await connection.start();

        await new Promise<void>((resolve, reject) => {
          connection.stream('Chat', { tripId, messages: history }).subscribe({
            next: (chunk: string) => {
              acc += chunk;
              setMessages([...history, { role: 'assistant', content: acc }]);
            },
            complete: () => {
              setStatus('idle');
              resolve();
            },
            error: (err: unknown) => reject(err),
          });
        });
      } catch (err) {
        const message = acc || (err instanceof Error ? err.message : 'Something went wrong.');
        setMessages([...history, { role: 'assistant', content: message }]);
        setStatus('error');
      } finally {
        streamingRef.current = false;
        await connection.stop();
      }
    },
    [tripId],
  );

  return { messages, status, send, reset };
}
