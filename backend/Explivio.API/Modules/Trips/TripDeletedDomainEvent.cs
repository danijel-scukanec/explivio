using Explivio.API.Infrastructure.Domain;

namespace Explivio.API.Modules.Trips;

// F08: raised when a trip is deleted, so the read-model projector can drop its TripSummary row.
public sealed record TripDeletedDomainEvent(Guid TripId) : IDomainEvent;
