import { useState } from 'react';
import type { CreateActivityRequest, GeneratedActivity } from '@explivio/shared';
import { createActivity } from '../services/itineraryApi';
import { useItineraryGeneration } from '../hooks/useItineraryGeneration';
import '../../trips/components/CreateTripModal.css';
import './GenerateItineraryModal.css';

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
      setAddError('Could not add all activities. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const isStreaming = status === 'streaming';
  const isDone = status === 'done';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>✨ Generate itinerary with AI</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleGenerate} className="modal__form">
          <label>
            What kind of trip?
            <textarea
              name="prompt"
              value={form.prompt}
              onChange={handleChange}
              required
              rows={2}
              placeholder="e.g. A relaxed foodie long-weekend in Zagreb with some history"
            />
          </label>

          <div className="modal__row">
            <label>
              Days
              <input type="number" name="days" min={1} max={14} value={form.days} onChange={handleChange} required />
            </label>
            <label>
              Style
              <input name="style" value={form.style} onChange={handleChange} placeholder="relaxed, packed…" />
            </label>
            <label>
              Budget
              <input name="budget" value={form.budget} onChange={handleChange} placeholder="mid-range…" />
            </label>
          </div>

          <div className="modal__actions">
            <button type="submit" className="btn btn--primary" disabled={isStreaming}>
              {isStreaming ? 'Generating…' : isDone ? 'Regenerate' : 'Generate'}
            </button>
          </div>
        </form>

        {(isStreaming || isDone) && (
          <div className="gen-result">
            {summary && <p className="gen-result__summary">{summary}</p>}

            <div className="gen-result__cards">
              {activities.map((a, i) => (
                <div className="gen-card" key={`${a.day}-${a.name}-${i}`}>
                  <div className="gen-card__meta">
                    <span className="gen-card__day">Day {a.day}</span>
                    {a.suggestedStartTime && <span className="gen-card__time">{a.suggestedStartTime}</span>}
                    <span className={`gen-card__cat gen-card__cat--${a.category.toLowerCase()}`}>{a.category}</span>
                  </div>
                  <h4 className="gen-card__name">{a.name}</h4>
                  <p className="gen-card__desc">{a.description}</p>
                </div>
              ))}
              {isStreaming && <div className="gen-card gen-card--pending" aria-hidden="true" />}
            </div>

            {error && <p className="modal__error">{error}</p>}
            {addError && <p className="modal__error">{addError}</p>}

            {isDone && activities.length > 0 && (
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn--primary" onClick={handleAddAll} disabled={adding}>
                  {adding ? 'Adding…' : `Add all ${activities.length} to itinerary`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
