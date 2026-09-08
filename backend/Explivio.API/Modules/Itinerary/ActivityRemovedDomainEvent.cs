using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Itinerary;

// F08: raised when an activity is removed from a trip, so the read-model projector can decrement
// the trip's ActivityCount.
public sealed record ActivityRemovedDomainEvent(Guid TripId, Guid ActivityId) : IDomainEvent;
