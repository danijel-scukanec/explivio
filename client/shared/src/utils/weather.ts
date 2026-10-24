import { getLocale } from './locale';

// F28: shared weather presentation used by both web and mobile so the icons and labels match.

// A WMO weather code (returned by Open-Meteo) grouped into an emoji icon and an i18n label key under
// `conditions.wmo.*`. The caller translates the key; this keeps the mapping in one place and free of
// any UI framework.
export interface WeatherInfo {
  icon: string;
  labelKey: string;
}

// WMO code → bucket. Codes are grouped (e.g. all rain intensities share one bucket) so the UI stays
// legible; see https://open-meteo.com/en/docs for the full code table.
export function weatherCodeInfo(code: number): WeatherInfo {
  if (code === 0) return { icon: '☀️', labelKey: 'conditions.wmo.clear' };
  if (code === 1) return { icon: '🌤', labelKey: 'conditions.wmo.mostlyClear' };
  if (code === 2) return { icon: '⛅', labelKey: 'conditions.wmo.partlyCloudy' };
  if (code === 3) return { icon: '☁️', labelKey: 'conditions.wmo.overcast' };
  if (code === 45 || code === 48) return { icon: '🌫', labelKey: 'conditions.wmo.fog' };
  if (code >= 51 && code <= 57) return { icon: '🌦', labelKey: 'conditions.wmo.drizzle' };
  if (code >= 61 && code <= 67) return { icon: '🌧', labelKey: 'conditions.wmo.rain' };
  if (code >= 71 && code <= 77) return { icon: '🌨', labelKey: 'conditions.wmo.snow' };
  if (code >= 80 && code <= 82) return { icon: '🌦', labelKey: 'conditions.wmo.showers' };
  if (code === 85 || code === 86) return { icon: '🌨', labelKey: 'conditions.wmo.snowShowers' };
  if (code >= 95) return { icon: '⛈', labelKey: 'conditions.wmo.thunderstorm' };
  return { icon: '🌡', labelKey: 'conditions.wmo.unknown' };
}

// The current wall-clock time at a destination, given its UTC offset in seconds. We shift "now" by
// the offset and format the result as if it were UTC, so the output is the destination's local time
// regardless of the viewer's own time zone.
export function formatLocalTime(utcOffsetSeconds: number): string {
  const shifted = new Date(Date.now() + utcOffsetSeconds * 1000);
  return shifted.toLocaleTimeString(getLocale() ?? 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

// A UTC offset in seconds as a compact label, e.g. "UTC+1", "UTC-4:30".
export function formatUtcOffset(utcOffsetSeconds: number): string {
  const sign = utcOffsetSeconds < 0 ? '-' : '+';
  const abs = Math.abs(utcOffsetSeconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  return `UTC${sign}${hours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''}`;
}
