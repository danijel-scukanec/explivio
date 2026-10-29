import { useCallback, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { authEnabled, hubAccessToken, devUserQuery } from '../../../shared/auth';

const HUB_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/hubs/trip-assistant`;

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

// F16: drives the AI trip assistant over SignalR. Each send opens a hub connection, streams the
// running transcript to the Chat method, and accumulates the reply deltas into the latest assistant
// message. The transcript lives client-side (the hub is stateless) and is sent in full each turn.
// Edits the assistant makes server-side surface through the page's existing collaboration refetch.
export function useTripAssistant(tripId: string): TripAssistant {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus>('idle');
  // Mirror of `messages` so `send` reads the latest transcript without being re-created each render.
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
          `${HUB_URL}${authEnabled ? '' : devUserQuery()}`,
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
