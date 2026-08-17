# Architecture Decision Records

Short records of the significant, hard-to-reverse decisions behind Explivio — the *why*, not just the *what*. Format is lightweight [MADR](https://adr.github.io/madr/).

| # | Decision | Status |
|---|---|---|
| [0001](0001-modular-monolith-with-vertical-slices.md) | Modular monolith with vertical slices (not microservices) | Accepted |
| [0002](0002-transactional-outbox-for-eventing.md) | Transactional outbox for reliable event publishing | Accepted |
| [0003](0003-adopt-dotnet-aspire.md) | Adopt .NET Aspire as orchestration/deploy backbone | Accepted |
| [0004](0004-defer-authentication.md) | Defer real authentication (fake dev identity for now) | Accepted |

New ADR: copy the structure of an existing one, take the next number, start at status **Proposed**.
