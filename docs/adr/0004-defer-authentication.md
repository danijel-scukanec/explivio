# 0004 — Defer real authentication (fake dev identity for now)

- **Status:** Accepted
- **Date:** 2026-08-17

## Context
Explivio needs user-scoped data, but wiring a real identity provider early adds tenant setup, token flows, and friction that slows the distributed + AI work that is the actual showcase. The endpoints already read a `sub` claim and use JWT bearer.

## Decision
**Defer real auth.** In Development, inject a **fake identity** (`sub = 00000000-0000-0000-0000-000000000001`) so `RequireAuthorization()` passes. Keep the JWT-bearer seam in place so switching to a real provider is a configuration + middleware change, not a rewrite. When resumed, integrate **Microsoft Entra External ID** (the successor to Azure AD B2C, which is on a deprecation path for new tenants).

## Consequences
- **+** Full focus on the distributed/AI spine; user-scoping code is exercised throughout.
- **+** The seam is real, so auth is a swap-in later, not a redesign.
- **−** No real authn/authz until Phase 6; must be **clearly documented as deliberate** so it doesn't read as missing.
- **−** The fake identity must be strictly Development-only (never shipped to a real environment).

## Alternatives considered
- **Azure AD B2C now** — rejected: on a deprecation path for new tenants; would be built to be replaced.
- **Entra External ID now** — deferred, not rejected: right target, wrong time given showcase priorities.
