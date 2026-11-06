import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTripAssistant } from '../hooks/useTripAssistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// F16: a floating, collapsible chat panel for the AI trip assistant. Self-contained — it owns its
// open/close state and the conversation, so the itinerary page only has to mount it. Edits the
// assistant makes land through the page's existing collaboration refetch, so no wiring is needed here.
export function TripAssistantPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, status, send } = useTripAssistant(tripId);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as it streams.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput('');
    await send(text);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="bg-primary fixed right-5 bottom-5 z-[900] size-14 rounded-full text-2xl text-white shadow-lg"
        onClick={() => setOpen(true)}
        aria-label={t('assistant.title')}
      >
        💬
      </button>
    );
  }

  const streaming = status === 'streaming';

  return (
    <section
      className="bg-background fixed right-5 bottom-5 z-[900] flex h-[min(540px,calc(100vh-100px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border shadow-xl"
      aria-label={t('assistant.title')}
    >
      <header className="bg-primary text-primary-foreground flex items-center justify-between px-3.5 py-3 font-bold">
        <span>💬 {t('assistant.title')}</span>
        <button type="button" className="text-base" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          ✕
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" ref={listRef}>
        {messages.length === 0 && <p className="text-muted-foreground my-auto text-center text-sm">{t('assistant.empty')}</p>}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-primary text-primary-foreground self-end rounded-br-sm'
                : 'bg-muted text-foreground self-start rounded-bl-sm border',
            )}
          >
            {m.content || (streaming && i === messages.length - 1 ? t('assistant.thinking') : '')}
          </div>
        ))}
      </div>

      <form className="flex gap-2 border-t p-2.5" onSubmit={onSubmit}>
        <Input
          type="text"
          className="flex-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('assistant.placeholder')}
          disabled={streaming}
        />
        <Button type="submit" disabled={streaming || input.trim().length === 0}>
          {t('assistant.send')}
        </Button>
      </form>
    </section>
  );
}
