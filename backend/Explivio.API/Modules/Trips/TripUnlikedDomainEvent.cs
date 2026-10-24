using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F26: raised when a user removes their like from a trip. The gallery read model decrements the count.
public sealed record TripUnlikedDomainEvent(Guid TripId) : IDomainEvent;
