import { Redirect } from 'expo-router';

// P-Auth: the Entra sign-in redirect lands here (explivio://auth). The PKCE token exchange is done
// in AuthProvider off the expo-web-browser auth-session result — independent of routing — so this
// route exists only so the redirect deep link resolves to a real screen instead of expo-router's
// "Unmatched Route" page, then immediately bounces to the app root. AuthGate shows the sign-in
// overlay there if the exchange hasn't flipped isAuthenticated yet.
export default function AuthRedirect() {
  return <Redirect href="/" />;
}
