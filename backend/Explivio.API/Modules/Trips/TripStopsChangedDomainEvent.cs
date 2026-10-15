using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F22: raised when a trip's stops are replaced, so the read-model projector can refresh the
// denormalized destination summary on its TripSummary. Carries the already-derived summary (event-
// carried state) so the projector needn't query back into the write model. The AI/notification
// workers receive it on their subscriptions and ignore it (no matching case) — only the projector
// cares.
public sealed record TripStopsChangedDomainEvent(Guid TripId, string Destination) : IDomainEvent;
