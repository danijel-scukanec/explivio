using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F05: raised when a trip is created. Downstream (F06 AI suggestions, F07 notifications) will
// react to this once they subscribe to the 'domain-events' topic.
public sealed record TripCreatedDomainEvent(Guid TripId, string Destination, Guid UserId) : IDomainEvent;
