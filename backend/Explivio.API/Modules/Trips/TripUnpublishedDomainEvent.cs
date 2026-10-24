using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F26: raised when a public trip is made private again — the gallery read model flips it out of the
// gallery but keeps its like count, so re-publishing restores it.
public sealed record TripUnpublishedDomainEvent(Guid TripId) : IDomainEvent;
