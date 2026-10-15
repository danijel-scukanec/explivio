import { useEffect, useState } from 'react';

const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5298'}/v1`;

// F32: the server's feature-flag states (name -> enabled), from GET /features. Unknown/missing flags
// are treated as ON by callers, so a fetch failure degrades to showing everything rather than hiding
// the app. Fetched once and shared across components via a module-level promise.
export type FeatureFlags = Record<string, boolean>;

let cache: Promise<FeatureFlags> | null = null;

function loadFeatures(): Promise<FeatureFlags> {
  cache ??= fetch(`${API_URL}/features`)
    .then(res => (res.ok ? res.json() : {}))
    .catch(() => ({} as FeatureFlags));
  return cache;
}

export function useFeatures(): FeatureFlags {
  const [features, setFeatures] = useState<FeatureFlags>({});
  useEffect(() => {
    let active = true;
    loadFeatures().then(f => { if (active) setFeatures(f); });
    return () => { active = false; };
  }, []);
  return features;
}

// A flag is "on" unless the server explicitly reports it false (so unloaded/unknown = on).
export const isFeatureOn = (features: FeatureFlags, name: string): boolean => features[name] !== false;
