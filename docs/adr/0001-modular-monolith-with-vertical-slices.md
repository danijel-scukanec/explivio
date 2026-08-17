# 0001 — Modular monolith with vertical slices (not microservices)

- **Status:** Accepted
- **Date:** 2026-08-17

## Context
Explivio must demonstrate distributed-systems competence, which tempts a microservices split. But it is a solo-built showcase; premature service boundaries mean distributed transactions, network failure modes, and deployment overhead with no real scaling need — and reviewers read that as cargo-culting.

## Decision
Build the core as a **modular monolith** (the API) using **vertical slices** — each feature owns its Command/Query + Handler + Validator. Split out **only** the components with a genuine independent-scaling or isolation reason: the **AI Worker** and **Notifications Worker**. Communication with those is via events over a message broker.

## Consequences
- **+** Clear module seams; could be extracted to services later if warranted.
- **+** Simple inner-loop and deployment; distributed patterns (events, outbox, workers) are still demonstrated where they're justified.
- **−** The API is a single deployable — must keep module boundaries disciplined (features must not reach into each other's internals).

## Alternatives considered
- **Full microservices** — rejected: complexity without payoff for this scope.
- **Layered monolith** — rejected: weaker feature cohesion; less clear seams for future extraction.
