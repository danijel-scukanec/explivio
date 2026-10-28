// P-Auth: Microsoft Entra External ID sign-in for the web app, with a dev-identity fallback.
//
// Coexistence: real auth turns on ONLY when the VITE_ENTRA_* env vars are set (see .env.example).
// Without them `authEnabled` is false and the app behaves exactly as before — the dev-identity
// X-Dev-User header (and ?devUser= on hubs) still drives local work and two-browser impersonation.
// With them set, API calls carry a real `Authorization: Bearer <token>` acquired via MSAL, and the
// backend validates it against the same tenant (CurrentUserResolutionMiddleware maps it to a user).
import {
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
  type RedirectRequest,
} from '@azure/msal-browser';
import { withDevUser, devUserQuery } from './devUser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
const authority = import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined;

/** True only when all three Entra settings are present — otherwise we stay on the dev identity. */
export const authEnabled = Boolean(clientId && authority && apiScope);

const msalConfig: Configuration | null = authEnabled
  ? {
      auth: {
        clientId: clientId!,
        authority: authority!,
        // CIAM authorities aren't under login.microsoftonline.com, so MSAL requires the host here.
        knownAuthorities: [new URL(authority!).host],
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage' },
    }
  : null;

export const msalInstance = msalConfig ? new PublicClientApplication(msalConfig) : null;

/** The scopes we request — the API's delegated scope (MSAL adds openid/profile/offline_access). */
export const loginRequest: RedirectRequest = { scopes: apiScope ? [apiScope] : [] };

let initialized = false;

/** Initialise MSAL and complete any redirect sign-in. Call once before rendering. No-op if disabled. */
export async function initAuth(): Promise<void> {
  if (!msalInstance || initialized) return;
  await msalInstance.initialize();
  const result = await msalInstance.handleRedirectPromise();
  if (result?.account) {
    msalInstance.setActiveAccount(result.account);
  } else if (!msalInstance.getActiveAccount()) {
    const [first] = msalInstance.getAllAccounts();
    if (first) msalInstance.setActiveAccount(first);
  }
  initialized = true;
}

function activeAccount(): AccountInfo | null {
  return msalInstance?.getActiveAccount() ?? msalInstance?.getAllAccounts()[0] ?? null;
}

/**
 * A fresh access token for the API, or null when unavailable. Silent from the MSAL cache; if the
 * token needs interaction (expired session, consent) it falls back to a redirect sign-in.
 */
async function getAccessToken(): Promise<string | null> {
  if (!msalInstance || !apiScope) return null;
  const account = activeAccount();
  if (!account) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: [apiScope], account });
    return result.accessToken;
  } catch {
    await msalInstance.acquireTokenRedirect({ scopes: [apiScope], account });
    return null;
  }
}

/**
 * Auth headers for a REST call. Real bearer token when Entra auth is configured, otherwise the
 * dev-identity X-Dev-User header — so every call site works in both modes with a single `await`.
 */
export async function authHeaders(
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  if (!authEnabled) return withDevUser(headers);
  const token = await getAccessToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

/** SignalR access-token factory value (hubs validate the bearer token like REST). Empty when disabled. */
export async function hubAccessToken(): Promise<string> {
  if (!authEnabled) return '';
  return (await getAccessToken()) ?? '';
}

// Re-exported for the hub hooks' dev path (?devUser= when auth is off).
export { devUserQuery };
