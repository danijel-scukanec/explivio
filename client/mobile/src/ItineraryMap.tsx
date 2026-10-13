import { createElement, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Activity } from '@explivio/shared';
import { theme } from './theme';

// A per-day color so pins group by day (cycles if more days than colors).
const DAY_COLORS = ['#aa3bff', '#ef4444', '#059669', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

interface Point {
  lat: number;
  lng: number;
  name: string;
  day: number;
}

interface Props {
  activities: Activity[];
  days: string[];
}

// Renders activities that have coordinates on a Leaflet + OpenStreetMap map (keyless) inside a WebView
// — react-native-maps would need a native dev build and a Google key, whereas Leaflet-in-a-WebView
// works in Expo Go and matches the web client's keyless map. Markers are colored/numbered by day.
export function ItineraryMap({ activities, days }: Props) {
  const points = useMemo<Point[]>(
    () =>
      activities.flatMap(a => {
        const lat = a.latitude != null ? Number(a.latitude) : NaN;
        const lng = a.longitude != null ? Number(a.longitude) : NaN;
        if (Number.isNaN(lat) || Number.isNaN(lng)) return [];
        const di = days.indexOf(a.date);
        return [{ lat, lng, name: a.name, day: di >= 0 ? di + 1 : 0 }];
      }),
    [activities, days],
  );

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add activities with a location to see them on a map.</Text>
      </View>
    );
  }

  const html = buildHtml(points);

  // react-native-webview has no web implementation, so on the web target render the same Leaflet HTML
  // in a plain iframe (react-native-web renders to the DOM); on native use the WebView.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        {createElement('iframe', {
          srcDoc: html,
          title: 'Itinerary map',
          style: { border: 'none', width: '100%', height: '100%' },
        })}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <WebView originWhitelist={['*']} source={{ html }} style={styles.web} scrollEnabled={false} />
    </View>
  );
}

function buildHtml(points: Point[]): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{height:100%;margin:0;padding:0}
.pin{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;color:#fff;font:700 12px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var COLORS=${JSON.stringify(DAY_COLORS)};
var PTS=${JSON.stringify(points)};
var map=L.map('map',{scrollWheelZoom:false});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);
var ll=[];
PTS.forEach(function(p){
  var c=COLORS[((p.day-1)%COLORS.length+COLORS.length)%COLORS.length];
  var icon=L.divIcon({className:'',html:'<span class="pin" style="background:'+c+'">'+p.day+'</span>',iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-13]});
  L.marker([p.lat,p.lng],{icon:icon}).addTo(map).bindPopup('<b>'+p.name+'</b><br>Day '+p.day);
  ll.push([p.lat,p.lng]);
});
if(ll.length){map.fitBounds(ll,{padding:[30,30],maxZoom:15});if(map.getZoom()<6){map.setView(ll[0],12);}}
</script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { height: 240, marginBottom: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  web: { flex: 1, backgroundColor: '#e5e4e7' },
  empty: {
    marginBottom: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
  },
  emptyText: { color: theme.text, fontSize: 13, textAlign: 'center' },
});
