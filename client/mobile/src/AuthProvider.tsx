import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as AuthSession from 'expo-auth-session';
import { useAuthRequest, useAutoDiscovery, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authEnabled, entraConfig, authScopes, setTokens, setDiscovery } from './auth';

// Dismisses the auth browser once the redirect completes (also required for web).
WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  isAuthenticated: boolean;
  ready: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  ready: true,
  signIn: () => {},
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Custom-scheme redirect, matching the native app registration (explivio://auth). NOTE: in Expo Go
// this resolves to an exp:// proxy URL instead, so sign-in needs a dev build (or that proxy URI added
// to the app registration) — see mobile AGENTS.md / the P-Auth notes.
const redirectUri = makeRedirectUri({ scheme: 'explivio', path: 'auth' });

// Public entry point. Only mount the Entra machinery when auth is actually configured; otherwise
// fall through to the default context (dev-identity mode — no identity header, API treats the
// request as the dev user). `authEnabled` is a module constant, so this branch is stable across
// renders — no rules-of-hooks concern — and it keeps expo-auth-session's hooks from ever running
// with an empty issuer: useAutoDiscovery('') rejects with "Expected a valid discovery object or
// issuer URL" and would otherwise crash the app on a clone without the EXPO_PUBLIC_ENTRA_* vars.
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!authEnabled) return <>{children}</>;
  return <EntraAuthProvider>{children}</EntraAuthProvider>;
}

function EntraAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Safe here: EntraAuthProvider only mounts when authEnabled, so authority/clientId are present.
  const discovery = useAutoDiscovery(entraConfig.authority ?? '');
  const [request, response, promptAsync] = useAuthRequest(
    { clientId: entraConfig.clientId ?? '', scopes: authScopes, redirectUri, usePKCE: true },
    discovery,
  );

  useEffect(() => {
    setDiscovery(discovery);
  }, [discovery]);

  useEffect(() => {
    if (response?.type !== 'success' || !response.params.code || !discovery || !request) return;
    AuthSession.exchangeCodeAsync(
      {
        clientId: entraConfig.clientId ?? '',
        code: response.params.code,
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
        scopes: authScopes,
      },
      discovery,
    )
      .then((result) => {
        setTokens(result);
        setIsAuthenticated(true);
      })
      .catch(() => {});
  }, [response, discovery, request]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      ready: Boolean(request),
      signIn: () => {
        void promptAsync();
      },
      signOut: () => {
        setTokens(null);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated, request, promptAsync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { authEnabled };
