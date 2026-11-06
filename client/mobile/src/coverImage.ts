// A stable, trip-derived cover colour — the default banner for a trip card when there's no uploaded
// photo, so each trip gets its own colour. Mirrors the web app's hue-from-id cover gradient (mobile
// uses a solid colour to avoid pulling in a gradient dependency).
export function coverColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360}, 62%, 45%)`;
}
