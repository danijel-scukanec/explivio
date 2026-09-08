using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Itinerary;

// F08: raised when an activity is added to a trip, so the read-model projector can bump the
// trip's ActivityCount.
public sealed record ActivityAddedDomainEvent(Guid TripId, Guid ActivityId) : IDomainEvent;
