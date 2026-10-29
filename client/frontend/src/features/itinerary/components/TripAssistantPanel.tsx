import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTripAssistant } from '../hooks/useTripAssistant';
import './TripAssistantPanel.css';

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
        className="assistant-fab"
        onClick={() => setOpen(true)}
        aria-label={t('assistant.title')}
      >
        💬
      </button>
    );
  }

  const streaming = status === 'streaming';

  return (
    <section className="assistant-panel" aria-label={t('assistant.title')}>
      <header className="assistant-panel__head">
        <span>💬 {t('assistant.title')}</span>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          ✕
        </button>
      </header>

      <div className="assistant-panel__messages" ref={listRef}>
        {messages.length === 0 && <p className="assistant-panel__empty">{t('assistant.empty')}</p>}
        {messages.map((m, i) => (
          <div key={i} className={`assistant-msg assistant-msg--${m.role}`}>
            {m.content || (streaming && i === messages.length - 1 ? t('assistant.thinking') : '')}
          </div>
        ))}
      </div>

      <form className="assistant-panel__input" onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('assistant.placeholder')}
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || input.trim().length === 0}>
          {t('assistant.send')}
        </button>
      </form>
    </section>
  );
}
