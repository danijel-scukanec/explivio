import { useNavigate } from 'react-router-dom';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration } from '@explivio/shared';
import './TripCard.css';

interface Props {
  trip: Trip;
}

export function TripCard({ trip }: Props) {
  const navigate = useNavigate();

  return (
    <div className="trip-card" onClick={() => navigate(`/trips/${trip.id}/itinerary`)}>
      <div className="trip-card__header">
        <h3 className="trip-card__name">{trip.name}</h3>
        <span className="trip-card__destination">{trip.destination}</span>
      </div>
      <div className="trip-card__meta">
        <span>{formatTripDate(trip.startDate)} – {formatTripDate(trip.endDate)}</span>
        <span>{getTripDuration(trip.startDate, trip.endDate)} days · {trip.travelerCount} traveller{trip.travelerCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
