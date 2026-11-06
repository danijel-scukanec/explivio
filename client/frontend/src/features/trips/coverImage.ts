// Deterministic default covers for trips. Both the home-page trip cards and the trip hero share these
// so a trip without an uploaded photo looks the same wherever it appears. The seed is the trip id, so a
// given trip always gets the same colour/photo while different trips get different ones.

function hashSeed(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

// A trip-derived two-tone gradient. This is the default cover for trips with no uploaded photo (so each
// trip gets its own colour), used by both the home trip cards and the trip hero. It also shows behind an
// uploaded photo that can't load (offline, blocked).
export function defaultCoverGradient(seed: string): string {
  const h = hashSeed(seed) % 360;
  return `linear-gradient(135deg, hsl(${h} 62% 42%), hsl(${(h + 48) % 360} 58% 28%))`;
}
