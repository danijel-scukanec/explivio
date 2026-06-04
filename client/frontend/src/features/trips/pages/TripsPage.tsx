import { useEffect, useState } from 'react';
import type { Trip } from '@explivio/shared';
import { getTrips } from '../services/tripsApi';
import { TripCard } from '../components/TripCard';
import { CreateTripModal } from '../components/CreateTripModal';
import './TripsPage.css';

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadTrips() {
    setError(null);
    try {
      const data = await getTrips();
      setTrips(data);
    } catch {
      setError('Could not load trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrips(); }, []);

  function handleCreated() {
    setShowModal(false);
    loadTrips();
  }

  return (
    <div className="trips-page">
      <div className="trips-page__header">
        <h1>My trips</h1>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          + New trip
        </button>
      </div>

      {loading && <p className="trips-page__status">Loading…</p>}
      {error && <p className="trips-page__status trips-page__status--error">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <div className="trips-page__empty">
          <p>No trips yet. Create your first one!</p>
        </div>
      )}

      {trips.length > 0 && (
        <div className="trips-page__grid">
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}

      {showModal && (
        <CreateTripModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
