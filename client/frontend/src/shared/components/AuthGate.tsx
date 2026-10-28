import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth';
import './AuthGate.css';

// P-Auth: wraps the app when Entra auth is enabled. Signed-out users see a sign-in screen; signed-in
// users get the app plus a small account chip to sign out. When auth is disabled this component isn't
// rendered at all (see main.tsx), so the dev-identity flow is untouched.
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { instance, accounts } = useMsal();
  const name = accounts[0]?.name ?? accounts[0]?.username ?? '';

  return (
    <>
      <AuthenticatedTemplate>
        <div className="auth-chip">
          {name && <span className="auth-chip__name">{name}</span>}
          <button
            className="auth-chip__btn"
            onClick={() => instance.logoutRedirect()}
          >
            {t('auth.signOut')}
          </button>
        </div>
        {children}
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <div className="auth-signin">
          <div className="auth-signin__card">
            <h1 className="auth-signin__brand">Explivio</h1>
            <p className="auth-signin__hint">{t('auth.hint')}</p>
            <button
              className="auth-signin__btn"
              onClick={() => instance.loginRedirect(loginRequest)}
            >
              {t('auth.signIn')}
            </button>
          </div>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
