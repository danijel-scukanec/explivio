using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F26: raised when a user likes a (public) trip. The gallery read model increments the like count —
// a non-idempotent projection, so it relies on the projector's exactly-once inbox dedupe.
public sealed record TripLikedDomainEvent(Guid TripId) : IDomainEvent;
