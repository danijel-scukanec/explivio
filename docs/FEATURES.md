# Explivio — Feature Map & Roadmap

Prioritized feature catalogue for the Explivio showcase. Each feature notes the **capability it demonstrates**, so the roadmap doubles as a map of "what this repo proves I can do."

> ### ⭐ Committed target vs. roadmap
> A half-finished portfolio repo reads worse than a smaller, polished one. The original **committed target** was **all of P0 + F12 + F13**; in practice the build went well beyond it. See the **Done** column for what has actually shipped — **all of P0; F12–F20 in P1; F22, F23, F24, F25, F26, F27, F28, F29, F30, F31, F32 in P2.** The unticked rows are **roadmap: genuinely planned, may not be built** — kept to show direction, not promised.

**Priority tiers**
- **P0 — Foundation:** the distributed/AI spine + core product. Must exist for the showcase to land. **(shipped)**
- **P1 — Showcase:** the features a reviewer stops scrolling for. **(F12–F20 shipped; F21 roadmap)**
- **P2 — Stretch:** breadth once the spine is impressive. **(F22, F23, F24, F25, F26, F27, F28, F29, F30, F31, F32 shipped; rest roadmap)**

Legend for _Proves_: 🧩 distributed-systems · 🤖 AI · 🎨 full-stack · 🛠️ engineering-discipline

---

## Already built (baseline)
| Feature | Status |
|---|---|
| Trips CRUD (user-scoped) | ✅ |
| Itinerary — day-by-day activities + coordinates (Google Places New) | ✅ |
| Budget — expenses + category summary | ✅ |
| Users — register / get | ✅ |
| Web: Trips + Itinerary + Budget UI, shared PlaceSearchInput | ✅ |
| Bicep modules (sql, cosmos, appservice, staticwebapp) | ✅ (to be superseded by Aspire/azd) |
| Mobile: Expo scaffold | ✅ (barebones) |

---

## P0 — Foundation (the spine)

| # | Feature / capability | Proves | Done |
|---|---|---|---|
| F01 | **.NET Aspire** AppHost + ServiceDefaults (orchestration, dashboard, service discovery) | 🧩🛠️ | ✅ |
| F02 | **OpenTelemetry** traces/metrics/logs across all services | 🧩🛠️ | ✅ |
| F03 | Global exception handling + **ProblemDetails**, `Result` error flow | 🛠️ | ✅ |
| F04 | **MediatR pipeline behaviors** (validation, logging) + **boundary idempotency** (`Idempotency-Key` on endpoints, message-id dedupe on consumers) | 🛠️ | ✅ |
| F05 | **Event-driven core** over Azure Service Bus + **transactional outbox** | 🧩 | ✅ |
| F06 | **AI Worker** service (consumes AI jobs) | 🧩🤖 | ✅ |
| F07 | **Notifications Worker** service (consumes domain events) | 🧩 | ✅ |
| F08 | **CQRS read model** — a per-trip dashboard summary in its own SQL `read` schema, kept current by an event-driven projector; **scoped to one feature** to prove the pattern without doubling every write path | 🧩 | ✅ |
| F09 | Health checks, resilience pipelines, rate limiting, API versioning | 🛠️ | ✅ |
| F10 | **Integration tests** with Testcontainers + **GitHub Actions** CI/CD | 🛠️ | ✅ |
| F11 | **azd → Azure Container Apps** deploy from the Aspire model | 🧩🛠️ | ✅ |

## P1 — Showcase

| # | Feature | Proves | Done |
|---|---|---|---|
| F12 | **AI itinerary generation** — prompt → full draft itinerary (agentic tool-calling, structured outputs) | 🤖 | ✅ |
| F13 | **Streaming AI** output to the UI over **SignalR** | 🤖🧩🎨 | ✅ |
| F14 | **RAG** over places/reviews via **Cosmos vector search** | 🤖 | ✅ |
| F15 | **Real-time collaboration** — shared trips, roles, presence, co-editing | 🧩🎨 | ✅ |
| F16 | **AI chat assistant** — natural-language trip Q&A / edits (agentic tool-calling) | 🤖 | ✅ |
| F17 | **Receipt scanning** (vision) → auto expenses | 🤖 | ✅ |
| F18 | **Booking-email parsing** → auto activities (and reservations) | 🤖 | ✅ |
| F19 | **Map view** of activities (coordinates already stored) | 🎨 | ✅ |
| F20 | **Notifications** — in-app + mobile push | 🧩🎨 | ✅ |
| F21 | **AI ops** — GenAI telemetry (token/cost), semantic cache, Content Safety, eval harness | 🤖🛠️ | |

## P2 — Stretch (breadth)

