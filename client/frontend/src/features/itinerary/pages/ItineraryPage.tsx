import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, Activity, ActivityCategory, Reservation, TripStatus } from '@explivio/shared';
import { getDaysInRange, TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrip, setTripStatus, setTripCover, tripCoverUrl } from '../../trips/services/tripsApi';
import { getActivities, deleteActivity, reorderActivities } from '../services/itineraryApi';
import { getReservations, deleteReservation } from '../../reservations/services/reservationsApi';
import { reservationDateKey } from '../../reservations/components/reservationMeta';
import { ReservationModal } from '../../reservations/components/ReservationModal';
import { DaySchedule } from '../components/DaySchedule';
import { AddActivityModal } from '../components/AddActivityModal';
import { EditActivityModal } from '../components/EditActivityModal';
import { EditStopsModal } from '../../trips/components/EditStopsModal';
import { GenerateItineraryModal } from '../components/GenerateItineraryModal';
import { ItineraryMap } from '../components/ItineraryMap';
import { TripConditions } from '../components/TripConditions';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { useFeatures, isFeatureOn } from '../../../shared/hooks/useFeatures';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './ItineraryPage.css';

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
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showEditStops, setShowEditStops] = useState(false);
  // F23: the activity being edited, and the set of categories to show (empty = show all).
  const [editing, setEditing] = useState<Activity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Set<ActivityCategory>>(new Set());
  // F23: the booking being edited from a day card (adding bookings lives on the Bookings page).
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  // F22: bumps on each cover upload so the <img> reloads past the browser cache (the blob URL is stable).
  const [coverVersion, setCoverVersion] = useState(() => Date.now());
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, activitiesData, reservationsData] = await Promise.all([
        getTrip(tripId),
        getActivities(tripId),
        getReservations(tripId),
      ]);
      setTrip(tripData);
      setActivities(activitiesData);
      setReservations(reservationsData);
    } catch {
      setError(t('itinerary.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  // F32: hide controls whose feature flag is off on the server (unknown flags default to on).
  const features = useFeatures();

  // F15 Phase B: live collaboration — refetch when another member edits, and show who's viewing.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteActivity(tripId, id);
    setActivities(prev => prev.filter(a => a.id !== id));
  }

  // F23: reorder a day's activities. Update local order optimistically (the list is grouped by array
  // order within a date), then persist; revert to the server's truth on failure.
  async function handleReorder(date: string, orderedIds: string[]) {
    if (!tripId) return;
    setActivities(prev => {
      const reorderedForDate = orderedIds
        .map(id => prev.find(a => a.id === id))
        .filter((a): a is Activity => !!a);
      let k = 0;
      return prev.map(a => (a.date === date ? reorderedForDate[k++] : a));
    });
    try {
      await reorderActivities(tripId, orderedIds);
    } catch {
      load();
    }
  }

  // F23: delete a booking from its day card (also removes its linked budget expense, server-side).
  async function handleDeleteReservation(id: string) {
    if (!tripId) return;
    await deleteReservation(tripId, id);
    setReservations(prev => prev.filter(r => r.id !== id));
  }

  // F23: toggle a category in the view filter.
  function toggleCategory(category: ActivityCategory) {
    setCategoryFilter(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  // F22: change the trip's status, updating the local copy optimistically.
  async function handleStatusChange(status: TripStatus) {
    if (!tripId) return;
    setTrip(prev => (prev ? { ...prev, status } : prev));
    try {
      await setTripStatus(tripId, status);
    } catch {
      load(); // revert to the server's truth on failure
    }
  }

  // F22: upload a cover photo, then reveal it (and bust the image cache).
  async function handleCoverSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again later
    if (!file || !tripId) return;
    try {
      await setTripCover(tripId, file);
      setCoverVersion(Date.now());
      setTrip(prev => (prev ? { ...prev, hasCoverPhoto: true } : prev));
    } catch {
      setError(t('itinerary.couldNotUploadCover'));
    }
  }

  function handleCreated() {
    setShowModal(false);
    load();
  }

  if (loading) return <div className="itinerary-page"><p className="itinerary-page__status">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="itinerary-page"><p className="itinerary-page__status itinerary-page__status--error">{error ?? t('itinerary.notFound')}</p></div>;

  const days = getDaysInRange(trip.startDate, trip.endDate);
  // F23: dragging is disabled while a filter is active — reordering a partial list is ambiguous.
  const filterActive = categoryFilter.size > 0;
  const byDate = Object.fromEntries(days.map(d => [d, [] as Activity[]]));
  activities.forEach(a => {
    if (byDate[a.date] && (!filterActive || categoryFilter.has(a.category))) byDate[a.date].push(a);
  });
  // F23: bookings surface on the day they start. Hidden while a category filter is active (they have
  // no category), so the filtered view stays about activities only.
  const reservationsByDate = Object.fromEntries(days.map(d => [d, [] as Reservation[]]));
  if (!filterActive) {
    reservations.forEach(r => {
      const key = reservationDateKey(r.startsAt);
      if (reservationsByDate[key]) reservationsByDate[key].push(r);
    });
  }

  return (
    <div className="itinerary-page">
      <div className="itinerary-page__header">
        <div className="itinerary-page__back">
          <Link to="/trips">← Trips</Link>
          <h1>{trip.name}</h1>
          <span className="itinerary-page__destination">{trip.destination}</span>
          {othersViewing > 0 && (
            <span
              className="itinerary-page__presence"
              title={presentUserIds.join(', ')}
            >
              <span className="itinerary-page__presence-dot" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        <div className="itinerary-page__actions">
          {trip.status && (
            <select
              className="itinerary-page__status"
              style={{ backgroundColor: tripStatusColor(trip.status) }}
              value={trip.status}
              onChange={e => handleStatusChange(e.target.value as TripStatus)}
              aria-label="Trip status"
            >
              {TRIP_STATUSES.map(s => (
                <option key={s} value={s}>{t(`enums.tripStatus.${s}`)}</option>
              ))}
            </select>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleCoverSelected}
          />
          {isFeatureOn(features, 'TripCoverPhotos') && (
            <button className="btn btn--ghost" onClick={() => coverInputRef.current?.click()}>
              🖼️ {trip.hasCoverPhoto ? t('itinerary.changeCover') : t('itinerary.addCover')}
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => setShowEditStops(true)}>🧭 {t('itinerary.editRoute')}</button>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/bookings`}>🎫 {t('itinerary.bookings')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/checklists`}>✅ {t('itinerary.checklists')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/documents`}>📎 {t('itinerary.documents')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/budget`}>💰 {t('itinerary.budget')}</Link>
          {isFeatureOn(features, 'AiItineraryGeneration') && (
            <button className="btn btn--ghost" onClick={() => setShowGenerate(true)}>✨ {t('itinerary.generate')}</button>
          )}
          <LanguageSwitcher />
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>{t('itinerary.addActivity')}</button>
        </div>
      </div>

      {trip.hasCoverPhoto && (
        <img className="itinerary-page__cover" src={tripCoverUrl(trip.id, coverVersion)} alt="" />
      )}

      {trip.stops.length > 0 && (
        <ol className="itinerary-page__route">
          {trip.stops.map((stop, i) => (
            <li key={stop.id} className="itinerary-page__route-stop">
              <span className="itinerary-page__route-num">{i + 1}</span>
              <span className="itinerary-page__route-place">{stop.place}</span>
              {stop.arriveDate && (
                <span className="itinerary-page__route-dates">
                  {stop.arriveDate}{stop.departDate ? ` – ${stop.departDate}` : ''}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <TripConditions tripId={tripId!} />

      <ItineraryMap activities={activities} days={days} />

      {activities.length > 0 && (
        <div className="itinerary-page__filters">
          <span className="itinerary-page__filters-label">{t('itinerary.filter')}</span>
          {ACTIVITY_CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              className={`itinerary-page__chip${categoryFilter.has(c.value) ? ' itinerary-page__chip--on' : ''}`}
              onClick={() => toggleCategory(c.value)}
              aria-pressed={categoryFilter.has(c.value)}
            >
              {c.icon} {t(`enums.activityCategory.${c.value}`)}
            </button>
          ))}
          {filterActive && (
            <button type="button" className="itinerary-page__chip-clear" onClick={() => setCategoryFilter(new Set())}>
              {t('itinerary.clear')}
            </button>
          )}
        </div>
      )}
      {filterActive && (
        <p className="itinerary-page__filter-hint">{t('itinerary.clearToReorder')}</p>
      )}

      <div className="itinerary-page__days">
        {days.map((date, i) => (
          <DaySchedule
            key={date}
            date={date}
            dayNumber={i + 1}
            activities={byDate[date]}
            onDelete={handleDelete}
            onEdit={setEditing}
            onReorder={filterActive ? undefined : handleReorder}
            reservations={reservationsByDate[date]}
            onEditReservation={setEditingReservation}
            onDeleteReservation={handleDeleteReservation}
          />
        ))}
      </div>

      {showModal && (
        <AddActivityModal
          tripId={tripId!}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {editing && (
        <EditActivityModal
          tripId={tripId!}
          activity={editing}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {editingReservation && (
        <ReservationModal
          tripId={tripId!}
          reservation={editingReservation}
          defaultDate={trip.startDate}
          onClose={() => setEditingReservation(null)}
          onSaved={() => { setEditingReservation(null); load(); }}
        />
      )}

      {showGenerate && (
        <GenerateItineraryModal
          tripId={tripId!}
          startDate={trip.startDate}
          endDate={trip.endDate}
          onClose={() => setShowGenerate(false)}
          onAdded={() => { setShowGenerate(false); load(); }}
        />
      )}

      {showEditStops && (
        <EditStopsModal
          tripId={tripId!}
          initialStops={trip.stops}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setShowEditStops(false)}
          onSaved={() => { setShowEditStops(false); load(); }}
        />
      )}
    </div>
  );
}
