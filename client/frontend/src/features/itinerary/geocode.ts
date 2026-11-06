import { importLibrary } from '@googlemaps/js-api-loader';

// Resolve a city name for coordinates, used when offering to add an off-route activity's city as a
// stop. The Google API key/options are configured once by PlaceSearchInput (imported app-wide), so we
// only import the geocoding library here. Best-effort: returns null on any failure and the caller
// falls back to parsing the activity's address text.
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  try {
    // Time-box it: if the key lacks the Geocoding API the SDK can hang rather than reject, which would
    // otherwise leave the "Add to route" action stuck. On timeout we return null and the caller parses
    // the address instead.
    const lookup = (async () => {
      const { Geocoder } = await importLibrary('geocoding');
      const geocoder = new Geocoder();
      const { results } = await geocoder.geocode({ location: { lat, lng } });
      for (const type of ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1']) {
        for (const r of results) {
          const comp = r.address_components?.find(c => c.types.includes(type));
          if (comp) return comp.long_name;
        }
      }
      return null;
    })();
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
    return await Promise.race([lookup, timeout]);
  } catch {
    /* geocoding unavailable — caller falls back to parsing the address */
    return null;
  }
}

// Fallback: pull a plausible city from a formatted address like "Street 1, 10117 Berlin, Germany".
export function cityFromAddress(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // The second-to-last part is usually "<postcode> <city>" (country is last); strip the postcode.
  const seg = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const city = seg.replace(/\b\d{3,}\b/g, '').trim();
  return city || null;
}
