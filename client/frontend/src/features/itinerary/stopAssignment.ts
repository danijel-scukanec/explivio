import type { Activity, TripStop } from '@explivio/shared';

// Max distance (km) for a coordinate-based match. Beyond this the nearest stop is almost certainly
// unrelated (an activity in another country), so we leave the activity unassigned rather than slap a
// wrong place chip on it. Generous enough to cover a metro area + day trips.
const MAX_ASSIGN_KM = 75;

// Great-circle distance in km between two lat/lng points.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Derive which route stop an activity belongs to — a non-destructive label, not stored.
// Primary signal: nearest stop by coordinates (activities get lat/lng from the Places autofill).
// Fallback: the activity's free-text location mentioning a stop's place name. Else null (no label).
export function nearestStop(activity: Pick<Activity, 'latitude' | 'longitude' | 'location'>, stops: TripStop[]): TripStop | null {
  // 1) Strongest, most reliable signal: the activity's address names one of the stops (e.g.
  //    "…, Zagreb, Croatia" → the Zagreb stop). This works even when that stop has no coordinates.
  const loc = (activity.location ?? '').toLowerCase();
  const textMatches = loc ? stops.filter(s => s.place && loc.includes(s.place.toLowerCase())) : [];
  if (textMatches.length === 1) return textMatches[0];

  // 2) Coordinates break ties — nearest among the text matches if there were several, otherwise
  //    among all stops that have coordinates. The nearest only wins if it's within MAX_ASSIGN_KM, so
  //    an activity far from every stop (a different city/country) stays unassigned instead of being
  //    mislabeled to a distant stop.
  const aLat = activity.latitude != null ? Number(activity.latitude) : null;
  const aLng = activity.longitude != null ? Number(activity.longitude) : null;
  if (aLat != null && aLng != null && !Number.isNaN(aLat) && !Number.isNaN(aLng)) {
    const candidates = textMatches.length ? textMatches : stops;
    let best: TripStop | null = null;
    let bestKm = Infinity;
    for (const s of candidates) {
      const sLat = s.latitude != null ? Number(s.latitude) : null;
      const sLng = s.longitude != null ? Number(s.longitude) : null;
      if (sLat == null || sLng == null || Number.isNaN(sLat) || Number.isNaN(sLng)) continue;
      const d = distanceKm(aLat, aLng, sLat, sLng);
      if (d < bestKm) { bestKm = d; best = s; }
    }
    if (best && bestKm <= MAX_ASSIGN_KM) return best;
    // A text match is authoritative even if its stop has no usable coords to rank by.
    if (textMatches.length) return textMatches[0];
    return null; // nearest stop is too far away → unassigned
  }

  // 3) No usable activity coordinates — trust a text match if there was one.
  return textMatches[0] ?? null;
}

// A stable color per stop (by route order), shared by the map pins and the per-activity place chips
// so the two read as one system. Cycles if there are more stops than colors.
export const STOP_COLORS = ['#aa3bff', '#0ea5e9', '#059669', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444'];

export function stopColor(index: number): string {
  return STOP_COLORS[((index % STOP_COLORS.length) + STOP_COLORS.length) % STOP_COLORS.length];
}
