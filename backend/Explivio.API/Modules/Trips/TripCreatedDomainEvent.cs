using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F05: raised when a trip is created. F06 (AI suggestions) and F07 (notifications) react to it.
// F08: enriched to carry the full trip so the read-model projector can build a TripSummary from
// the event alone (event-carried state) without querying back into the write model. The workers
// only read TripId/Destination/UserId and ignore the extra properties, so they are unaffected.
public sealed record TripCreatedDomainEvent(
    Guid TripId,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    Guid UserId) : IDomainEvent;
