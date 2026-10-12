using Explivio.API.Infrastructure.Outcomes;
using MediatR;

namespace Explivio.API.Modules.Trips.GetTrip;

// F15: no UserId — access is authorized by RequireTripRole before the handler runs.
public record GetTripQuery(Guid TripId) : IRequest<Result<TripResponse>>;

public record TripResponse(
    Guid Id,
    string Name,
    string Destination,
    DateOnly StartDate,
    DateOnly EndDate,
    int TravelerCount,
    DateTime CreatedAt
);
