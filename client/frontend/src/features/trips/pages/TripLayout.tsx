import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, Outlet, useOutletContext, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, TripStatus } from '@explivio/shared';
import { TRIP_STATUSES, tripStatusColor } from '@explivio/shared';
import { getTrip, setTripStatus, setTripCover, tripCoverUrl } from '../services/tripsApi';
import { EditStopsModal } from '../components/EditStopsModal';
import { MembersModal } from '../components/MembersModal';
import { ShareTripModal } from '../../gallery/components/ShareTripModal';
import { ExportItineraryModal } from '../../itinerary/components/ExportItineraryModal';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { useFeatures, isFeatureOn } from '../../../shared/hooks/useFeatures';
import { useAuthedBlobUrl } from '../../../shared/hooks/useAuthedBlobUrl';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';

// The shared "master" shell for a single trip: a persistent header (identity, status, trip-level
// actions, cover) and a tab bar across the trip's sub-pages. The active sub-page renders into the
// <Outlet> below the tabs, so switching tabs swaps only the content — the header/tabs stay mounted.
export interface TripOutlet {
  trip: Trip;
  tripId: string;
  // Refetch the trip itself (name, status, stops, cover) after a trip-level edit.
  reloadTrip: () => void;
  // Bumps when a collaborator edits the trip (SignalR) — sub-pages refetch their own data on change.
  changeSignal: number;
}

// Typed accessor for sub-pages: `const { trip, changeSignal } = useTrip();`
export function useTrip() {
  return useOutletContext<TripOutlet>();
}

