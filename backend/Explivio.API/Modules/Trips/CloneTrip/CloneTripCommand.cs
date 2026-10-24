using MediatR;

namespace Explivio.API.Modules.Trips.CloneTrip;

// F26: clone a trip as a starting template. SourceTripId must be public or one the caller already has
// access to; the copy is owned by UserId. Returns the new trip id, or null if the source isn't
// visible to the caller (so the endpoint can 404).
public record CloneTripCommand(Guid SourceTripId, Guid UserId) : IRequest<Guid?>;
