import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth';
import { disableWebPush } from '../push/webPush';
import { Button } from '@/components/ui/button';

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
        <div className="bg-background fixed top-2.5 right-3 z-[1000] flex items-center gap-2 rounded-full py-1 pr-1.5 pl-3 text-sm shadow-md">
          {name && <span className="text-muted-foreground max-w-40 truncate">{name}</span>}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              // F20 (web push): drop this browser's subscription so it stops receiving the
              // signed-out user's notifications. Best-effort — never block sign-out on it.
              await disableWebPush().catch(() => undefined);
              await instance.logoutRedirect();
            }}
          >
            {t('auth.signOut')}
          </Button>
        </div>
        {children}
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="bg-card w-full max-w-[360px] rounded-xl p-8 text-center shadow-xl">
            <h1 className="text-foreground mb-2 text-3xl font-semibold">Explivio</h1>
            <p className="text-muted-foreground mb-6">{t('auth.hint')}</p>
            <Button className="w-full" size="lg" onClick={() => instance.loginRedirect(loginRequest)}>
              {t('auth.signIn')}
            </Button>
          </div>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
