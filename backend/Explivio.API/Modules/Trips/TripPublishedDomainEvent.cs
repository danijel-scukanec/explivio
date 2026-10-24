using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F26: raised when a trip is made public (added to the gallery). Carries the denormalized state the
// gallery read model (TripPopularity) needs, so the projector builds the gallery row from the event
// alone — event-carried state, the same pattern as TripCreatedDomainEvent.
public sealed record TripPublishedDomainEvent(
    Guid TripId,
    Guid OwnerUserId,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    bool HasCoverPhoto) : IDomainEvent;
