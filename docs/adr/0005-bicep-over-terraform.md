# 0005 — Bicep + azd for infrastructure (not Terraform)

- **Status:** Accepted
- **Date:** 2026-09-25

## Context
Explivio deploys to Azure Container Apps from the .NET Aspire application model (see [0003](0003-adopt-dotnet-aspire.md)). We need an infrastructure-as-code approach for the API, both workers, Azure SQL, Service Bus, and Application Insights. Terraform is the obvious alternative to Azure's native Bicep + `azd`.

## Decision
Use **Bicep**, generated and deployed by **`azd`** from the Aspire manifest. The `AppHost` is the single source of truth: `azd up` reads the manifest it emits, generates the Bicep, compiles it to ARM, and provisions Azure Container Apps. No infrastructure is hand-written (`azd infra synth` can materialise the generated Bicep into the repo when finer control is needed).

## Consequences
- **+** Aspire → azd auto-generates the infrastructure — one model (`AppHost.cs`) drives local dev and cloud deploy, kept in sync automatically.
- **+** No Terraform state file/backend/locking to operate — ARM is the source of truth in Azure; fits the deploy-on-demand `azd up`/`azd down` posture.
- **+** Azure-native: new resources/properties supported day one, no provider lag; reinforces the modern-.NET portfolio story.
- **−** Azure-locked — no multi-cloud portability (acceptable: Explivio is Azure-only).
- **−** Tied to Aspire's Bicep generation; azd's Terraform provider exists but does **not** get the Aspire auto-generation, so switching would mean hand-writing all the HCL.

## Alternatives considered
- **Terraform** — rejected here: its main strength (multi-cloud, huge provider ecosystem) is unused on an Azure-only app, it adds state-management overhead, and it forfeits Aspire's Bicep auto-generation. Would be the right call for a multi-cloud system or a team already standardised on Terraform.
- **Hand-written Bicep** (prior `infra/*.bicep`, App Service topology) — superseded: redundant now that azd generates the Container Apps infrastructure from the Aspire model.
