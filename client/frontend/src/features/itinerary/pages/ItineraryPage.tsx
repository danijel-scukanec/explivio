import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Trip, Activity, TripStatus } from '@explivio/shared';
import { getDaysInRange, TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrip, setTripStatus, setTripCover, tripCoverUrl } from '../../trips/services/tripsApi';
import { getActivities, deleteActivity } from '../services/itineraryApi';
import { DaySchedule } from '../components/DaySchedule';
import { AddActivityModal } from '../components/AddActivityModal';
import { EditStopsModal } from '../../trips/components/EditStopsModal';
import { GenerateItineraryModal } from '../components/GenerateItineraryModal';
import { ItineraryMap } from '../components/ItineraryMap';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { useFeatures, isFeatureOn } from '../../../shared/hooks/useFeatures';
import './ItineraryPage.css';

export function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showEditStops, setShowEditStops] = useState(false);
  // F22: bumps on each cover upload so the <img> reloads past the browser cache (the blob URL is stable).
  const [coverVersion, setCoverVersion] = useState(() => Date.now());
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, activitiesData] = await Promise.all([
        getTrip(tripId),
        getActivities(tripId),
      ]);
      setTrip(tripData);
      setActivities(activitiesData);
    } catch {
      setError('Could not load itinerary.');
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
      setError('Could not upload the cover photo.');
    }
  }

  function handleCreated() {
    setShowModal(false);
    load();
  }

  if (loading) return <div className="itinerary-page"><p className="itinerary-page__status">Loading…</p></div>;
  if (error || !trip) return <div className="itinerary-page"><p className="itinerary-page__status itinerary-page__status--error">{error ?? 'Trip not found.'}</p></div>;

  const days = getDaysInRange(trip.startDate, trip.endDate);
  const byDate = Object.fromEntries(days.map(d => [d, [] as Activity[]]));
  activities.forEach(a => { if (byDate[a.date]) byDate[a.date].push(a); });

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
              {othersViewing} other{othersViewing > 1 ? 's' : ''} viewing
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
                <option key={s} value={s}>{s}</option>
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
              🖼️ {trip.hasCoverPhoto ? 'Change cover' : 'Add cover'}
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => setShowEditStops(true)}>🧭 Edit route</button>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/budget`}>💰 Budget</Link>
          {isFeatureOn(features, 'AiItineraryGeneration') && (
            <button className="btn btn--ghost" onClick={() => setShowGenerate(true)}>✨ Generate with AI</button>
          )}
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ Add activity</button>
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

      <ItineraryMap activities={activities} days={days} />

      <div className="itinerary-page__days">
        {days.map((date, i) => (
          <DaySchedule
            key={date}
            date={date}
            dayNumber={i + 1}
            activities={byDate[date]}
            onDelete={handleDelete}
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
