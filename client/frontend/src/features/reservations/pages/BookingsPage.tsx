import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, Reservation } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import { getReservations, deleteReservation } from '../services/reservationsApi';
import { ReservationCard } from '../components/ReservationCard';
import { ReservationModal } from '../components/ReservationModal';
import { reservationDateKey } from '../components/reservationMeta';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './BookingsPage.css';

export function BookingsPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = closed, 'new' = add form, otherwise the booking being edited.
  const [editor, setEditor] = useState<Reservation | 'new' | null>(null);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, reservationsData] = await Promise.all([
        getTrip(tripId),
        getReservations(tripId),
      ]);
      setTrip(tripData);
      setReservations(reservationsData);
    } catch {
      setError(t('bookings.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  // F15: live collaboration — refetch when another member changes bookings.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteReservation(tripId, id);
    load();
  }

  if (loading) return <div className="bookings-page"><p className="bookings-page__status">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="bookings-page"><p className="bookings-page__status bookings-page__status--error">{error ?? t('bookings.notFound')}</p></div>;

  // Group by start day (reservations arrive sorted by StartsAt).
  const groups: { date: string; items: Reservation[] }[] = [];
  for (const r of reservations) {
    const key = reservationDateKey(r.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.date === key) last.items.push(r);
    else groups.push({ date: key, items: [r] });
  }

  return (
    <div className="bookings-page">
      <div className="bookings-page__header">
        <div className="bookings-page__back">
          <Link to="/trips">← Trips</Link>
          <h1>{trip.name}</h1>
          <span className="bookings-page__destination">{trip.destination}</span>
          {othersViewing > 0 && (
            <span className="bookings-page__presence" title={presentUserIds.join(', ')}>
              <span className="bookings-page__presence-dot" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        <div className="bookings-page__actions">
          <Link className="btn btn--ghost" to={`/trips/${tripId}/itinerary`}>🗓 {t('bookings.itinerary')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/budget`}>💰 {t('bookings.budget')}</Link>
          <LanguageSwitcher />
          <button className="btn btn--primary" onClick={() => setEditor('new')}>{t('bookings.addBooking')}</button>
        </div>
      </div>

      {reservations.length === 0
        ? <p className="bookings-page__empty">{t('bookings.empty')}</p>
        : (
          <div className="bookings-page__groups">
            {groups.map(g => (
              <div className="bookings-page__group" key={g.date}>
                <h2 className="bookings-page__group-date">{formatTripDate(g.date)}</h2>
                <div className="bookings-page__group-items">
                  {g.items.map(r => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      showDate={false}
                      onEdit={setEditor}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {editor && (
        <ReservationModal
          tripId={tripId!}
          reservation={editor === 'new' ? undefined : editor}
          defaultDate={trip.startDate}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
        />
      )}
    </div>
  );
}
