import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, Users } from 'lucide-react';
import type { Trip } from '@explivio/shared';
import { formatTripDate, getTripDuration, tripStatusColor } from '@explivio/shared';
import { tripCoverUrl } from '../services/tripsApi';
import { defaultCoverGradient } from '../coverImage';
import { useAuthedBlobUrl } from '../../../shared/hooks/useAuthedBlobUrl';
import { Card } from '@/components/ui/card';

interface Props {
  trip: Trip;
}

export function TripCard({ trip }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const coverSrc = useAuthedBlobUrl(trip.hasCoverPhoto ? tripCoverUrl(trip.id) : null);

  return (
    <Card
      onClick={() => navigate(`/trips/${trip.id}/itinerary`)}
      className="cursor-pointer gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md"
    >
      {/* Every trip gets a cover: the uploaded photo if there is one, otherwise a trip-coloured gradient
          so the grid stays uniform. The status badge sits on the image, top-right. */}
      <div
        className="relative h-36 w-full"
        style={{ background: defaultCoverGradient(trip.id) }}
      >
        {coverSrc && (
          <img className="block h-full w-full object-cover" src={coverSrc} alt="" loading="lazy" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25" />
        {trip.status && (
          <span
            className="absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase shadow-sm"
            style={{ backgroundColor: tripStatusColor(trip.status) }}
          >
            {t(`enums.tripStatus.${trip.status}`)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-5">
        <h3 className="text-card-foreground text-lg font-semibold">{trip.name}</h3>
        <span className="text-primary text-sm">{trip.destination}</span>
        <div className="text-muted-foreground flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5 opacity-70" aria-hidden="true" />
            {formatTripDate(trip.startDate)} – {formatTripDate(trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 opacity-70" aria-hidden="true" />
            {t('tripCard.summary', {
              count: getTripDuration(trip.startDate, trip.endDate),
              travelers: t('tripCard.travelers', { count: Number(trip.travelerCount) }),
            })}
          </span>
        </div>
      </div>
    </Card>
  );
}
