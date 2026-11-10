# 0007 — Microsoft Entra External ID for authentication (env-gated coexistence)

- **Status:** Accepted
- **Date:** 2026-10-28
- **Supersedes:** [0004](0004-defer-authentication.md)

## Context
[ADR 0004](0004-defer-authentication.md) deferred real auth behind a Development-only fake identity so the distributed + AI work could go first. That work is done, and features like trip sharing/roles, the public gallery, and follow/social need a **real user directory** (stable user ids, display names, emails) to be meaningful. The endpoints already read a `sub` claim over JWT bearer, so the seam exists.

Two forces pull in opposite directions:
- The fast local inner loop and the integration tests rely on the zero-friction dev identity (`X-Dev-User`); losing it would slow every run.
- The showcase needs to demonstrate a real, modern identity integration end to end on web **and** mobile.

## Decision
Adopt **Microsoft Entra External ID** (CIAM — the successor to Azure AD B2C, which is on a deprecation path for new tenants) as the real identity provider, as **env-gated coexistence** rather than a hard cutover:

- The API validates **JWT bearer** tokens from the Entra tenant. Web signs in via **MSAL**, mobile via **expo-auth-session** (PKCE + a custom-scheme redirect).
- A single **external→internal identity seam** (`CurrentUserResolutionMiddleware`) maps the token's `(provider, subject)` to an internal `User.Id` via a `UserExternalLogins` table, provisioning a user on first sign-in (JIT) and claiming any pending email invites. Everything downstream works purely in internal ids and never sees a provider detail — adding "sign in with Google" later is a new provider value here, nothing more.
- **Real auth turns on only when the client env vars (`*_ENTRA_*`) are set.** Unset, the app keeps the Development fake identity, so local work and the Testcontainers integration tests need no tenant.

## Consequences
- **+** A genuine, modern CIAM integration on both platforms, verified end to end (web register→login; mobile on an EAS dev build).
- **+** The dev identity survives as a fallback, so the inner loop and tests stay fast and tenant-free.
- **+** Provider-agnostic internals — a second identity provider is additive.
- **−** Two code paths (real vs dev) to keep honest; the dev path must never be reachable in a real environment (gated on `Development` + the env vars).
- **−** Mobile needs a dev/EAS build for the custom-scheme redirect — Expo Go's proxy URL can't be used.

## Alternatives considered
- **Hard cutover to Entra everywhere** — rejected: would make every local run and CI job depend on a live tenant, for no showcase benefit.
- **Azure AD B2C** — rejected: on a deprecation path for new tenants (same reasoning as ADR 0004).
- **Roll-your-own / ASP.NET Identity** — rejected: more code to own and less of a "real-world integration" signal than a managed CIAM.
