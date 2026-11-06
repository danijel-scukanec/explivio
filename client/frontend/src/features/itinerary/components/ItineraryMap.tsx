import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Activity, TripStop } from '@explivio/shared';
import { formatActivityTime } from '@explivio/shared';
import { nearestStop, stopColor } from '../stopAssignment';
import 'leaflet/dist/leaflet.css';

// A colored numbered pin as a divIcon — avoids Leaflet's default marker images (which break under
// bundlers) and lets us color/label pins by day.
function dayPin(color: string, label: number): L.DivIcon {
  // Styles are inline (not a CSS class) because this HTML is injected by Leaflet, outside React/Tailwind.
  const style = `display:flex;align-items:center;justify-content:center;width:26px;height:26px;`
    + `border-radius:50%;color:#fff;font-size:12px;font-weight:700;border:2px solid #fff;`
    + `box-shadow:0 1px 4px rgba(0,0,0,0.4);background:${color}`;
  return L.divIcon({
    html: `<span style="${style}">${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

interface MappablePoint {
  activity: Activity;
  dayNumber: number;
  position: [number, number];
}

// Pans/zooms the map to fit every pin whenever the set of points changes.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    // Guard against a far-flung outlier collapsing the view to the whole world: if fitting every pin
    // forces an extreme zoom-out, fall back to the first pin at city zoom so the trip stays legible.
    if (map.getZoom() < 6) {
      map.setView(points[0], 12);
    }
  }, [points, map]);
  return null;
}

interface Props {
  activities: Activity[];
  // Ordered trip dates (same list the day-by-day view uses) → gives each pin its day number.
  days: string[];
  // Route stops → pins are colored by the stop each activity belongs to, matching the day headers and
  // the per-activity place chips. A small legend ties each color to its place.
  stops: TripStop[];
}

export function ItineraryMap({ activities, days, stops }: Props) {
  const stopIndexById = useMemo(() => new Map(stops.map((s, i) => [s.id, i])), [stops]);

  const points = useMemo<(MappablePoint & { color: string })[]>(() => {
    return activities.flatMap(activity => {
      const lat = activity.latitude != null ? Number(activity.latitude) : NaN;
      const lng = activity.longitude != null ? Number(activity.longitude) : NaN;
      if (Number.isNaN(lat) || Number.isNaN(lng)) return [];
      const dayIndex = days.indexOf(activity.date);
      const stop = nearestStop(activity, stops);
      const color = stop ? stopColor(stopIndexById.get(stop.id) ?? 0) : '#94a3b8';
      return [{ activity, dayNumber: dayIndex >= 0 ? dayIndex + 1 : 0, position: [lat, lng] as [number, number], color }];
    });
  }, [activities, days, stops, stopIndexById]);

  if (points.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[120px] items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        <p>No places to map yet. Add activities with a location to see them here.</p>
      </div>
    );
  }

  return (
    <div>
      <MapContainer
        center={points[0].position}
        zoom={13}
        scrollWheelZoom={false}
        className="z-0 h-72 w-full rounded-xl border"
      >
        <TileLayer
          // OpenStreetMap tiles — free and keyless. Attribution is required by the OSM tile policy.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(({ activity, dayNumber, position, color }) => (
          <Marker key={activity.id} position={position} icon={dayPin(color, dayNumber)}>
            <Popup>
              <strong>{activity.name}</strong>
              <br />
              Day {dayNumber}
              {formatActivityTime(activity.startTime) && ` · ${formatActivityTime(activity.startTime)}`}
              {activity.location && <><br />{activity.location}</>}
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points.map(p => p.position)} />
      </MapContainer>
      {stops.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {stops.map((s, i) => (
            <span key={s.id} className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: stopColor(i) }} />
              {s.place}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
