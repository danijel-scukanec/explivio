using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.SetTripStatus;

// Access is authorized by RequireTripRole(Editor) before the handler runs.
public record SetTripStatusCommand(Guid TripId, TripStatus Status) : IRequest<Result>;

// Request body for PATCH /trips/{id}/status — the id comes from the route.
public record SetTripStatusRequest(TripStatus Status);
