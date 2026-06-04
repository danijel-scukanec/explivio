import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Trip, Activity } from '@explivio/shared';
import { getDaysInRange } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import { getActivities, deleteActivity } from '../services/itineraryApi';
import { DaySchedule } from '../components/DaySchedule';
import { AddActivityModal } from '../components/AddActivityModal';
import './ItineraryPage.css';

export function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteActivity(tripId, id);
    setActivities(prev => prev.filter(a => a.id !== id));
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
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ Add activity</button>
      </div>

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
    </div>
  );
}
