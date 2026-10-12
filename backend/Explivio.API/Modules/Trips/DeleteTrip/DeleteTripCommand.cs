using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.DeleteTrip;

// F15: no UserId — Owner access is authorized by RequireTripRole before the handler runs.
public record DeleteTripCommand(Guid TripId) : IRequest<Result>;
