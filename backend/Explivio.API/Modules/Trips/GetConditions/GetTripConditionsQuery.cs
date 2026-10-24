using MediatR;

namespace Explivio.API.Modules.Trips.GetConditions;

// F28: access is authorized by RequireTripRole(Viewer) on the endpoint before the handler runs.
public record GetTripConditionsQuery(Guid TripId) : IRequest<TripConditionsResponse>;
