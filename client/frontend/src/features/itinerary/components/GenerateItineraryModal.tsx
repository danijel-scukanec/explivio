import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateActivityRequest, GeneratedActivity } from '@explivio/shared';
import { createActivity } from '../services/itineraryApi';
import { useItineraryGeneration } from '../hooks/useItineraryGeneration';
import { Modal, ModalBody } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  tripId: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onAdded: () => void;
}

// F13: AI itinerary generation with a live, streaming reveal. The form kicks off a SignalR stream;
// activity cards appear one-by-one as the model produces them; "Add all" persists them via the
// existing CreateActivity endpoint (the accept step F12 left as a draft).
export function GenerateItineraryModal({ tripId, startDate, endDate, onClose, onAdded }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ prompt: '', days: 3, style: '', budget: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { status, summary, activities, error, generate } = useItineraryGeneration(tripId);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'days' ? Number(value) : value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await generate({
      tripId,
      prompt: form.prompt,
      days: form.days,
      style: form.style || null,
      budget: form.budget || null,
    });
  }

  async function handleAddAll() {
    setAdding(true);
    setAddError(null);
    try {
      // Sequential keeps the outbox/read-model events in a sensible order and avoids hammering the API.
      for (const activity of activities) {
        await createActivity(tripId, toCreateRequest(activity, tripId, startDate, endDate));
      }
      onAdded();
    } catch {
      setAddError(t('generate.couldNotAddAll'));
    } finally {
      setAdding(false);
    }
  }

  const isStreaming = status === 'streaming';
  const isDone = status === 'done';

  return (
    <Modal title={t('generate.title')} onClose={onClose} className="max-w-[640px]">
      <ModalBody>
        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <Field label={t('generate.whatKind')}>
            <Textarea
              name="prompt"
              value={form.prompt}
              onChange={handleChange}
              required
              rows={2}
              placeholder={t('generate.promptPlaceholder')}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('generate.days')}>
              <Input type="number" name="days" min={1} max={14} value={form.days} onChange={handleChange} required />
            </Field>
            <Field label={t('generate.style')}>
              <Input name="style" value={form.style} onChange={handleChange} placeholder={t('generate.stylePlaceholder')} />
            </Field>
            <Field label={t('generate.budget')}>
              <Input name="budget" value={form.budget} onChange={handleChange} placeholder={t('generate.budgetPlaceholder')} />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isStreaming}>
              {isStreaming ? t('generate.generating') : isDone ? t('generate.regenerate') : t('generate.generate')}
            </Button>
          </div>
        </form>

        {(isStreaming || isDone) && (
          <div className="mt-2 border-t pt-4">
            {summary && <p className="text-muted-foreground mb-4 text-[0.95rem]">{summary}</p>}

            <div className="flex max-h-[45vh] flex-col gap-2.5 overflow-y-auto">
              {activities.map((a, i) => (
                <div className="bg-muted/50 animate-in fade-in slide-in-from-bottom-1 rounded-[10px] border p-3" key={`${a.day}-${a.name}-${i}`}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="text-foreground font-semibold">{t('generate.day', { number: a.day })}</span>
                    {a.suggestedStartTime && <span className="text-muted-foreground">{a.suggestedStartTime}</span>}
                    <span className="border-primary/40 bg-primary/10 text-primary ml-auto rounded-full border px-2 py-0.5 text-[0.7rem]">{t(`enums.activityCategory.${a.category}`)}</span>
                  </div>
                  <h4 className="text-foreground mb-0.5 text-[0.95rem] font-semibold">{a.name}</h4>
                  <p className="text-muted-foreground text-[0.85rem] leading-snug">{a.description}</p>
                </div>
              ))}
              {isStreaming && <div className="bg-muted/50 h-18 animate-pulse rounded-[10px] border border-dashed" aria-hidden="true" />}
            </div>

            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
            {addError && <p className="text-destructive mt-2 text-sm">{addError}</p>}

            {isDone && activities.length > 0 && (
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button type="button" onClick={handleAddAll} disabled={adding}>
                  {adding ? t('generate.adding') : t('generate.addAll', { count: activities.length })}
                </Button>
              </div>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

function toCreateRequest(
  activity: GeneratedActivity,
  tripId: string,
  startDate: string,
  endDate: string,
): CreateActivityRequest {
  return {
    tripId,
    name: activity.name,
    date: dateForDay(startDate, endDate, Number(activity.day)),
    startTime: activity.suggestedStartTime ? `${activity.suggestedStartTime}:00` : null,
    endTime: null,
    location: null,
    description: activity.description,
    category: activity.category,
    latitude: null,
    longitude: null,
  };
}

// Map a 1-based day number to a real date within the trip, clamped to the trip's range.
function dateForDay(startDate: string, endDate: string, day: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + Math.max(0, day - 1));
  const iso = start.toISOString().split('T')[0];
  return iso > endDate ? endDate : iso;
}
