import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Trip, Activity, TripStatus } from '@explivio/shared';
import { getDaysInRange, TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrip, setTripStatus } from '../../trips/services/tripsApi';
import { getActivities, deleteActivity } from '../services/itineraryApi';
import { DaySchedule } from '../components/DaySchedule';
import { AddActivityModal } from '../components/AddActivityModal';
import { GenerateItineraryModal } from '../components/GenerateItineraryModal';
import { ItineraryMap } from '../components/ItineraryMap';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import './ItineraryPage.css';

export function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

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
          <Link className="btn btn--ghost" to={`/trips/${tripId}/budget`}>💰 Budget</Link>
          <button className="btn btn--ghost" onClick={() => setShowGenerate(true)}>✨ Generate with AI</button>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ Add activity</button>
        </div>
      </div>

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
    </div>
  );
}
