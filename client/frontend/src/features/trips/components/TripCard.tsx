import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration, tripStatusColor } from '@explivio/shared';
import { tripCoverUrl } from '../services/tripsApi';
import './TripCard.css';

interface Props {
  trip: Trip;
}

export function TripCard({ trip }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="trip-card" onClick={() => navigate(`/trips/${trip.id}/itinerary`)}>
      {trip.hasCoverPhoto && (
        <img className="trip-card__cover" src={tripCoverUrl(trip.id)} alt="" loading="lazy" />
      )}
      <div className="trip-card__header">
        <div className="trip-card__title">
          <h3 className="trip-card__name">{trip.name}</h3>
          {trip.status && (
            <span
              className="trip-card__status"
              style={{ backgroundColor: tripStatusColor(trip.status) }}
            >
              {t(`enums.tripStatus.${trip.status}`)}
            </span>
          )}
        </div>
        <span className="trip-card__destination">{trip.destination}</span>
      </div>
      <div className="trip-card__meta">
        <span>{formatTripDate(trip.startDate)} – {formatTripDate(trip.endDate)}</span>
        <span>{t('tripCard.summary', {
          count: getTripDuration(trip.startDate, trip.endDate),
          travelers: t('tripCard.travelers', { count: Number(trip.travelerCount) }),
        })}</span>
      </div>
    </div>
  );
}