export function TripLayout() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const { pathname } = useLocation();
  const features = useFeatures();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changeSignal, setChangeSignal] = useState(0);

  const [showEditStops, setShowEditStops] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // F22: bumps on each cover upload so the <img> reloads past the browser cache (the blob URL is stable).
  const [coverVersion, setCoverVersion] = useState(() => Date.now());
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverSrc = useAuthedBlobUrl(trip?.hasCoverPhoto ? tripCoverUrl(trip.id) : null, coverVersion);

  const reloadTrip = useCallback(() => {
    if (!tripId) return;
    getTrip(tripId)
      .then(setTrip)
      .catch(() => setError(t('itinerary.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId, t]);

  useEffect(() => { reloadTrip(); }, [reloadTrip]);

  // Single live-collaboration subscription for the whole trip: presence badge here + a change signal
  // that every sub-page watches to refetch its own data.
  const { presentUserIds } = useTripCollaboration(tripId, () => {
    reloadTrip();
    setChangeSignal(n => n + 1);
  });
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleStatusChange(status: TripStatus) {
    if (!tripId || !trip) return;
    setTrip({ ...trip, status }); // optimistic
    try {
      await setTripStatus(tripId, status);
    } catch {
      reloadTrip(); // revert to the server's truth on failure
    }
  }

  async function handleCoverSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again later
    if (!file || !tripId) return;
    try {
      await setTripCover(tripId, file);
      setCoverVersion(Date.now());
      reloadTrip();
    } catch {
      setError(t('itinerary.couldNotUploadCover'));
    }
  }

  if (loading) return <div className="px-5 py-6 sm:px-8 sm:py-10"><p className="text-muted-foreground text-sm">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="px-5 py-6 sm:px-8 sm:py-10"><p className="text-destructive text-sm">{error ?? t('itinerary.notFound')}</p></div>;

  const tabs = [
    { to: 'itinerary', label: t('itinerary.title') },
    { to: 'bookings', label: t('itinerary.bookings') },
    { to: 'checklists', label: t('itinerary.checklists') },
    { to: 'documents', label: t('itinerary.documents') },
    { to: 'budget', label: t('itinerary.budget') },
    ...(isFeatureOn(features, 'AiTripRecap') ? [{ to: 'recap', label: t('itinerary.recap') }] : []),
  ];
  const activeTab = (pathname.split('/').pop() || 'itinerary');

  // Header controls (status, notifications, language, overflow menu) — shared by the photo hero
  // (onImage: white treatment) and the plain text header (onImage=false).
  const controls = (onImage: boolean) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {trip.status && (
        <select
          className="cursor-pointer appearance-none rounded-full border-none px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase shadow outline-none"
          style={{ backgroundColor: tripStatusColor(trip.status) }}
          value={trip.status}
          onChange={e => handleStatusChange(e.target.value as TripStatus)}
          aria-label="Trip status"
        >
          {TRIP_STATUSES.map(s => (
            <option key={s} value={s} className="bg-background text-foreground font-medium normal-case">{t(`enums.tripStatus.${s}`)}</option>
          ))}
        </select>
      )}
      <Menu trigger={<Button variant="ghost" size="icon" aria-label="More" className={onImage ? 'text-white hover:bg-white/20' : undefined}>⋯</Button>}>
        <MenuItem onClick={() => setShowEditStops(true)}>🧭 {t('itinerary.editRoute')}</MenuItem>
        {isFeatureOn(features, 'TripCoverPhotos') && (
          <MenuItem onClick={() => coverInputRef.current?.click()}>
            🖼️ {trip.hasCoverPhoto ? t('itinerary.changeCover') : t('itinerary.addCover')}
          </MenuItem>
        )}
        <MenuItem onClick={() => setShowMembers(true)}>👥 {t('members.title')}</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => setShowShare(true)}>🔗 {t('itinerary.share')}</MenuItem>
        <MenuItem onClick={() => setShowExport(true)}>📅 {t('itinerary.export')}</MenuItem>
      </Menu>
    </div>
  );

  return (
    <div className="px-5 py-5 text-left sm:px-8">
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleCoverSelected} />

      {/* Trip identity bar — title + status + actions on the page background, between the global header
          and the cover (not overlaid on the photo). */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-semibold">{t('itinerary.tripTo', { name: trip.name })}</h1>
          {othersViewing > 0 && (
            <span className="text-primary inline-flex items-center gap-1.5 text-[13px] font-medium" title={presentUserIds.join(', ')}>
              <span className="size-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        {controls(false)}
      </div>

      {/* Cover band — only shown when the trip has an uploaded cover photo; no default otherwise. */}
      {coverSrc && (
        <div className="relative mb-5 h-[140px] overflow-hidden rounded-xl">
          <img
            src={coverSrc}
            alt=""
            onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <nav className="mb-6 flex gap-1 border-b [scrollbar-width:none] max-sm:overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {tabs.map(tab => {
          const active = tab.to === activeTab;
          return active ? (
            <span key={tab.to} className="border-primary text-primary -mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap">
              {tab.label}
            </span>
          ) : (
            <Link
              key={tab.to}
              to={`/trips/${tripId}/${tab.to}`}
              className="text-muted-foreground hover:text-foreground hover:border-border -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet context={{ trip, tripId: tripId!, reloadTrip, changeSignal } satisfies TripOutlet} />

      {showEditStops && (
        <EditStopsModal
          tripId={tripId!}
          initialStops={trip.stops}
          minDate={trip.startDate}
          maxDate={trip.endDate}
          onClose={() => setShowEditStops(false)}
          onSaved={() => { setShowEditStops(false); reloadTrip(); setChangeSignal(n => n + 1); }}
        />
      )}
      {showMembers && <MembersModal tripId={tripId!} onClose={() => setShowMembers(false)} />}
      {showShare && (
        <ShareTripModal
          tripId={tripId!}
          isPublic={trip.isPublic}
          shareToken={trip.shareToken ?? null}
          onClose={() => setShowShare(false)}
          onChanged={reloadTrip}
        />
      )}
      {showExport && (
        <ExportItineraryModal
          tripId={tripId!}
          tripName={trip.name}
          shareToken={trip.shareToken ?? null}
          onClose={() => setShowExport(false)}
          onChanged={reloadTrip}
        />
      )}
    </div>
  );
}
