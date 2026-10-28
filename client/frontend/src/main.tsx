import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import './i18n' // F30: initialise i18next before the app renders
import App from './App.tsx'
import { authEnabled, msalInstance, initAuth } from './shared/auth'
import { AuthGate } from './shared/components/AuthGate'

// P-Auth: when Entra auth is configured (VITE_ENTRA_* set), initialise MSAL, then render the app
// behind the sign-in gate. Otherwise render the app directly — the dev-identity flow is unchanged.
async function bootstrap() {
  if (authEnabled) await initAuth()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {authEnabled && msalInstance ? (
        <MsalProvider instance={msalInstance}>
          <AuthGate>
            <App />
          </AuthGate>
        </MsalProvider>
      ) : (
        <App />
      )}
    </StrictMode>,
  )
}

void bootstrap()
