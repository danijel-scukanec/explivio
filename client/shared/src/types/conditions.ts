import type { components } from '../generated/api';

// F28: destination conditions for a trip — per stop: time zone, local currency + live rate, per-day
// weather. Ties together per-day weather, time-zone awareness and currency awareness.
export type TripConditions = components['schemas']['TripConditionsResponse'];
export type StopConditions = components['schemas']['StopConditions'];
export type DailyConditions = components['schemas']['DailyConditions'];
// "Forecast" | "Seasonal" — a live forecast vs. a historical estimate for far-future dates.
export type WeatherSource = components['schemas']['WeatherSource'];
