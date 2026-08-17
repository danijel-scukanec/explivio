# 0003 — Adopt .NET Aspire as orchestration/deploy backbone

- **Status:** Accepted
- **Date:** 2026-08-17

## Context
The system spans several processes (API + 2 workers) and backing resources (SQL, Cosmos, Service Bus, Redis, Blob, Azure OpenAI). This needs a coherent local inner-loop and a path to cloud deployment without hand-maintaining a pile of docker-compose + Bicep glue.

## Decision
Use **.NET Aspire**: an **AppHost** to orchestrate services + resources locally (with the dashboard for traces/logs), and a shared **ServiceDefaults** library for OpenTelemetry, health checks, resilience, and service discovery. Deploy with **`azd`** to **Azure Container Apps**, generating/augmenting Bicep from the Aspire application model.

## Consequences
- **+** One model drives local dev, observability wiring, and cloud deploy — strong modern-.NET signal.
- **+** OpenTelemetry and resilience come consistently to every service via ServiceDefaults.
- **−** Aspire moves fast; pin versions and verify against current docs before upgrading.
- **−** Some Azure-resource control is abstracted; drop to raw Bicep where finer control is needed.

## Alternatives considered
- **docker-compose + hand-written Bicep** — rejected: more glue, weaker dev experience, no unified model.
- **Plain App Service + manual wiring** (prior approach) — superseded by this decision.
