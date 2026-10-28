// P-Auth: Microsoft Entra External ID sign-in for the mobile app, with a dev-identity fallback.
//
// Coexistence: real auth turns on ONLY when the EXPO_PUBLIC_ENTRA_* env vars are set. Without them
// `authEnabled` is false and the app sends no identity header — the dev API treats requests as the
// default dev user, exactly as before. With them set, requests carry a real `Authorization: Bearer`
// token (acquired via expo-auth-session PKCE) that the backend validates against the tenant.
import * as AuthSession from 'expo-auth-session';

const clientId = process.env.EXPO_PUBLIC_ENTRA_CLIENT_ID;
const authority = process.env.EXPO_PUBLIC_ENTRA_AUTHORITY;
const apiScope = process.env.EXPO_PUBLIC_ENTRA_API_SCOPE;

/** True only when all three Entra settings are present — otherwise we stay on the dev identity. */
export const authEnabled = Boolean(clientId && authority && apiScope);

export const entraConfig = { clientId, authority, apiScope };

/** openid/profile/offline_access (for refresh) plus the API's delegated scope. */
export const authScopes = apiScope ? ['openid', 'profile', 'offline_access', apiScope] : [];

// Module-level token + discovery so the plain fetch primitive (rawSend) and the SignalR hooks can read
// the current token without being React hooks. The AuthProvider keeps these up to date.
let tokens: AuthSession.TokenResponse | null = null;
let discovery: AuthSession.DiscoveryDocument | null = null;

export function setTokens(next: AuthSession.TokenResponse | null): void {
  tokens = next;
}
export function setDiscovery(next: AuthSession.DiscoveryDocument | null): void {
  discovery = next;
}
export function hasTokens(): boolean {
  return tokens !== null;
}

/** A fresh access token, refreshing via the refresh token near expiry. null when unavailable. */
export async function getAccessToken(): Promise<string | null> {
  if (!authEnabled || !tokens || !clientId) return null;
  if (tokens.shouldRefresh() && tokens.refreshToken && discovery?.tokenEndpoint) {
    try {
      tokens = await AuthSession.refreshAsync(
        { clientId, refreshToken: tokens.refreshToken, scopes: authScopes },
        discovery,
      );
    } catch {
      tokens = null;
      return null;
    }
  }
  return tokens?.accessToken ?? null;
}

/** SignalR access-token factory value (hubs validate the bearer token like REST). Empty when disabled. */
export async function hubAccessToken(): Promise<string> {
  if (!authEnabled) return '';
  return (await getAccessToken()) ?? '';
}
