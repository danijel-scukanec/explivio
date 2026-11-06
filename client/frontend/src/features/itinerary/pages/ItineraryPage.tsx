import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity, ActivityCategory, Reservation } from '@explivio/shared';
import { getDaysInRange } from '@explivio/shared';
import { getActivities, deleteActivity, reorderActivities } from '../services/itineraryApi';
import { setTripStops } from '../../trips/services/tripsApi';
import { reverseGeocodeCity, cityFromAddress } from '../geocode';
import { getReservations, deleteReservation } from '../../reservations/services/reservationsApi';
import { reservationDateKey } from '../../reservations/components/reservationMeta';
import { ReservationModal } from '../../reservations/components/ReservationModal';
import { DaySchedule } from '../components/DaySchedule';
import { AddActivityModal } from '../components/AddActivityModal';
import { EditActivityModal } from '../components/EditActivityModal';
import { GenerateItineraryModal } from '../components/GenerateItineraryModal';
import { ItineraryMap } from '../components/ItineraryMap';
import { TripConditions } from '../components/TripConditions';
import { ImportBookingModal } from '../../import/components/ImportBookingModal';
import { TripAssistantPanel } from '../components/TripAssistantPanel';
import { nearestStop, stopColor } from '../stopAssignment';
import { useTrip } from '../../trips/pages/TripLayout';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { useFeatures, isFeatureOn } from '../../../shared/hooks/useFeatures';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// F23: categories available for the itinerary view filter (mirrors the ActivityCategory enum).
const ACTIVITY_CATEGORIES: { value: ActivityCategory; icon: string }[] = [
  { value: 'Sightseeing', icon: '🏛' },
  { value: 'Food', icon: '🍽' },
  { value: 'Transport', icon: '🚌' },
  { value: 'Accommodation', icon: '🏨' },
  { value: 'Adventure', icon: '🧗' },
  { value: 'Other', icon: '📌' },
];