| # | Feature | Proves | Done |
|---|---|---|---|
| F22 | Multi-destination trips (legs/stops), trip status, cover photos | 🎨 | ✅ |
| F23 | Drag-to-reorder itinerary, activity categories, reservations (incl. budget-linked booking costs) | 🎨 | ✅ |
| F24 | Packing lists / checklists, trip documents (Blob) | 🎨 | ✅ |
| F25 | Budget deepening — multi-currency + live FX, split expenses, export | 🎨 | ✅ |
| F26 | Public **trip gallery** + clone/templates, social (follow, share links, likes) | 🎨🧩 | ✅ |
| F27 | Calendar sync (.ics / Google / Outlook), **PDF itinerary** export | 🎨 | ✅ |
| F28 | Per-day weather, timezone/currency awareness | 🎨 | ✅ |
| F29 | Auto **trip recap** with photos (AI summary) | 🤖🎨 | ✅ |
| F30 | **i18n / localization** (en/es/de; web + mobile, locale-aware dates/currency) | 🎨 | ✅ |
| F31 | Mobile feature parity + **offline sync** | 🎨 | ✅ |
| F32 | Feature flags (config-driven); optional **YARP BFF** not built | 🧩 | ✅ |
| P-Auth | **Real auth — Microsoft Entra External ID** (replaces fake dev identity) | 🛠️ | ✅ |

---

## Phased delivery roadmap

Each phase ends in something demoable and independently valuable.

**Phase 1 — Distributed backbone** (F01–F04, F09)
Aspire AppHost + ServiceDefaults, OpenTelemetry, ProblemDetails, MediatR behaviors, health/resilience. _Outcome:_ the existing API runs under Aspire with the dashboard, full observability, clean cross-cutting.

**Phase 2 — Eventing & workers** (F05–F08, F10, F11)
Service Bus + outbox, AI + Notifications workers, first CQRS read model, Testcontainers tests, CI/CD, deploy to Container Apps. _Outcome:_ a genuinely distributed, deployed system with events flowing end-to-end.

**Phase 3 — AI spine** (F12–F14, F16, F21)
Microsoft.Extensions.AI + Semantic Kernel, agentic itinerary generation with structured outputs, RAG over Cosmos vectors, streaming over SignalR, AI observability. _Outcome:_ the headline AI demo.

**Phase 4 — Collaboration & real-time** (F15, F20)
Shared trips, roles, presence, co-editing, notifications. _Outcome:_ multiplayer trip planning.

**Phase 5 — Multimodal & breadth** (F17–F19, F22–F31)
Receipt/email parsing, map view, then product breadth as time allows.

**Phase 6 — Harden & auth** (P-Auth, F32, polish)
Entra External ID, feature flags, docs/README polish for the portfolio.

---

## Deferred / explicitly noted
- **Real auth is deferred** — fake dev identity today; wire **Entra External ID** in Phase 6. (Azure AD B2C is on a deprecation path for new tenants.)
- The existing hand-written **Bicep modules** will be superseded by the Aspire-generated deployment model (kept until F11 lands).
- **F15 member-management UI — SHIPPED (web) 2026-10-28, now that P-Auth landed.** A **Members** panel on the trip lets an Owner **invite by email**, change roles (Owner/Editor/Viewer) and remove members; everyone else sees a read-only list. Backed by `POST /trips/{id}/members/invite` (resolves an existing account by email), `GET /trips/{id}/members/me` (the caller's role, for Owner-gating), and email on the members list. A **pending-invite** flow for people who haven't signed up yet is a deliberate follow-up. (Mobile member UI not yet built.)
- **F26 shipped gallery + share links + clone/templates + likes; "follow" is deferred to P-Auth.** Likes, share links, cloning and the public gallery (an event-driven `TripPopularity` read model) all work on the dev identity. A follow/social graph needs a real user directory, so it waits on Entra External ID — the same reason the F15 member UI does.
- **P-Auth shipped (2026-10-28).** A **Microsoft Entra External ID** (CIAM) tenant validates bearer tokens on the API; web signs in via **MSAL** and mobile via **expo-auth-session** (PKCE). It's **coexistence, env-gated** — real auth turns on only when the client env vars are set, otherwise the fast dev identity still drives local work and the integration tests. Web sign-in is **verified end-to-end** (register → login → authenticated app); mobile sign-in is now **verified end-to-end on an EAS Android dev build** (2026-10-29 — sign-in → `explivio://auth` redirect → trips load; Expo Go can't use the custom-scheme redirect). This **unblocks** the F15 member-management UI, F26 follow, and F25 split-expense UI noted above — now buildable on real identities.
- **F20 shipped in-app notifications; mobile push is deferred to a follow-up.** Trip changes (activity/expense add + remove, status change) notify the trip's other members through the Notifications Worker (outbox → Service Bus → `read.Notifications`), surfaced as a 🔔 bell with an unread badge on web + mobile. **Push notifications** — an OS-level alert when the app is closed — are **not built yet**; the pipeline already produces the message and recipients, so a follow-up adds Expo push-token registration + a sender in the worker (and, separately, web push). Tracked as the remaining half of F20.
- **F25 split-expense UI — now REACHABLE (2026-10-28).** The budget split feature (split among trip members, settle-up balances) was already built on the web (`AddExpenseModal` split form, `BalancesPanel`), gated behind a trip having 2+ members. With the F15 member UI shipped, Owners can add members, so UI-reachable splitting is now live — no new code needed. F25's multi-currency + live FX and CSV/PDF export were already usable without members.
