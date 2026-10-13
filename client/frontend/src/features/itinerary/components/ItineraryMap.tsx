import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Activity } from '@explivio/shared';
import { formatActivityTime } from '@explivio/shared';
import 'leaflet/dist/leaflet.css';
import './ItineraryMap.css';

// A small palette so each day's pins share a color. Cycles if a trip has more days than colors.
const DAY_COLORS = ['#aa3bff', '#ef4444', '#059669', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

function dayColor(dayIndex: number): string {
  return DAY_COLORS[((dayIndex % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length];
}

// A colored numbered pin as a divIcon — avoids Leaflet's default marker images (which break under
// bundlers) and lets us color/label pins by day.
function dayPin(color: string, label: number): L.DivIcon {
  return L.divIcon({
    className: 'itinerary-map__pin-wrap',
    html: `<span class="itinerary-map__pin" style="background:${color}">${label}</span>`,
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
  // Ordered trip dates (same list the day-by-day view uses) → gives each pin its day number + color.
  days: string[];
}

export function ItineraryMap({ activities, days }: Props) {
  const points = useMemo<MappablePoint[]>(() => {
    return activities.flatMap(activity => {
      const lat = activity.latitude != null ? Number(activity.latitude) : NaN;
      const lng = activity.longitude != null ? Number(activity.longitude) : NaN;
      if (Number.isNaN(lat) || Number.isNaN(lng)) return [];
      const dayIndex = days.indexOf(activity.date);
      return [{ activity, dayNumber: dayIndex >= 0 ? dayIndex + 1 : 0, position: [lat, lng] as [number, number] }];
    });
  }, [activities, days]);

  if (points.length === 0) {
    return (
      <div className="itinerary-map itinerary-map--empty">
        <p>No places to map yet. Add activities with a location to see them here.</p>
      </div>
    );
  }

  return (
    <div className="itinerary-map">
      <MapContainer
        center={points[0].position}
        zoom={13}
        scrollWheelZoom={false}
        className="itinerary-map__canvas"
      >
        <TileLayer
          // OpenStreetMap tiles — free and keyless. Attribution is required by the OSM tile policy.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(({ activity, dayNumber, position }) => (
          <Marker key={activity.id} position={position} icon={dayPin(dayColor(dayNumber - 1), dayNumber)}>
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
    </div>
  );
}
