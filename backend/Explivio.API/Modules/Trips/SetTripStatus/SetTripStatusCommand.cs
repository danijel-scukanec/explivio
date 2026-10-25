using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.SetTripStatus;

// Access is authorized by RequireTripRole(Editor) before the handler runs.
// F20: ActorUserId (set by the endpoint) is used to notify the trip's other members of the change.
public record SetTripStatusCommand(Guid TripId, TripStatus Status, Guid ActorUserId = default) : IRequest<Result>;

// Request body for PATCH /trips/{id}/status — the id comes from the route.
public record SetTripStatusRequest(TripStatus Status);