export function ItineraryPage() {
  const { t } = useTranslation();
  const { trip, tripId, reloadTrip, changeSignal } = useTrip();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // The day a new activity is being added to (its date pre-fills the modal); null = closed.
  const [addDate, setAddDate] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Set<ActivityCategory>>(new Set());
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  // Which route stop is briefly highlighted (after a click in the route sidebar).
  const [highlightStopName, setHighlightStopName] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  const [addingStopId, setAddingStopId] = useState<string | null>(null);

  const features = useFeatures();
  const confirm = useConfirm();
  const stops = trip.stops;

  const load = useCallback(async () => {
    const [activitiesData, reservationsData] = await Promise.all([
      getActivities(tripId),
      getReservations(tripId),
    ]);
    setActivities(activitiesData);
    setReservations(reservationsData);
  }, [tripId]);

  useEffect(() => { void load(); }, [load, changeSignal]);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  // Derived route-stop for an activity → { place name, color } (color matches the map + legend).
  const stopIndexById = useMemo(() => new Map(stops.map((s, i) => [s.id, i])), [stops]);
  const stopFor = useCallback((a: Activity) => {
    const s = nearestStop(a, stops);
    return s ? { name: s.place, color: stopColor(stopIndexById.get(s.id) ?? 0) } : null;
  }, [stops, stopIndexById]);

  async function handleDelete(id: string) {
    if (!(await confirm())) return;
    await deleteActivity(tripId, id);
    setActivities(prev => prev.filter(a => a.id !== id));
  }

  // F23: reorder a day's activities. Optimistic, then persist; revert on failure.
  async function handleReorder(date: string, orderedIds: string[]) {
    setActivities(prev => {
      const reorderedForDate = orderedIds.map(id => prev.find(a => a.id === id)).filter((a): a is Activity => !!a);
      let k = 0;
      return prev.map(a => (a.date === date ? reorderedForDate[k++] : a));
    });
    try {
      await reorderActivities(tripId, orderedIds);
    } catch {
      load();
    }
  }

  async function handleDeleteReservation(id: string) {
    if (!(await confirm())) return;
    await deleteReservation(tripId, id);
    setReservations(prev => prev.filter(r => r.id !== id));
  }

  function toggleCategory(category: ActivityCategory) {
    setCategoryFilter(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  const days = getDaysInRange(trip.startDate, trip.endDate);
  const filterActive = categoryFilter.size > 0;
  const byDate = Object.fromEntries(days.map(d => [d, [] as Activity[]]));
  activities.forEach(a => {
    if (byDate[a.date] && (!filterActive || categoryFilter.has(a.category))) byDate[a.date].push(a);
  });
  const reservationsByDate = Object.fromEntries(days.map(d => [d, [] as Reservation[]]));
  if (!filterActive) {
    reservations.forEach(r => {
      const key = reservationDateKey(r.startsAt);
      if (reservationsByDate[key]) reservationsByDate[key].push(r);
    });
  }

  // Add an off-route activity's city to the route (opt-in). Resolve the city from the activity's
  // coordinates (reverse geocode, falling back to its address), then append it as a stop — or backfill
  // coordinates onto a same-named stop that was added without them. The layout re-fetches the trip, so
  // the activity then matches and its "Add to route" nudge disappears.
  async function handleAddStop(a: Activity) {
    const lat = a.latitude != null ? Number(a.latitude) : NaN;
    const lng = a.longitude != null ? Number(a.longitude) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setAddingStopId(a.id);
    try {
      const city = (await reverseGeocodeCity(lat, lng)) || cityFromAddress(a.location) || a.name;
      const toInput = (s: typeof stops[number]) => ({
        place: s.place, arriveDate: s.arriveDate, departDate: s.departDate, latitude: s.latitude, longitude: s.longitude,
      });
      const existing = stops.findIndex(s => s.place.toLowerCase() === city.toLowerCase());
      const next = existing >= 0
        ? stops.map((s, i) => i === existing
            ? { ...toInput(s), latitude: s.latitude ?? lat, longitude: s.longitude ?? lng }
            : toInput(s))
        : [...stops.map(toInput), { place: city, arriveDate: null, departDate: null, latitude: lat, longitude: lng }];
      await setTripStops(tripId, next);
      reloadTrip();
    } catch {
      /* best-effort; leave the nudge for a retry */
    } finally {
      setAddingStopId(null);
    }
  }

  // Route sidebar: clicking a stop scrolls to the first day it appears on and briefly rings its cards.
  function handleStopClick(place: string) {
    const idx = days.findIndex(d => activities.some(a => a.date === d && stopFor(a)?.name === place));
    if (idx >= 0) document.getElementById(`day-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightStopName(place);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightStopName(null), 1800);
  }

  return (
    <div>
      {/* View controls: category filter (left) + page actions (right), full width so the chips fit one row. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {activities.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-0.5 text-[13px] font-semibold">{t('itinerary.filter')}</span>
            {ACTIVITY_CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1 text-[13px] transition-colors',
                  categoryFilter.has(c.value)
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:border-primary',
                )}
                onClick={() => toggleCategory(c.value)}
                aria-pressed={categoryFilter.has(c.value)}
              >
                {c.icon} {t(`enums.activityCategory.${c.value}`)}
              </button>
            ))}
            {filterActive && (
              <button type="button" className="text-primary px-2 py-1 text-[13px]" onClick={() => setCategoryFilter(new Set())}>
                {t('itinerary.clear')}
              </button>
            )}
          </div>
        ) : <div />}

        <div className="flex items-center gap-2">
          {isFeatureOn(features, 'AiEmailParsing') && (
            <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>📧 {t('itinerary.import')}</Button>
          )}
          {isFeatureOn(features, 'AiItineraryGeneration') && (
            <Button variant="ghost" size="sm" onClick={() => setShowGenerate(true)}>✨ {t('itinerary.generate')}</Button>
          )}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-6">
        {/* Main column: the day-by-day plan (primary). */}
        <div className="min-w-0">
          {filterActive && <p className="text-muted-foreground mb-2 text-xs">{t('itinerary.clearToReorder')}</p>}

          <div className="flex flex-col gap-4">
            {days.map((date, i) => (
              <DaySchedule
                key={date}
                id={`day-${i}`}
                date={date}
                dayNumber={i + 1}
                activities={byDate[date]}
                onDelete={handleDelete}
                onEdit={setEditing}
                stopFor={stopFor}
                highlightStopName={highlightStopName}
                onAddStop={handleAddStop}
                addingStopId={addingStopId}
                onAddActivity={setAddDate}
                onReorder={filterActive ? undefined : handleReorder}
                reservations={reservationsByDate[date]}
                onEditReservation={setEditingReservation}
                onDeleteReservation={handleDeleteReservation}
              />
            ))}
          </div>
        </div>

        {/* Sidebar: map + weather + route (context). Sticky on desktop; stacks below on mobile. */}
        <aside className="mt-6 flex flex-col gap-4 lg:mt-0 lg:sticky lg:top-6">
          <ItineraryMap activities={activities} days={days} stops={stops} />
          <TripConditions tripId={tripId} />
          {stops.length > 0 && (
            <div className="rounded-xl border p-4">
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">{t('itinerary.route')}</h3>
              <ol className="flex flex-col gap-1">
                {stops.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleStopClick(s.place)}
                      className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: stopColor(i) }}>{i + 1}</span>
                      <span className="text-foreground font-medium">{s.place}</span>
                      {(s.arriveDate || s.departDate) && (
                        <span className="text-muted-foreground ml-auto text-xs">
                          {s.arriveDate ?? ''}{s.departDate ? ` – ${s.departDate}` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {addDate && (
        <AddActivityModal
          tripId={tripId}
          initialDate={addDate}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setAddDate(null)}
          onCreated={() => { setAddDate(null); load(); }}
        />
      )}

      {editing && (
        <EditActivityModal
          tripId={tripId}
          activity={editing}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {editingReservation && (
        <ReservationModal
          tripId={tripId}
          reservation={editingReservation}
          defaultDate={trip.startDate}
          onClose={() => setEditingReservation(null)}
          onSaved={() => { setEditingReservation(null); load(); }}
        />
      )}

      {showGenerate && (
        <GenerateItineraryModal
          tripId={tripId}
          startDate={trip.startDate}
          endDate={trip.endDate}
          onClose={() => setShowGenerate(false)}
          onAdded={() => { setShowGenerate(false); load(); }}
        />
      )}

      {showImport && (
        <ImportBookingModal tripId={tripId} trip={trip} onClose={() => setShowImport(false)} onAdded={load} />
      )}

      {isFeatureOn(features, 'AiAssistant') && <TripAssistantPanel tripId={tripId} />}
    </div>
  );
}
