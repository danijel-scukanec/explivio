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

export interface IdentityClaims {
  name?: string;
  email?: string;
}

// Decode an ID token's claims for display (name/email). Self-contained base64url+UTF-8 decoder so it
// works in Hermes/Expo Go without depending on atob/TextDecoder. Never throws — returns null on any
// problem. This is for DISPLAY ONLY; the backend validates the token's signature, not this code.
export function decodeIdToken(idToken: string | undefined): IdentityClaims | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(utf8(base64ToBytes(payload.replace(/-/g, '+').replace(/_/g, '/')))) as Record<string, unknown>;
    const name = typeof claims.name === 'string' ? claims.name : undefined;
    const email =
      typeof claims.email === 'string' ? claims.email :
      typeof claims.preferred_username === 'string' ? claims.preferred_username :
      undefined;
    return { name, email };
  } catch {
    return null;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): number[] {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = B64.indexOf(clean[i]);
    const e2 = B64.indexOf(clean[i + 1]);
    const e3 = B64.indexOf(clean[i + 2]);
    const e4 = B64.indexOf(clean[i + 3]);
    bytes.push((e1 << 2) | (e2 >> 4));
    if (e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== -1) bytes.push(((e3 & 3) << 6) | e4);
  }
  return bytes;
}

function utf8(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return out;
}
