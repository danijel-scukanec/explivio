# 0002 — Transactional outbox for reliable event publishing

- **Status:** Accepted
- **Date:** 2026-08-17

## Context
Domain changes (e.g. `TripCreated`, `ExpenseAdded`) trigger side-effects handled asynchronously by workers. Writing to the database and then publishing to the broker as two separate steps is the classic dual-write problem: a crash between them loses or duplicates events.

## Decision
Use the **transactional outbox pattern**. The state change and an outbox row are written in the **same database transaction**; a relay publishes outbox rows to **Azure Service Bus**. Consumers are **idempotent** (dedupe on message id), giving an at-least-once delivery with exactly-once *effect*.

## Consequences
- **+** No lost or phantom events; the reliability story is honest and demonstrable.
- **+** Natural fit with the event-driven workers and the single CQRS read model.
- **−** Extra moving part (outbox table + relay) and the discipline of idempotent consumers.
- **−** Ordering is best-effort; handlers must not assume strict global order.

## Alternatives considered
- **Direct publish after commit** — rejected: dual-write data loss risk.
- **Change Data Capture / Debezium** — rejected: heavier infra than this showcase warrants.
