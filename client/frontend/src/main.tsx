import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import './i18n' // F30: initialise i18next before the app renders
import App from './App.tsx'
import { authEnabled, msalInstance, initAuth } from './shared/auth'
import { AuthGate } from './shared/components/AuthGate'
import { ErrorBoundary } from './shared/components/ErrorBoundary'

// P-Auth: when Entra auth is configured (VITE_ENTRA_* set), initialise MSAL, then render the app
// behind the sign-in gate. Otherwise render the app directly — the dev-identity flow is unchanged.
async function bootstrap() {
  // initAuth swallows its own failures, but guard anyway: nothing here may stop React from mounting,
  // or the user is left staring at a blank white screen.
  if (authEnabled) await initAuth().catch(e => console.error('Auth bootstrap failed', e))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        {authEnabled && msalInstance ? (
          <MsalProvider instance={msalInstance}>
            <AuthGate>
              <App />
            </AuthGate>
          </MsalProvider>
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
